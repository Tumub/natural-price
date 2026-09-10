import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/ratelimit';

describe('RateLimiter', () => {
  it('limits per minute and per day', () => {
    const l = new RateLimiter(2, 3);
    const t = 1_000_000;
    expect(l.allow('k', t)).toBe(true);
    expect(l.allow('k', t + 1)).toBe(true);
    expect(l.allow('k', t + 2)).toBe(false);
    expect(l.allow('k', t + 61_000)).toBe(true);
    expect(l.allow('k', t + 122_000)).toBe(false); // day cap of 3 reached
    expect(l.allow('other', t)).toBe(true);
  });
});
