import { describe, expect, it } from 'vitest';
import type { Observation } from '@natural-price/extension';
import { compare, type CleanResult } from '../src/compare';

const now = new Date('2026-09-10T10:00:00Z');
const obs = (over: Partial<Observation> = {}): Observation => ({
  productKey: '123', productKeyType: 'sku', price: 100, currency: 'CHF', country: 'CH',
  url: 'https://shop.example/p/1', observedAt: '2026-09-10T09:58:00Z', source: 'jsonld', extractor: 'jsonld', ...over,
});
const ok = (price: number, exit = 'direct', over: Partial<Observation> = {}): CleanResult => ({ observation: obs({ price, ...over }), status: 'ok', exitLocation: exit });

describe('compare', () => {
  it('same within half a percent', () => {
    const r = compare(obs(), [ok(100.3)], now);
    expect(r).toMatchObject({ comparable: true, verdict: 'same', confidence: 'low' });
  });
  it('higher and lower', () => {
    expect(compare(obs({ price: 110 }), [ok(100)], now)).toMatchObject({ verdict: 'higher', difference: 0.1 });
    expect(compare(obs({ price: 90 }), [ok(100)], now)).toMatchObject({ verdict: 'lower', difference: -0.1 });
  });
  it('medium confidence needs two agreeing exits', () => {
    expect(compare(obs(), [ok(100, 'a'), ok(100.2, 'b')], now).confidence).toBe('medium');
    expect(compare(obs(), [ok(100, 'a'), ok(100.2, 'a')], now).confidence).toBe('low');
    const r = compare(obs(), [ok(100, 'a'), ok(104, 'b')], now);
    expect(r.confidence).toBe('low');
    expect(r.reasons.join()).toMatch(/disagree/);
  });
  it('refuses currency, country, product and time mismatches', () => {
    expect(compare(obs(), [ok(100, 'd', { currency: 'EUR' })], now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { country: 'DE' })], now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { productKey: '999' })], now).comparable).toBe(false);
    expect(compare(obs({ observedAt: '2026-09-10T09:00:00Z' }), [ok(100)], now).comparable).toBe(false);
    expect(compare(obs(), [ok(100, 'd', { observedAt: '2026-09-10T11:00:00Z' })], now).comparable).toBe(false);
  });
  it('matches on url when key types differ, and tolerates a missing country', () => {
    expect(compare(obs(), [ok(100, 'd', { productKeyType: 'url', productKey: 'https://shop.example/p/1' })], now).comparable).toBe(true);
    const r = compare(obs({ country: undefined }), [ok(100)], now);
    expect(r.comparable).toBe(true);
    expect(r.reasons.join()).toMatch(/assumed/);
  });
  it('reports blocked and no price', () => {
    expect(compare(obs(), [{ observation: null, status: 'blocked', exitLocation: 'd' }], now).reasons[0]).toMatch(/refused/);
    expect(compare(obs(), [{ observation: null, status: 'no_price', exitLocation: 'd' }], now).reasons[0]).toMatch(/no clean price/);
  });
});
