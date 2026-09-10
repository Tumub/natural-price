import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { CleanFetcher } from '../src/browser';
import { CrowdClient } from '../src/crowd';
import { createApp } from '../src/server';
import { createCrowdApp } from '../../crowd-api/src/server';
import { CrowdStore } from '../../crowd-api/src/store';
import { expectedFor, startFixtureServer } from '../../../test-support/fixture-server';

/** Real headless Chromium, real HTTP, but only against locally served fixtures. */
const skip = !!process.env.NP_SKIP_BROWSER;

describe.skipIf(skip)('fetch-service end to end', () => {
  let fixtures: Awaited<ReturnType<typeof startFixtureServer>>;
  let fetcher: CleanFetcher;
  let app: Server;
  let api: string;
  let crowdApp: Server;
  let crowdApi: string;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    fetcher = new CleanFetcher([{ label: 'a' }, { label: 'b' }]);
    await fetcher.start();
    crowdApp = createCrowdApp({ store: new CrowdStore(':memory:', 'test') });
    await new Promise<void>((r) => crowdApp.listen(0, '127.0.0.1', r));
    crowdApi = `http://127.0.0.1:${(crowdApp.address() as AddressInfo).port}`;
    app = createApp({ fetcher, allowedHosts: ['127.0.0.1'], crowd: new CrowdClient(crowdApi) });
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    app?.close();
    crowdApp?.close();
    await fetcher?.stop();
    fixtures?.server.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => [r.status, await r.json()] as const);

  it('health lists exits', async () => {
    const r = await fetch(api + '/health').then((r) => r.json());
    expect(r).toEqual({ ok: true, exits: ['a', 'b'], paused: {}, crowd: true });
  });

  for (const [site, name] of [['ikea', 'billy-bookcase'], ['mediamarkt', 'samsung-soundbar'], ['nike', 'cw2288-111']] as const) {
    it(`${site}: same price reads as same, medium confidence`, async () => {
      const exp = await expectedFor(site, name);
      const observation = { ...exp.expect, url: fixtures.url(site, name), observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld' };
      const [status, r] = await post('/check', { observation, installId: 'a'.repeat(64) });
      expect(status).toBe(200);
      expect(r).toMatchObject({ comparable: true, verdict: 'same', confidence: 'medium' });
      expect(r.cleanFetches.map((c: any) => c.status)).toEqual(['ok', 'ok']);
    }, 60_000);
  }

  it('a higher price reads as higher with the right difference', async () => {
    const exp = await expectedFor('ikea', 'billy-bookcase');
    const observation = { ...exp.expect, price: exp.expect.price * 1.2, url: fixtures.url('ikea', 'billy-bookcase'), observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld' };
    const [, r] = await post('/check', { observation, installId: 'b'.repeat(64) });
    expect(r.verdict).toBe('higher');
    expect(r.difference).toBeCloseTo(0.2, 3);
  }, 60_000);

  it('rejects other hosts, bad bodies and stale observations', async () => {
    expect((await post('/check', { observation: { productKey: 'x', productKeyType: 'sku', price: 1, currency: 'CHF', url: 'https://example.org/p', observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld' }, installId: 'c'.repeat(64) }))[0]).toBe(403);
    expect((await post('/check', { observation: { price: 'no' }, installId: 'c'.repeat(64) }))[0]).toBe(400);
    const exp = await expectedFor('ikea', 'billy-bookcase');
    const [, r] = await post('/check', { observation: { ...exp.expect, url: fixtures.url('ikea', 'billy-bookcase'), observedAt: '2020-01-01T00:00:00Z', source: 'jsonld', extractor: 'jsonld' }, installId: 'd'.repeat(64) });
    expect(r.comparable).toBe(false);
  }, 60_000);

  it('reaches high confidence once enough other people saw the same price', async () => {
    const exp = await expectedFor('ikea', 'billy-bookcase');
    const mk = (price: number) => ({ ...exp.expect, price, url: fixtures.url('ikea', 'billy-bookcase'), observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld' });
    // Five other installs report the genuine price straight to the crowd API.
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(crowdApi + '/observe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ observation: mk(exp.expect.price), installId: i.toString(16).padStart(64, '0') }) });
      expect(r.status).toBe(200);
    }
    const [, r] = await post('/check', { observation: mk(exp.expect.price), installId: '9'.repeat(64) });
    // Earlier tests in this file already reported this product, so "others" is at least the five seeded here.
    expect(r).toMatchObject({ comparable: true, basis: 'clean', verdict: 'same', confidence: 'high', crowd: { window: 'hour', median: exp.expect.price } });
    expect(r.crowd.others).toBeGreaterThanOrEqual(5);
    // A crowd answer never carries anything but aggregates.
    expect(JSON.stringify(r.crowd)).not.toMatch(/[0-9a-f]{64}|billy/);
  }, 60_000);

  it('rejects a payload with a field outside the schema', async () => {
    const exp = await expectedFor('ikea', 'billy-bookcase');
    const observation = { ...exp.expect, url: fixtures.url('ikea', 'billy-bookcase'), observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld', sessionCookie: 'leak' };
    const [status, r] = await post('/check', { observation, installId: 'f'.repeat(64) });
    expect(status).toBe(400);
    expect(r.details.join()).toMatch(/additional/);
  });

  it('exposes stats with no identifiers', async () => {
    const r = await fetch(api + '/stats').then((r) => r.json());
    expect(r.successRate).toBeGreaterThan(0);
    const day = Object.keys(r.days)[0]!;
    expect(r.days[day]['127.0.0.1']).toMatchObject({ checks: expect.any(Number), ok: expect.any(Number) });
    expect(JSON.stringify(r)).not.toMatch(/[a-f]{64}|billy/);
  });

  it('reports no_price for a page without a product', async () => {
    const [, r] = await post('/fetch', { url: fixtures.origin + '/nope/nope.html', installId: 'e'.repeat(64) });
    expect(r[0].status).toBe('no_price');
  }, 60_000);
});
