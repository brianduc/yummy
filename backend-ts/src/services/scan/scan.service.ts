/**
 * YUMMY Backend — Scan service.
 * Background task that scans a GitHub repo and indexes it into the knowledge base.
 *
 * Mirrors backend/services/scan_service.py.
 *
 * Flow:
 *   1. Fetch repo metadata (default branch)
 *   2. Fetch file tree, filter by extension and exclude node_modules / .git
 *   3. Read each file, group into ~35KB chunks
 *   4. Each chunk -> INDEXER agent summarizes
 *   5. All insights -> ARCHITECT agent writes Project Wiki
 *
 * Poll status via GET /kb/scan/status (handled by kb router).
 */
import { extname } from 'node:path';
import {
  ALLOWED_EXTENSIONS,
  ARCHITECT_BATCH_TOKENS,
  ARCHITECT_FINAL_TOKENS,
  SCAN_CHUNK_TOKENS,
} from '../../config/constants.js';
import { currentChatModel } from '../../config/runtime.js';
import { kbRepo } from '../../db/repositories/kb.repo.js';
import { repoRepo } from '../../db/repositories/repo.repo.js';
import { scanStatusRepo } from '../../db/repositories/scan-status.repo.js';
import { callAI } from '../ai/dispatcher.js';
import { countTokens } from '../ai/token-counter.js';
import { indexRepo } from '../codeintel/index.service.js';
import { getRepoInfo, getRepoTree, githubRaw, type TreeEntry } from '../github/github.service.js';

const INDEXER_INSTRUCTION =
  'You are a code indexer. Briefly summarize the functionality, ' +
  'patterns and dependencies of these files. ' +
  'Do NOT wrap the entire output in a Markdown code block.';

function architectInstruction(repoName: string): string {
  return (
    `You are the Chief Architect of the '${repoName}' project. ` +
    'Write a PROJECT SUMMARY in GitBook style with the following sections:\n' +
    '# Introduction\n' +
    '## Core Components\n' +
    '## Key Functions & APIs\n' +
    '## Data Models\n' +
    '## Security Considerations\n' +
    '## Deployment & Infrastructure\n' +
    'Use clean Markdown formatting. ' +
    'Do NOT wrap the entire output in a ```markdown block. ' +
    'Do NOT fabricate any information.'
  );
}

