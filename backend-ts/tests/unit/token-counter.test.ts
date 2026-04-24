/**
 * Token-counter unit tests.
 *
 * Token counts depend on the BPE tables in js-tiktoken; we test for
 * stable invariants (model→encoding mapping, message overhead formula,
 * additive over arrays) rather than hard-coded counts that could shift
 * if upstream re-encodes the tables.
 */
import { describe, expect, it } from 'vitest';

import {
  type ChatMessage,
  countMessageTokens,
  countTokens,
  encodingForModel,
} from '../../src/services/ai/token-counter.js';

describe('encodingForModel', () => {
  it('routes gpt-5 family to o200k_base', () => {
    expect(encodingForModel('gpt-5.4-nano-2026-03-17')).toBe('o200k_base');
    expect(encodingForModel('gpt-5')).toBe('o200k_base');
    expect(encodingForModel('GPT-5-turbo')).toBe('o200k_base');
  });

  it('routes gpt-4o and gpt-4.1 to o200k_base', () => {
    expect(encodingForModel('gpt-4o')).toBe('o200k_base');
    expect(encodingForModel('gpt-4o-mini')).toBe('o200k_base');
    expect(encodingForModel('gpt-4.1-mini-2025-04-14')).toBe('o200k_base');
  });

  it('routes reasoning models (o1/o3/o4) to o200k_base', () => {
    expect(encodingForModel('o1')).toBe('o200k_base');
    expect(encodingForModel('o3-mini')).toBe('o200k_base');
    expect(encodingForModel('o4_preview')).toBe('o200k_base');
  });

  it('routes embedding models to cl100k_base', () => {
    expect(encodingForModel('text-embedding-3-small')).toBe('cl100k_base');
    expect(encodingForModel('text-embedding-3-large')).toBe('cl100k_base');
    expect(encodingForModel('text-embedding-ada-002')).toBe('cl100k_base');
  });

  it('routes legacy gpt-3.5/gpt-4 to cl100k_base', () => {
    expect(encodingForModel('gpt-3.5-turbo')).toBe('cl100k_base');
    expect(encodingForModel('gpt-4')).toBe('cl100k_base');
    expect(encodingForModel('gpt-4-32k')).toBe('cl100k_base');
  });

  it('falls back to cl100k_base for unknown models without throwing', () => {
    expect(encodingForModel('some-future-model')).toBe('cl100k_base');
    expect(encodingForModel('')).toBe('cl100k_base');
  });
});

describe('countTokens', () => {
  it('counts a simple string with cl100k_base', () => {
    const n = countTokens('text-embedding-3-small', 'hello world');
    // "hello world" is 2 BPE tokens in cl100k_base.
    expect(n).toBe(2);
  });

  it('counts a simple string with o200k_base', () => {
    const n = countTokens('gpt-4o', 'hello world');
    // o200k_base also tokenises "hello world" as 2 tokens.
    expect(n).toBe(2);
  });

  it('returns 0 for an empty string', () => {
    expect(countTokens('gpt-4o', '')).toBe(0);
  });

  it('is additive over an array of inputs', () => {
    const a = countTokens('gpt-4o', 'hello');
    const b = countTokens('gpt-4o', 'world');
    const sum = countTokens('gpt-4o', ['hello', 'world']);
    expect(sum).toBe(a + b);
  });

  it('grows monotonically with input length', () => {
    const short = countTokens('gpt-4o', 'a'.repeat(10));
    const long = countTokens('gpt-4o', 'a'.repeat(1000));
    expect(long).toBeGreaterThan(short);
  });
});

describe('countMessageTokens', () => {
  it('matches the published OpenAI message overhead formula', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
    // Formula: 3 (priming) + per-msg [3 (scaffolding) + tokens(role) + tokens(content)]
    const total = countMessageTokens('gpt-4o', messages);
    const baseline = 3 + 3 + countTokens('gpt-4o', 'user') + countTokens('gpt-4o', 'hello');
    expect(total).toBe(baseline);
  });

  it('adds 1 token of overhead when name is present', () => {
    const without = countMessageTokens('gpt-4o', [{ role: 'user', content: 'hi' }]);
    const withName = countMessageTokens('gpt-4o', [{ role: 'user', content: 'hi', name: 'alice' }]);
    expect(withName).toBe(without + 1 + countTokens('gpt-4o', 'alice'));
  });

  it('sums correctly across multiple messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const total = countMessageTokens('gpt-4o', messages);
    // priming (3) + 3 messages × 3 scaffold tokens = 12 base
    expect(total).toBeGreaterThan(12);
    // sanity: must exceed the sum of just the contents
    const contentSum = messages.reduce((n, m) => n + countTokens('gpt-4o', m.content), 0);
    expect(total).toBeGreaterThanOrEqual(contentSum);
  });
});
