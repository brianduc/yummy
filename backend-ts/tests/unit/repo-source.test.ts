/**
 * Unit tests for repo.source.withAuth.
 *
 * cloneOrUpdate itself is exercised by an integration-style test that
 * uses simple-git against a local bare repo (kept out of unit suite to
 * stay fast). The pure helper here is the security-critical bit: a bug
 * in withAuth either leaks the PAT into logs or fails to authenticate.
 */
import { describe, expect, it } from 'vitest';
import { withAuth } from '../../src/services/codeintel/repo.source.js';

describe('repo.source.withAuth', () => {
  it('returns the URL unchanged when no token is supplied', () => {
    expect(withAuth('https://github.com/acme/widget.git', undefined)).toBe(
      'https://github.com/acme/widget.git',
    );
    expect(withAuth('https://github.com/acme/widget.git', '')).toBe(
      'https://github.com/acme/widget.git',
    );
  });

  it('splices the token as x-access-token for HTTPS URLs', () => {
    expect(withAuth('https://github.com/acme/widget.git', 'ghp_abc123')).toBe(
      'https://x-access-token:ghp_abc123@github.com/acme/widget.git',
    );
  });

  it('leaves non-HTTPS URLs untouched (we never auth ssh/git://)', () => {
    expect(withAuth('git@github.com:acme/widget.git', 'ghp_abc123')).toBe(
      'git@github.com:acme/widget.git',
    );
    expect(withAuth('git://github.com/acme/widget.git', 'ghp_abc123')).toBe(
      'git://github.com/acme/widget.git',
    );
  });

  it('does not double-wrap a URL that already contains credentials', () => {
    const already = 'https://oldtoken@github.com/acme/widget.git';
    expect(withAuth(already, 'ghp_new')).toBe(already);
  });
});
