/**
 * Smoke tests for the GraphClient skeleton.
 *
 * These tests do NOT require Postgres or a real cloned repo — they verify:
 *   1. resolveRepo() rejects path-traversal inputs
 *   2. resolveRepo() composes paths under env.GITNEXUS_REPO_ROOT
 *   3. ensureGitnexusHome() sets process.env.HOME
 *   4. runFullAnalysis() either returns ok=true OR a structured warning
 *      when gitnexus isn't installed yet — never throws.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const tmpRoot = mkdtempSync(join(tmpdir(), 'yummy-graphclient-'));
const tmpHome = mkdtempSync(join(tmpdir(), 'yummy-gnhome-'));

process.env.GITNEXUS_REPO_ROOT = join(tmpRoot, 'repos');
process.env.GITNEXUS_HOME = tmpHome;
process.env.DATABASE_URL = ':memory:';

const { resolveRepo, ensureGitnexusHome, runFullAnalysis } = await import(
  '../../src/services/codeintel/graph.client.js'
);

describe('GraphClient.resolveRepo', () => {
  it('composes paths under GITNEXUS_REPO_ROOT', () => {
    const loc = resolveRepo('acme', 'widget');
    expect(loc.repoId).toBe('acme/widget');
    expect(loc.repoPath.endsWith('/repos/acme/widget')).toBe(true);
    expect(loc.graphDir.endsWith('/repos/acme/widget/.gitnexus')).toBe(true);
  });

  it('rejects path traversal in owner', () => {
    expect(() => resolveRepo('../etc', 'repo')).toThrow(/Invalid repo/);
  });

  it('rejects path traversal in repo', () => {
    expect(() => resolveRepo('owner', '..')).toThrow(/Invalid repo/);
  });

  it('rejects empty inputs', () => {
    expect(() => resolveRepo('', 'r')).toThrow();
    expect(() => resolveRepo('o', '')).toThrow();
  });
});

describe('GraphClient.ensureGitnexusHome', () => {
  it('sets process.env.HOME to GITNEXUS_HOME', () => {
    ensureGitnexusHome();
    expect(process.env.HOME).toBe(tmpHome);
  });
});

describe('GraphClient.runFullAnalysis', () => {
  it('returns a structured warning when gitnexus is not installed (does not throw)', async () => {
    const loc = resolveRepo('acme', 'smoke');
    const r = await runFullAnalysis(loc);
    // Either gitnexus is installed and analyze succeeds (ok=true),
    // OR it's missing and we get a warning — both paths must NOT throw.
    expect(typeof r.ok).toBe('boolean');
    expect(r.repoId).toBe('acme/smoke');
    if (!r.ok) {
      expect(r.warning).toMatch(/gitnexus/i);
    }
  });
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(tmpHome, { recursive: true, force: true });
});
