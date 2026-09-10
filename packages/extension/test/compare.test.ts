import { describe, expect, it } from 'vitest';
import type { Observation } from '../src/types';
import { compare, pickCrowd, type CleanResult, type CrowdAnswer } from '../src/compare';

const now = new Date('2026-09-10T10:00:00Z');
const obs = (over: Partial<Observation> = {}): Observation => ({
  productKey: '123', productKeyType: 'sku', price: 100, currency: 'CHF', country: 'CH',
  url: 'https://shop.example/p/1', observedAt: '2026-09-10T09:58:00Z', source: 'jsonld', extractor: 'jsonld', ...over,
});
const ok = (price: number, exit = 'direct', over: Partial<Observation> = {}): CleanResult => ({ observation: obs({ price, ...over }), status: 'ok', exitLocation: exit });

describe('compare', () => {
  it('same within half a percent', () => {
    const r = compare(obs(), [ok(100.3)], null, now);
    expect(r).toMatchObject({ comparable: true, verdict: 'same', confidence: 'low' });
  });
  it('higher and lower', () => {
    expect(compare(obs({ price: 110 }), [ok(100)], null, now)).toMatchObject({ verdict: 'higher', difference: 0.1 });
    expect(compare(obs({ price: 90 }), [ok(100)], null, now)).toMatchObject({ verdict: 'lower', difference: -0.1 });
  });
  it('medium confidence needs two agreeing exits', () => {
    expect(compare(obs(), [ok(100, 'a'), ok(100.2, 'b')], null, now).confidence).toBe('medium');
    expect(compare(obs(), [ok(100, 'a'), ok(100.2, 'a')], null, now).confidence).toBe('low');
    const r = compare(obs(), [ok(100, 'a'), ok(104, 'b')], null, now);
    expect(r.confidence).toBe('low');
    expect(r.reasons.join()).toMatch(/disagree/);
  });
  it('treats a private tab like any clean fetch and corroborates the server with it', () => {
    const r = compare(obs(), [ok(100, 'de'), ok(100.1, 'private-tab')], null, now);
    expect(r).toMatchObject({ comparable: true, confidence: 'medium', clean: { exitLocation: 'de' } });
    expect(r.reasons.join()).toMatch(/private tab on your device and the server agree/);
    expect(compare(obs({ price: 110 }), [ok(100, 'private-tab')], null, now)).toMatchObject({ verdict: 'higher', confidence: 'low', clean: { exitLocation: 'private-tab' } });
    expect(compare(obs(), [], null, now).reasons[0]).toMatch(/no clean session/);
  });
  it('refuses currency, country, product and time mismatches', () => {
    expect(compare(obs(), [ok(100, 'd', { currency: 'EUR' })], null, now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { country: 'DE' })], null, now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { productKey: '999' })], null, now).comparable).toBe(false);
    expect(compare(obs({ observedAt: '2026-09-10T09:00:00Z' }), [ok(100)], null, now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { observedAt: '2026-09-10T11:00:00Z' })], null, now).comparable).toBe(false);
  });
  it('matches on url when key types differ, and tolerates a missing country', () => {
    expect(compare(obs(), [ok(100, 'd', { productKeyType: 'url', productKey: 'https://shop.example/p/1' })], null, now).comparable).toBe(true);
    const r = compare(obs({ country: undefined }), [ok(100)], null, now);
    expect(r.comparable).toBe(true);
    expect(r.reasons.join()).toMatch(/assumed/);
  });
  it('reports blocked and no price', () => {
    expect(compare(obs(), [{ observation: null, status: 'blocked', exitLocation: 'd' }], null, now).reasons[0]).toMatch(/refused/);
    expect(compare(obs(), [{ observation: null, status: 'no_price', exitLocation: 'd' }], null, now).reasons[0]).toMatch(/no clean price/);
  });

  describe('with the crowd', () => {
    const agg = (installs: number, median: number, window: 'hour' | 'day' = 'hour') => ({ window, bucket: 'b', n: installs, installs, median, min: median - 1, max: median + 1 });
    it('needs five other installs, preferring this hour over today', () => {
      expect(pickCrowd({ hour: agg(5, 100), day: agg(20, 90) })).toBeUndefined;
      expect(pickCrowd({ hour: agg(5, 100), day: agg(20, 90) })?.median).toBe(90);
      expect(pickCrowd({ hour: agg(6, 100), day: agg(20, 90) })).toMatchObject({ window: 'hour', others: 5, median: 100 });
      expect(pickCrowd({ hour: null, day: null })).toBeUndefined();
      expect(pickCrowd(null)).toBeUndefined();
    });
    it('raises to high only when the crowd agrees with the clean fetch', () => {
      const crowd: CrowdAnswer = { hour: agg(10, 100.2), day: null };
      expect(compare(obs(), [ok(100)], crowd, now)).toMatchObject({ basis: 'clean', confidence: 'high', crowd: { others: 9 } });
      const off: CrowdAnswer = { hour: agg(10, 110), day: null };
      const r = compare(obs(), [ok(100)], off, now);
      expect(r.confidence).toBe('low');
      expect(r.reasons.join()).toMatch(/crowd median differ/);
    });
    it('falls back to the crowd when the clean fetch is blocked', () => {
      const crowd: CrowdAnswer = { hour: null, day: agg(8, 100, 'day') };
      const r = compare(obs({ price: 110 }), [{ observation: null, status: 'blocked', exitLocation: 'd' }], crowd, now);
      expect(r).toMatchObject({ comparable: true, basis: 'crowd', verdict: 'higher', confidence: 'medium' });
      expect(r.clean).toBeUndefined();
      expect(r.difference).toBeCloseTo(0.1);
      expect(compare(obs(), [{ observation: null, status: 'blocked', exitLocation: 'd' }], { hour: agg(3, 100), day: null }, now).comparable).toBe(false);
    });
  });
});
