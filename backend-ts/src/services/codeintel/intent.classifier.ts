/**
 * IntentClassifier — 6-way query intent for the RAG router.
 *
 * Why bother classifying? Because the *prompt template* and the
 * *retrieval mix* both want to know what the user is trying to do
 * before we waste an OpenAI round-trip:
 *
 *   - "where is X defined" / "how does Y work"        → exploring
 *   - "why does Z fail" / "stack trace"               → debugging
 *   - "add a foo to bar" / "create endpoint"          → implementing
 *   - "is this safe to merge" / "review this"         → reviewing
 *   - "rename foo to bar" / "extract this method"     → refactoring
 *   - "what is dependency injection"                  → learning
 *
 * Strategy:
 *   1. **Heuristic pass** — keyword/regex rules with weighted votes.
 *      O(question.length); zero network. Wins on ~80% of real queries
 *      because users telegraph intent with verbs.
 *   2. **LLM fallback** — only fires when (a) no rule scored above
 *      `MIN_CONFIDENCE`, OR (b) the top two candidates tied within
 *      `TIE_THRESHOLD`. Uses the project's existing `callAI` so it
 *      respects whatever provider is configured.
 *
 * The classifier returns *both* the intent label and a confidence in
 * [0, 1] so the router can decide whether to mention the classification
 * in the prompt or keep it for trace-only.
 *
 * Determinism: the heuristic pass is deterministic; tests pin behaviour
 * with a fixture table. The LLM pass is stochastic by nature and is
 * therefore guarded behind an injectable `classifier` so unit tests can
 * stub it.
 */

export const INTENTS = [
  'exploring',
  'debugging',
  'implementing',
  'reviewing',
  'refactoring',
  'learning',
] as const;

export type Intent = (typeof INTENTS)[number];

export interface IntentResult {
  intent: Intent;
  /** [0, 1]; ≥ MIN_CONFIDENCE means heuristic was sure. */
  confidence: number;
  /** "heuristic" or "llm" — useful for traces. */
  method: 'heuristic' | 'llm' | 'fallback';
  /** Top-2 raw scores for trace/debugging. */
  scores: Partial<Record<Intent, number>>;
}

export interface IntentOptions {
  /** Minimum top-score to skip LLM call. Tuned on a 50-query fixture. */
  minConfidence?: number;
  /** Margin (top - second) below which we consider the result "ambiguous". */
  tieThreshold?: number;
  /** Skip LLM entirely (CI / offline / latency-sensitive paths). */
  heuristicOnly?: boolean;
  /** DI seam — overrides `callAI` for tests. */
  llm?: (question: string) => Promise<Intent | null>;
}

const MIN_CONFIDENCE_DEFAULT = 0.45;
const TIE_THRESHOLD_DEFAULT = 0.1;

// ─── Heuristic rules ──────────────────────────────────────
//
// Each rule has a *pattern* (regex or keyword set) and a *weight*.
// Multiple rules can fire per question; scores accumulate. We
// normalise at the end so the top score is in [0, 1].
//
// Weights are deliberately small (1.0 ≈ "strong signal") so a single
// powerhouse keyword like "rename" doesn't lock in refactoring when
// the user actually wrote "should I rename this for clarity?" (that
// also gets `should i` → reviewing).

interface Rule {
  intent: Intent;
  /** Either a RegExp (matched case-insensitive) or a list of words. */
  patterns: ReadonlyArray<RegExp | string>;
  weight: number;
}

const RULES: ReadonlyArray<Rule> = [
  // exploring — discovery / navigation
  {
    intent: 'exploring',
    patterns: [
      /\bwhere\s+(is|are|does)\b/,
      /\bhow\s+does\b/,
      /\bwhat\s+(does|is\s+the)\b/,
      /\bshow\s+me\b/,
      /\bfind\b/,
      /\bsearch\b/,
      /\bcalls?\s+(this|the)\b/,
      'navigate',
      'locate',
      'flow',
      'architecture',
    ],
    weight: 1.0,
  },
  // debugging — failures / errors
  {
    intent: 'debugging',
    patterns: [
      /\bwhy\s+(is|does|doesn['’]?t|isn['’]?t)\b/,
      /\b(error|exception|stack\s*trace|traceback)\b/,
      /\b(fail(s|ed|ing)?|broken|crash(es|ed|ing)?)\b/,
      /\bnot\s+working\b/,
      /\bbug\b/,
      'reproduce',
      'fix',
      'debug',
      'panic',
      '500',
      '404',
    ],
    weight: 1.2, // errors are usually unambiguous
  },
  // implementing — net-new code
  {
    intent: 'implementing',
    patterns: [
      /\b(add|create|build|implement|introduce)\b/,
      /\b(new|another)\s+(endpoint|route|service|component|function|class|table)\b/,
      /\bwire\s+up\b/,
      /\bhook\s+up\b/,
      'scaffold',
      'generate',
      'support for',
    ],
    weight: 1.0,
  },
  // reviewing — quality / safety
  {
    intent: 'reviewing',
    patterns: [
      /\b(review|audit|inspect)\b/,
      /\b(is|will)\s+(it|this|that)\s+(safe|correct|okay|fine)\b/,
      /\bshould\s+(i|we)\b/,
      /\b(any|are\s+there)\s+(issues|problems|bugs)\b/,
      /\bcheck\b/,
      'sanity',
      'concern',
      'risk',
      'lint',
    ],
    weight: 1.0,
  },
  // refactoring — restructuring existing code
  {
    intent: 'refactoring',
    patterns: [
      /\brename\b/,
      /\bextract\b/,
      /\b(split|merge|move)\s+(this|the|out)\b/,
      /\brefactor\b/,
      /\bclean(\s*up)?\b/,
      /\bdry\s+up\b/,
      /\bsimplif(y|ies|ied)\b/,
      'consolidate',
      'restructure',
      'decouple',
    ],
    weight: 1.1,
  },
  // learning — conceptual / general
  {
    intent: 'learning',
    patterns: [
      /\bwhat\s+is\s+(a|an|the)?\s*\w+/,
      /\bexplain\b/,
      /\bdifference\s+between\b/,
      /\b(pros|cons)\s+of\b/,
      /\bbest\s+practice\b/,
      /\bwhen\s+(should|to)\s+(i|use)\b/,
      'concept',
      'tutorial',
      'overview',
    ],
    weight: 0.8, // weakest because "what is X" overlaps with exploring
  },
];

