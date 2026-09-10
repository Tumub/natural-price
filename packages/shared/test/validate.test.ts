import { describe, expect, it } from 'vitest';
import { validateCheckBody } from '../src/validate';

const good = {
  installId: 'a'.repeat(64),
  observation: { productKey: '123', productKeyType: 'sku', price: 10, currency: 'CHF', url: 'https://shop.example/p/1', observedAt: '2026-09-10T10:00:00Z', source: 'jsonld', extractor: 'jsonld', country: 'CH', name: 'Thing' },
};

describe('payload schema', () => {
  it('accepts exactly what PRIVACY.md lists', () => {
    expect(validateCheckBody(good)).toEqual({ ok: true });
  });
  it('rejects any field not in the schema, at either level', () => {
    expect(validateCheckBody({ ...good, email: 'x@y' }).ok).toBe(false);
    expect(validateCheckBody({ ...good, observation: { ...good.observation, cookie: 'abc' } }).ok).toBe(false);
  });
  it('rejects a raw install id, a bad currency and a non-positive price', () => {
    expect(validateCheckBody({ ...good, installId: 'not-hashed' }).ok).toBe(false);
    expect(validateCheckBody({ ...good, observation: { ...good.observation, currency: 'chf' } }).ok).toBe(false);
    expect(validateCheckBody({ ...good, observation: { ...good.observation, price: 0 } }).ok).toBe(false);
  });
});