function isAllowedFile(entry: TreeEntry): boolean {
  if (entry.type !== 'blob') return false;
  if (entry.path.includes('node_modules')) return false;
  if (entry.path.includes('.git')) return false;
  const ext = extname(entry.path).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Two-pass hierarchical summarization to stay within the per-request token cap.
 *
 * Pass 1 — Group `summaries` into batches of ≤ ARCHITECT_BATCH_TOKENS tokens.
 *           Call ARCHITECT on each batch to produce intermediate meta-summaries.
 * Pass 2 — Join all meta-summaries (expected to fit in ARCHITECT_FINAL_TOKENS)
 *           and call ARCHITECT once for the final structured project wiki.
 *
 * If all summaries already fit within a single batch, only one LLM call is
 * made and the final synthesis is skipped.
 *
 * If meta-summaries somehow still exceed ARCHITECT_FINAL_TOKENS (pathological
 * case: very large repo with many long summaries), the function recurses once
 * more to further reduce before the final call.
 */
async function hierarchicalSummarize(
  summaries: string[],
  repoName: string,
  onProgress?: (text: string) => void,
): Promise<string> {
  const model = currentChatModel();

  const batchInstruction =
    'You are a senior software architect. ' +
    'Condense the following technical summaries into a single concise meta-summary. ' +
    'Preserve all key component names, data flows, and API contracts. ' +
    'Do NOT wrap the output in a Markdown code block.';

  // ── Pass 1: group insights into ≤ ARCHITECT_BATCH_TOKENS chunks ──
  const metaSummaries: string[] = [];
  let batch: string[] = [];
  let batchTokens = 0;

  for (const summary of summaries) {
    const summaryTokens = countTokens(model, summary);
    if (batchTokens + summaryTokens > ARCHITECT_BATCH_TOKENS && batch.length > 0) {
      onProgress?.(`Hierarchical summarize: condensing batch ${metaSummaries.length + 1}...`);
      const meta = await callAI('ARCHITECT', batch.join('\n\n'), batchInstruction);
      metaSummaries.push(meta);
      batch = [];
      batchTokens = 0;
    }
    batch.push(summary);
    batchTokens += summaryTokens;
  }
  // Flush the last (or only) batch
  if (batch.length > 0) {
    onProgress?.(`Hierarchical summarize: condensing batch ${metaSummaries.length + 1}...`);
    const meta = await callAI('ARCHITECT', batch.join('\n\n'), batchInstruction);
    metaSummaries.push(meta);
  }

  // ── Pass 2: final synthesis ──
  const finalInput = metaSummaries.join('\n\n');
  const finalTokens = countTokens(model, finalInput);

  // Safety guard: if meta-summaries still exceed the cap, recurse once more.
  if (finalTokens > ARCHITECT_FINAL_TOKENS) {
    onProgress?.('Hierarchical summarize: reducing meta-summaries further...');
    return hierarchicalSummarize(metaSummaries, repoName, onProgress);
  }

  onProgress?.('Writing Project Wiki (final synthesis)...');
  return callAI(
    'ARCHITECT',
    `Based on these technical summaries:\n${finalInput}`,
    architectInstruction(repoName),
  );
}

/**
 * Run a full repo scan in the background. Resolves when finished (or errored).
 * Status is persisted to scan_status; clients poll via GET /kb/scan/status.
 */
export async function runScan(): Promise<void> {
  scanStatusRepo.set({
    running: true,
    text: 'Connecting to GitHub API...',
    progress: 0,
    error: false,
  });
  kbRepo.resetAll();

  try {
    const ri = repoRepo.get();
    if (!ri) {
      scanStatusRepo.set({
        running: false,
        text: 'Scan error: repo info not configured.',
        progress: 0,
        error: true,
      });
      return;
    }
    const maxLimit = ri.maxScanLimit;

    // ── Step 1: repo metadata ──
    scanStatusRepo.patch({ text: 'Reading repo info...' });
    const repoData = await getRepoInfo(ri.owner, ri.repo);
    const branch = repoData.default_branch;
    repoRepo.setBranch(branch);

    // ── Step 2: file tree ──
    scanStatusRepo.patch({ text: 'Fetching file list...' });
    const allFiles = await getRepoTree(ri.owner, ri.repo, branch);
    const validFiles = allFiles.filter(isAllowedFile).slice(0, maxLimit);

    if (validFiles.length === 0) {
      scanStatusRepo.set({
        running: false,
        text: 'No matching files found in the repo.',
        progress: 0,
        error: true,
      });
      return;
    }

    // Initialize tree with "pending" status
    kbRepo.replaceTree(
      validFiles.map((f) => ({
        path: f.path,
        name: f.path.split('/').pop() ?? f.path,
        status: 'pending',
      })),
    );

    // ── Steps 3 & 4: read files in chunks, AI summarizes ──
    let currentChunk = '';
    let filesInChunk: string[] = [];
    let insightsCount = 0;
    const total = validFiles.length;

    for (let i = 0; i < total; i++) {
      const file = validFiles[i]!;
      const progress = Math.round((i / total) * 80);
      scanStatusRepo.set({
        running: true,
        text: `Indexing [${file.path}] (${i + 1}/${total})`,
        progress,
        error: false,
      });

      kbRepo.updateTreeStatus(file.path, 'processing');

      try {
        const content = await githubRaw(ri.owner, ri.repo, branch, file.path);
        currentChunk += `\n--- FILE: ${file.path} ---\n${content}\n`;
        filesInChunk.push(file.path);
      } catch {
        // Skip files that cannot be read (binary, too large, etc.)
      }

      kbRepo.updateTreeStatus(file.path, 'done');

      // Flush chunk when token budget is reached or on the last file.
      const chunkTokens = countTokens(currentChatModel(), currentChunk);
      const chunkReady = chunkTokens >= SCAN_CHUNK_TOKENS || i === total - 1;
      if (chunkReady && currentChunk.trim() && filesInChunk.length > 0) {
        scanStatusRepo.patch({
          text:
            `AI indexing chunk of ${filesInChunk.length} files... ` +
            `(${insightsCount + 1} insights so far)`,
        });

        const summary = await callAI(
          'INDEXER',
          `Summarize the code logic:\n${currentChunk}`,
          INDEXER_INSTRUCTION,
        );

        kbRepo.addInsight({
          id: Date.now() + i,
          files: [...filesInChunk],
          summary,
          createdAt: Date.now(),
        });
        insightsCount += 1;

        currentChunk = '';
        filesInChunk = [];
      }
    }

    // ── Step 5: project wiki (hierarchical summarization) ──
    scanStatusRepo.set({
      running: true,
      text: 'Writing Project Wiki (hierarchical summarize)...',
      progress: 90,
      error: false,
    });

    const allSummaries = kbRepo.listInsights().map((ins) => ins.summary);
    const projectSummary = await hierarchicalSummarize(
      allSummaries,
      ri.repo,
      (text) => scanStatusRepo.patch({ text }),
    );

    kbRepo.setProjectSummary(projectSummary);

    // ── Step 6: code-intel (gitnexus + embeddings) ──
    // Additive: runs alongside the legacy AI insights pipeline. Failure here
    // does NOT fail the overall scan — `kb.insights` + `projectSummary` are
    // already persisted and `/ask` continues to work off them — but we now
    // surface the failure prominently via `codeIntelOk=false` so the UI can
    // tell the user RAG is in degraded mode (was silently swallowed before).
    let codeIntelNote = '';
    let codeIntelOk: boolean | null = null;
    let codeIntelMessage = '';
    try {
      scanStatusRepo.set({
        running: true,
        text: 'Code intel: cloning repo...',
        progress: 95,
        error: false,
        codeIntelOk: null,
        codeIntelMessage: '',
      });

      const result = await indexRepo({
        owner: ri.owner,
        repo: ri.repo,
        url: ri.url,
        branch,
        token: ri.githubToken ? ri.githubToken : undefined,
        onProgress: (phase, message) => {
          // Keep progress monotonic in 95..99 so the final 100 is reserved
          // for the "scan complete" terminal message.
          const phaseProgress: Record<typeof phase, number> = {
            clone: 95,
            analyze: 97,
            embed: 99,
            done: 99,
          };
          scanStatusRepo.patch({
            text: `Code intel: ${message}`,
            progress: phaseProgress[phase],
          });
        },
      });

      const g = result.graphStats;
      const s = result.symbolStats;
      const fileFallback = result.fileFallbackChunks ?? 0;
      codeIntelNote =
        ` Code graph: ${g.nodes ?? 0} nodes, ${g.edges ?? 0} edges, ` +
        `${g.processes ?? 0} processes. ` +
        `Symbols: ${s.totalSymbols} indexed (${s.skipped} skipped). ` +
        `Embeddings: ${result.embedStats.inserted} inserted, ` +
        `${result.embedStats.reused} reused` +
        (fileFallback > 0 ? `, ${fileFallback} file-fallback` : '') +
        '.';
      codeIntelOk = true;
      codeIntelMessage = '';
    } catch (codeIntelErr) {
      // Surface the failure loudly. Legacy insights remain valid and `/ask`
      // continues to work in degraded mode — but the user MUST know RAG is
      // off so they don't blame the LLM for vague answers.
      const msg = (codeIntelErr as Error).message;
      codeIntelNote = ` ⚠ RAG disabled — code-intel failed: ${msg}`;
      codeIntelOk = false;
      codeIntelMessage = msg;
      console.error('[scan] Code-intel pipeline failed:', codeIntelErr);
    }

    scanStatusRepo.set({
      running: false,
      text:
        `Scan complete. Indexed ${total} files, generated ${insightsCount} insights.` +
        codeIntelNote,
      progress: 100,
      // We intentionally do NOT set the top-level `error` flag on code-intel
      // failure — the AI-insights pipeline succeeded. The UI uses
      // `codeIntelOk` for the RAG-specific banner.
      error: false,
      codeIntelOk,
      codeIntelMessage,
    });
  } catch (e) {
    scanStatusRepo.set({
      running: false,
      text: `Scan error: ${(e as Error).message}`,
      progress: 0,
      error: true,
    });
  }
}
