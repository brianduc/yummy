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
import { ALLOWED_EXTENSIONS, SCAN_CHUNK_BYTES } from '../../config/constants.js';
import type { Db } from '../../db/client.js';
import { kbRepo } from '../../db/repositories/kb.repo.js';
import { repoRepo } from '../../db/repositories/repo.repo.js';
import { scanStatusRepo } from '../../db/repositories/scan-status.repo.js';
import { callAI } from '../ai/dispatcher.js';
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
  const ext = entry.path.slice(entry.path.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Run a full repo scan in the background. Resolves when finished (or errored).
 * Status is persisted to scan_status; clients poll via GET /kb/scan/status.
 */
export async function runScan(db: Db): Promise<void> {
  await scanStatusRepo.set(db, {
    running: true,
    text: 'Connecting to GitHub API...',
    progress: 0,
    error: false,
  });
  await kbRepo.resetAll(db);

  try {
    const ri = await repoRepo.get(db);
    if (!ri) {
      await scanStatusRepo.set(db, {
        running: false,
        text: 'Scan error: repo info not configured.',
        progress: 0,
        error: true,
      });
      return;
    }
    const maxLimit = ri.maxScanLimit;

    // ── Step 1: repo metadata ──
    await scanStatusRepo.patch(db, { text: 'Reading repo info...' });
    const repoData = await getRepoInfo(db, ri.owner, ri.repo);
    const branch = repoData.default_branch;
    await repoRepo.setBranch(db, branch);

    // ── Step 2: file tree ──
    await scanStatusRepo.patch(db, { text: 'Fetching file list...' });
    const allFiles = await getRepoTree(db, ri.owner, ri.repo, branch);
    const validFiles = allFiles.filter(isAllowedFile).slice(0, maxLimit);

    if (validFiles.length === 0) {
      await scanStatusRepo.set(db, {
        running: false,
        text: 'No matching files found in the repo.',
        progress: 0,
        error: true,
      });
      return;
    }

    // Initialize tree with "pending" status
    await kbRepo.replaceTree(
      db,
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

    for (const [i, file] of validFiles.entries()) {
      const progress = Math.round((i / total) * 80);
      await scanStatusRepo.set(db, {
        running: true,
        text: `Indexing [${file.path}] (${i + 1}/${total})`,
        progress,
        error: false,
      });

      await kbRepo.updateTreeStatus(db, file.path, 'processing');

      try {
        const content = await githubRaw(db, ri.owner, ri.repo, branch, file.path);
        currentChunk += `\n--- FILE: ${file.path} ---\n${content}\n`;
        filesInChunk.push(file.path);
      } catch {
        // Skip files that cannot be read (binary, too large, etc.)
      }

      await kbRepo.updateTreeStatus(db, file.path, 'done');

      // Flush chunk if large enough or last file
      const chunkReady = currentChunk.length >= SCAN_CHUNK_BYTES || i === total - 1;
      if (chunkReady && currentChunk.trim() && filesInChunk.length > 0) {
        await scanStatusRepo.patch(db, {
          text:
            `AI indexing chunk of ${filesInChunk.length} files... ` +
            `(${insightsCount + 1} insights so far)`,
        });

        const summary = await callAI(
          'INDEXER',
          `Summarize the code logic:\n${currentChunk}`,
          INDEXER_INSTRUCTION,
          undefined,
          db,
        );

        await kbRepo.addInsight(db, {
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

    // ── Step 5: project wiki ──
    await scanStatusRepo.set(db, {
      running: true,
      text: 'Writing Project Wiki (Project Summary)...',
      progress: 90,
      error: false,
    });

    const allInsightsStr = (await kbRepo.listInsights(db)).map((ins) => ins.summary).join('\n\n');

    const projectSummary = await callAI(
      'ARCHITECT',
      `Based on these technical summaries:\n${allInsightsStr}`,
      architectInstruction(ri.repo),
      undefined,
      db,
    );

    await kbRepo.setProjectSummary(db, projectSummary);
    await scanStatusRepo.set(db, {
      running: false,
      text: `Scan complete. Indexed ${total} files, generated ${insightsCount} insights.`,
      progress: 100,
      error: false,
    });
  } catch (e) {
    await scanStatusRepo.set(db, {
      running: false,
      text: `Scan error: ${(e as Error).message}`,
      progress: 0,
      error: true,
    });
  }
}
