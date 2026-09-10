import { describe, expect, it } from 'vitest';
import type { Observation } from '@natural-price/extension';
import { CrowdStore } from '../src/store';

const obs = (over: Partial<Observation> = {}): Observation => ({
  productKey: 'p1', productKeyType: 'sku', price: 10, currency: 'CHF', country: 'CH',
  url: 'https://shop.example/p/1', observedAt: '2026-11-03T14:00:00Z', source: 'jsonld', extractor: 'jsonld', ...over,
});
const id = (i: number) => i.toString(16).padStart(64, '0');

describe('retention', () => {
  it('deletes raw rows past the window and keeps the rest', () => {
    const s = new CrowdStore(':memory:', 'secret');
    const now = new Date('2026-11-03T14:00:00Z');
    s.add(obs(), id(1), new Date('2026-06-01T10:00:00Z')); // 155 days old
    s.add(obs(), id(2), new Date('2026-10-20T10:00:00Z')); // 14 days old
    s.add(obs(), id(3), now);
    expect(s.count()).toBe(3);
    expect(s.purge(90, now)).toBe(1);
    expect(s.count()).toBe(2);
    expect(s.purge(90, now)).toBe(0);
    expect(s.aggregate('p1', 'CHF', 'CH', 'day', now)!.n).toBe(1);
  });
});