function patternHits(question: string, pattern: RegExp | string): boolean {
  if (typeof pattern === 'string') {
    return question.includes(pattern.toLowerCase());
  }
  return pattern.test(question);
}

function scoreHeuristic(question: string): Map<Intent, number> {
  const lc = question.toLowerCase();
  const scores = new Map<Intent, number>();
  for (const rule of RULES) {
    let hits = 0;
    for (const p of rule.patterns) {
      if (patternHits(lc, p)) hits += 1;
    }
    if (hits > 0) {
      // Diminishing returns: 1 hit = full weight, 2 hits = ~1.5x, etc.
      const inc = rule.weight * (1 + Math.log2(hits));
      scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + inc);
    }
  }
  return scores;
}

/** Normalise so the top score equals 1.0; preserves rank / margins. */
function normalise(scores: Map<Intent, number>): Map<Intent, number> {
  let max = 0;
  for (const v of scores.values()) if (v > max) max = v;
  if (max === 0) return scores;
  const out = new Map<Intent, number>();
  for (const [k, v] of scores) out.set(k, v / max);
  return out;
}

function topTwo(scores: Map<Intent, number>): {
  top: { intent: Intent; score: number } | undefined;
  second: { intent: Intent; score: number } | undefined;
} {
  const sorted = Array.from(scores.entries())
    .map(([intent, score]) => ({ intent, score }))
    .sort((a, b) => b.score - a.score);
  return { top: sorted[0], second: sorted[1] };
}

function scoresToObject(scores: Map<Intent, number>): Partial<Record<Intent, number>> {
  const out: Partial<Record<Intent, number>> = {};
  for (const [k, v] of scores) out[k] = Number(v.toFixed(3));
  return out;
}

// ─── LLM fallback ─────────────────────────────────────────

/**
 * Default LLM classifier — uses the project's `callAI` with a strict
 * one-word response prompt. Returns `null` if the model emits
 * something we can't map to an `Intent` (treated as "fall back to
 * exploring" by the caller).
 */
async function defaultLlmClassify(question: string): Promise<Intent | null> {
  // Lazy import — keeps tests that stub `llm` from booting the
  // ai/dispatcher module (which pulls runtimeConfig + provider clients).
  const { callAI } = await import('../ai/dispatcher.js');
  const instruction =
    'You classify developer questions into one of six intents. ' +
    'Reply with EXACTLY ONE WORD from this list and nothing else: ' +
    `${INTENTS.join(', ')}.`;
  const prompt = `Question: ${question}\nIntent:`;
  let raw: string;
  try {
    raw = await callAI('CLASSIFIER', prompt, instruction);
  } catch {
    return null;
  }
  const word = raw.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return (INTENTS as readonly string[]).includes(word) ? (word as Intent) : null;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Classify the user's question. Pure-heuristic by default in the hot
 * path; only escalates to the LLM when ambiguous.
 *
 * Always resolves — never throws, even if the LLM call fails. On
 * total failure returns `{intent: 'exploring', method: 'fallback'}`
 * which is the safest no-op default for the RAG prompt.
 */
export async function classifyIntent(
  question: string,
  options: IntentOptions = {},
): Promise<IntentResult> {
  const minConf = options.minConfidence ?? MIN_CONFIDENCE_DEFAULT;
  const tieThr = options.tieThreshold ?? TIE_THRESHOLD_DEFAULT;

  const raw = scoreHeuristic(question);
  const norm = normalise(raw);
  const { top, second } = topTwo(norm);

  // No rule fired at all — go to LLM (or default to exploring).
  if (!top) {
    if (options.heuristicOnly) {
      return {
        intent: 'exploring',
        confidence: 0,
        method: 'fallback',
        scores: {},
      };
    }
    const llm = options.llm ?? defaultLlmClassify;
    const guess = await llm(question);
    return {
      intent: guess ?? 'exploring',
      confidence: guess ? 0.5 : 0,
      method: guess ? 'llm' : 'fallback',
      scores: {},
    };
  }

  const confident = top.score >= minConf && (!second || top.score - second.score >= tieThr);

  if (confident || options.heuristicOnly) {
    return {
      intent: top.intent,
      confidence: Number(top.score.toFixed(3)),
      method: 'heuristic',
      scores: scoresToObject(norm),
    };
  }

  // Ambiguous — ask the LLM but keep heuristic as the safety net.
  const llm = options.llm ?? defaultLlmClassify;
  const guess = await llm(question);
  if (guess) {
    return {
      intent: guess,
      confidence: 0.5,
      method: 'llm',
      scores: scoresToObject(norm),
    };
  }
  return {
    intent: top.intent,
    confidence: Number(top.score.toFixed(3)),
    method: 'heuristic',
    scores: scoresToObject(norm),
  };
}

export const _internal = {
  scoreHeuristic,
  normalise,
  topTwo,
  RULES,
  MIN_CONFIDENCE_DEFAULT,
  TIE_THRESHOLD_DEFAULT,
};
