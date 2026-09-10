import { describe, expect, it } from 'vitest';
import { Breaker } from '../src/breaker';

describe('Breaker', () => {
  it('opens after the threshold inside the window and closes after cooldown or success', () => {
    const b = new Breaker(3, 10 * 60_000, 15 * 60_000);
    const t = 1_000_000_000;
    b.recordBlocked('h', t);
    b.recordBlocked('h', t + 1000);
    expect(b.isOpen('h', t + 2000)).toBe(false);
    b.recordBlocked('h', t + 2000);
    expect(b.isOpen('h', t + 3000)).toBe(true);
    expect(Object.keys(b.snapshot(t + 3000))).toEqual(['h']);
    expect(b.isOpen('h', t + 16 * 60_000)).toBe(false);
    b.recordBlocked('h', t + 20 * 60_000);
    b.recordBlocked('h', t + 20 * 60_000);
    b.recordBlocked('h', t + 20 * 60_000);
    expect(b.isOpen('h', t + 20 * 60_000 + 1)).toBe(true);
    b.recordOk('h');
    expect(b.isOpen('h', t + 20 * 60_000 + 2)).toBe(false);
  });
  it('ignores old blocks outside the window', () => {
    const b = new Breaker(2, 60_000, 60_000);
    b.recordBlocked('h', 0);
    b.recordBlocked('h', 120_000);
    expect(b.isOpen('h', 120_001)).toBe(false);
  });
});
