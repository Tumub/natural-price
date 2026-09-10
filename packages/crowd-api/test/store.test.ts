import { describe, expect, it } from 'vitest';
import type { Observation } from '@natural-price/extension';
import { CrowdStore } from '../src/store';

const at = new Date('2026-11-03T14:20:00Z');
const obs = (price: number, over: Partial<Observation> = {}): Observation => ({
  productKey: '4006381333931', productKeyType: 'gtin', price, currency: 'CHF', country: 'CH',
  url: 'https://shop.example/p/1', observedAt: at.toISOString(), source: 'jsonld', extractor: 'jsonld', ...over,
});
const id = (i: number) => i.toString(16).padStart(64, '0');

describe('CrowdStore', () => {
  it('aggregates per hour and per day with a correct median', () => {
    const s = new CrowdStore(':memory:', 'secret');
    for (const [i, p] of [100, 102, 98, 150, 101, 99].entries()) s.add(obs(p), id(i), at);
    const h = s.aggregate('4006381333931', 'CHF', 'CH', 'hour', at)!;
    expect(h).toMatchObject({ window: 'hour', bucket: '2026-11-03T14', n: 6, installs: 6, min: 98, max: 150, median: 100.5 });
    s.add(obs(97), id(9), new Date('2026-11-03T09:00:00Z'));
    expect(s.aggregate('4006381333931', 'CHF', 'CH', 'hour', at)!.n).toBe(6);
    const d = s.aggregate('4006381333931', 'CHF', 'CH', 'day', at)!;
    expect(d).toMatchObject({ window: 'day', bucket: '2026-11-03', n: 7, installs: 7, median: 100 });
    expect(s.aggregate('other', 'CHF', 'CH', 'hour', at)).toBeNull();
    expect(s.aggregate('4006381333931', 'EUR', 'CH', 'hour', at)).toBeNull();
    expect(s.aggregate('4006381333931', 'CHF', 'DE', 'hour', at)).toBeNull();
  });

  it('lets one install count once per product per hour', () => {
    const s = new CrowdStore(':memory:', 'secret');
    s.add(obs(100), id(1), at);
    s.add(obs(500), id(1), at);
    s.add(obs(500), id(1), at);
    const h = s.aggregate('4006381333931', 'CHF', 'CH', 'hour', at)!;
    expect(h).toMatchObject({ n: 1, installs: 1, median: 500 });
  });

  it('salts install hashes per day so they cannot be joined', () => {
    const s = new CrowdStore(':memory:', 'secret');
    expect(s.installHash('abc', '2026-11-03')).not.toBe(s.installHash('abc', '2026-11-04'));
    expect(s.installHash('abc', '2026-11-03')).toBe(s.installHash('abc', '2026-11-03'));
    expect(new CrowdStore(':memory:', 'other').installHash('abc', '2026-11-03')).not.toBe(s.installHash('abc', '2026-11-03'));
  });

  it('exports a day as aggregates only', () => {
    const s = new CrowdStore(':memory:', 'secret');
    for (const i of [1, 2, 3]) s.add(obs(10 + i), id(i), at);
    s.add(obs(50, { productKey: 'X', productKeyType: 'sku' }), id(4), at);
    const rows = s.exportDay('2026-11-03');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ productKey: '4006381333931', host: 'shop.example', bucket: '2026-11-03T14', n: 3, median: 12 });
    expect(JSON.stringify(rows)).not.toMatch(/install_hash|[0-9a-f]{64}|\/p\/1/);
    expect(s.exportDay('2026-11-04')).toEqual([]);
    expect(s.count()).toBe(4);
  });
});
