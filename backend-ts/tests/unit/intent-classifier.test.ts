/**
 * Unit tests for IntentClassifier.
 *
 * Two-tier coverage:
 *   1. Deterministic heuristic table — pinned with a fixture of
 *      representative dev questions. Catches accidental regressions
 *      to the rule weights.
 *   2. LLM fallback contract — verifies we ONLY call the LLM when the
 *      heuristic is below confidence or in a tie, and that we degrade
 *      gracefully when the LLM returns junk.
 *
 * No network: the LLM is always injected via `options.llm`.
 */
import { describe, expect, it, vi } from 'vitest';

import { classifyIntent, type Intent } from '../../src/services/codeintel/intent.classifier.js';

describe('classifyIntent — heuristic pass', () => {
  const fixtures: Array<{ q: string; want: Intent }> = [
    { q: 'where is validateUser defined?', want: 'exploring' },
    { q: 'how does the auth flow work', want: 'exploring' },
    { q: 'show me the api routes', want: 'exploring' },

    { q: 'why does login fail with 401', want: 'debugging' },
    { q: 'getting a stack trace from /api/grants', want: 'debugging' },
    { q: 'this is broken in production', want: 'debugging' },

    { q: 'add a new endpoint for /reports', want: 'implementing' },
    { q: 'create a new component for the dashboard', want: 'implementing' },
    { q: 'implement pagination for the grants table', want: 'implementing' },

    { q: 'review this PR for any concerns', want: 'reviewing' },
    { q: 'is this safe to merge?', want: 'reviewing' },

    { q: 'rename foo to bar', want: 'refactoring' },
    { q: 'extract this method into its own file', want: 'refactoring' },
    { q: 'refactor the user service', want: 'refactoring' },

    { q: 'explain how dependency injection works', want: 'learning' },
    { q: 'best practice for structuring monorepos', want: 'learning' },
  ];

  for (const { q, want } of fixtures) {
    it(`classifies "${q}" → ${want}`, async () => {
      const r = await classifyIntent(q, { heuristicOnly: true });
      expect(r.intent).toBe(want);
      expect(r.method).toBe('heuristic');
    });
  }

  it('returns method=fallback and intent=exploring when no rule fires (heuristic-only)', async () => {
    const r = await classifyIntent('xyzzy', { heuristicOnly: true });
    expect(r.intent).toBe('exploring');
    expect(r.method).toBe('fallback');
    expect(r.confidence).toBe(0);
  });
});

describe('classifyIntent — LLM fallback', () => {
  it('does NOT call the LLM when the heuristic is confident', async () => {
    const llm = vi.fn(async () => 'debugging' as Intent);
    const r = await classifyIntent('why does this crash', { llm });
    expect(r.intent).toBe('debugging');
    expect(r.method).toBe('heuristic');
    expect(llm).not.toHaveBeenCalled();
  });

  it('calls the LLM when no rule fires, accepts a valid label', async () => {
    const llm = vi.fn(async () => 'reviewing' as Intent);
    const r = await classifyIntent('xyzzy', { llm });
    expect(llm).toHaveBeenCalledOnce();
    expect(r.intent).toBe('reviewing');
    expect(r.method).toBe('llm');
  });

  it('falls back to exploring when the LLM returns null', async () => {
    const llm = vi.fn(async () => null);
    const r = await classifyIntent('xyzzy', { llm });
    expect(r.intent).toBe('exploring');
    expect(r.method).toBe('fallback');
  });

  it('keeps heuristic top when ambiguous + LLM returns null', async () => {
    // Construct an intentionally ambiguous question that fires multiple
    // rules with similar weights ("rename" → refactoring,
    // "should i" → reviewing) so the tie threshold pushes us to the LLM.
    const llm = vi.fn(async () => null);
    const r = await classifyIntent('should i rename this', { llm });
    expect(['refactoring', 'reviewing']).toContain(r.intent);
    // method may be 'heuristic' (if heuristic was confident enough) or
    // 'heuristic' (after llm null fallback). Either way: not 'llm'.
    expect(r.method).not.toBe('llm');
  });
});
