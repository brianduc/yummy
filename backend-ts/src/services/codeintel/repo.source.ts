/**
 * Repo source — clones (or fast-forwards) a Git repo into the local
 * `${GITNEXUS_REPO_ROOT}/<repoId>/` directory so gitnexus can analyze it.
 *
 * Two-mode operation:
 *
 *   - First call for a given (repoId, url) pair → `git clone` into a tmp
 *     dir, then atomic rename into place.
 *   - Subsequent calls → `git fetch` + `git reset --hard origin/<branch>`
 *     so re-scans converge on the remote tip without producing dirty
 *     working trees.
 *
 * `repoId` is filename-safe (validated by `resolveRepo` in graph.client).
 * `branch` defaults to whatever `origin/HEAD` points at, which matches
 * what we pull from the GitHub metadata API in scan.service.
 *
 * Authentication: when a non-empty `token` is supplied we splice it into
 * the URL as `https://x-access-token:<token>@host/...`. We never log the
 * token-bearing URL.
 */
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type SimpleGit, simpleGit } from 'simple-git';

export interface CloneOrUpdateInput {
  /** Absolute target path (already resolved by graph.client.resolveRepo). */
  repoPath: string;
  url: string; // https URL
  branch?: string | undefined; // optional explicit branch
  token?: string | undefined; // optional GitHub PAT
}

export interface CloneOrUpdateResult {
  ok: true;
  repoPath: string;
  branch: string;
  head: string;
  cloned: boolean;
}

/**
 * Splice a PAT into an https URL for git over HTTPS. Returns the URL
 * unchanged when no token is present or the URL isn't https.
 */
export function withAuth(url: string, token: string | undefined): string {
  if (!token) return url;
  if (!url.startsWith('https://')) return url;
  // Already has credentials — don't double-wrap.
  if (/https:\/\/[^/]+@/.test(url)) return url;
  return url.replace('https://', `https://x-access-token:${token}@`);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepo(p: string): Promise<boolean> {
  return pathExists(join(p, '.git'));
}

/**
 * Clone or update a repo into `${GITNEXUS_REPO_ROOT}/<repoId>`.
 *
 * - Clone: into `<repoId>.tmp/`, then atomic rename → `<repoId>/`.
 *   This avoids leaving a half-cloned directory behind on crash.
 * - Update: `git fetch` + `git reset --hard origin/<branch>` to make the
 *   working tree exactly match the remote (drops any local edits, which
 *   we never expect in this path).
 */
export async function cloneOrUpdate(input: CloneOrUpdateInput): Promise<CloneOrUpdateResult> {
  const repoPath = input.repoPath;
  await mkdir(dirname(repoPath), { recursive: true });

  const authedUrl = withAuth(input.url, input.token);

  if (await isGitRepo(repoPath)) {
    const git = simpleGit({ baseDir: repoPath });
    // Refresh the auth-bearing remote URL each call — the token may have
    // rotated, and remembering an old token causes `git fetch` to 401.
    await git.remote(['set-url', 'origin', authedUrl]);
    await git.fetch(['--prune', '--depth', '1', 'origin']);
    const branch = input.branch ?? (await detectDefaultBranch(git));
    await git.reset(['--hard', `origin/${branch}`]);
    const head = (await git.revparse(['HEAD'])).trim();
    return { ok: true, repoPath, branch, head, cloned: false };
  }

  // Fresh clone via tmp + rename.
  const tmpPath = `${repoPath}.tmp`;
  await rm(tmpPath, { recursive: true, force: true });
  const cloneArgs = ['--depth', '1'];
  if (input.branch) cloneArgs.push('--branch', input.branch);
  await simpleGit().clone(authedUrl, tmpPath, cloneArgs);
  await rename(tmpPath, repoPath);

  const git = simpleGit({ baseDir: repoPath });
  const branch = input.branch ?? (await detectDefaultBranch(git));
  const head = (await git.revparse(['HEAD'])).trim();
  return { ok: true, repoPath, branch, head, cloned: true };
}

/**
 * `git symbolic-ref refs/remotes/origin/HEAD` → `refs/remotes/origin/main`
 * → strip prefix → `main`. Falls back to `'main'` when the symbolic ref
 * isn't set (rare with shallow clones — `git remote set-head origin -a`
 * would fix it, but the explicit branch path covers this in practice).
 */
async function detectDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    const out = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const m = out.trim().match(/refs\/remotes\/origin\/(.+)/);
    if (m?.[1]) return m[1];
  } catch {
    // ignore — fall through to default
  }
  return 'main';
}
