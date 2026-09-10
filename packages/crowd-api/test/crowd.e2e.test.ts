import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { RateLimiter } from '@natural-price/shared';
import { createCrowdApp } from '../src/server';
import { CrowdStore } from '../src/store';

const id = (i: number) => i.toString(16).padStart(64, '0');
const observation = (price: number) => ({
  productKey: '111', productKeyType: 'sku', price, currency: 'CHF', country: 'CH',
  url: 'https://www.ikea.com/ch/en/p/x/', observedAt: new Date().toISOString(), source: 'jsonld', extractor: 'jsonld',
});

describe('crowd-api', () => {
  let app: Server;
  let api: string;
  beforeAll(async () => {
    app = createCrowdApp({ store: new CrowdStore(':memory:', 's'), allowedHosts: ['ikea.com'], limiter: new RateLimiter(3, 100) });
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  });
  afterAll(() => app.close());
  const post = (body: unknown) => fetch(api + '/observe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => [r.status, (await r.json()) as any] as const);

  it('stores observations and answers with the crowd', async () => {
    for (const i of [1, 2, 3, 4, 5]) expect((await post({ observation: observation(100 + i), installId: id(i) }))[0]).toBe(200);
    const [status, r] = await post({ observation: observation(120), installId: id(6) });
    expect(status).toBe(200);
    expect(r.hour).toMatchObject({ n: 6, installs: 6, median: 103.5, min: 101, max: 120 });
    const g = (await fetch(api + '/aggregate?productKey=111&currency=CHF&country=CH').then((r) => r.json())) as any;
    expect(g.day.n).toBe(6);
  });

  it('rejects bad payloads, other hosts and rate abuse', async () => {
    expect((await post({ observation: { ...observation(1), extra: 1 }, installId: id(7) }))[0]).toBe(400);
    expect((await post({ observation: { ...observation(1), url: 'https://evil.example/' }, installId: id(7) }))[0]).toBe(403);
    for (let i = 0; i < 3; i++) await post({ observation: observation(1), installId: id(8) });
    expect((await post({ observation: observation(1), installId: id(8) }))[0]).toBe(429);
  });

  it('exports a day under CC BY 4.0 with no identifiers', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const r = (await fetch(`${api}/export/${day}`).then((r) => r.json())) as any;
    expect(r.licence).toBe('CC-BY-4.0');
    expect(r.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/[0-9a-f]{64}|\/p\/x/);
    expect((await fetch(`${api}/export/nope`)).status).toBe(404);
  });
});
