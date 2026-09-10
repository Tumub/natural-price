import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type { Observation } from '@natural-price/extension';
import { stripUrl } from '@natural-price/extension';
import { CleanFetcher } from './browser';
import { compare, type Comparison } from './compare';
import { RateLimiter } from './ratelimit';

/**
 * Two routes.
 *   POST /check  { observation, installId }  -> Comparison   (what the extension calls)
 *   POST /fetch  { url }                      -> CleanResult[] (debugging)
 *   GET  /health
 * Logs carry no IP, no install id, no URL query. See PRIVACY.md.
 */

export interface ServerOptions {
  fetcher: CleanFetcher;
  limiter?: RateLimiter;
  /** Only fetch URLs on these hosts (suffix match). Empty means any host. */
  allowedHosts?: string[];
  /** How many exits to use per check. */
  fetchesPerCheck?: number;
}

const MAX_BODY = 16 * 1024;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function isObservation(x: unknown): x is Observation {
  const o = x as Observation;
  return (
    !!o && typeof o === 'object' &&
    typeof o.productKey === 'string' && typeof o.price === 'number' && o.price > 0 &&
    typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency) &&
    typeof o.url === 'string' && typeof o.observedAt === 'string'
  );
}

function hostAllowed(url: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const h = new URL(url).hostname;
  return allowed.some((a) => h === a || h.endsWith('.' + a));
}

export function createApp(opts: ServerOptions) {
  const limiter = opts.limiter ?? new RateLimiter();
  const perCheck = opts.fetchesPerCheck ?? 2;

  return createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.method === 'GET' && path === '/health') return json(res, 200, { ok: true, exits: opts.fetcher.exitLabels });
    if (req.method !== 'POST') return json(res, 404, { error: 'not found' });

    let body: any;
    try {
      body = await readJson(req);
    } catch (e) {
      return json(res, 400, { error: (e as Error).message });
    }

    if (path === '/fetch') {
      if (typeof body.url !== 'string' || !/^https?:\/\//.test(body.url)) return json(res, 400, { error: 'url required' });
      const url = stripUrl(body.url);
      if (!hostAllowed(url, opts.allowedHosts)) return json(res, 403, { error: 'host not allowed' });
      if (!limiter.allow('fetch:' + hash(String(body.installId ?? 'anon')))) return json(res, 429, { error: 'rate limited' });
      return json(res, 200, await opts.fetcher.fetchMany(url, perCheck));
    }

    if (path === '/check') {
      if (!isObservation(body.observation)) return json(res, 400, { error: 'observation malformed' });
      if (typeof body.installId !== 'string' || body.installId.length < 8) return json(res, 400, { error: 'installId required' });
      const yours = body.observation;
      const url = stripUrl(yours.url);
      if (!hostAllowed(url, opts.allowedHosts)) return json(res, 403, { error: 'host not allowed' });
      if (!limiter.allow('check:' + hash(body.installId))) return json(res, 429, { error: 'rate limited' });
      const started = Date.now();
      const cleans = await opts.fetcher.fetchMany(url, perCheck);
      const result: Comparison = compare({ ...yours, url }, cleans);
      console.log(JSON.stringify({ t: new Date().toISOString(), host: new URL(url).hostname, ms: Date.now() - started, statuses: cleans.map((c) => c.status), verdict: result.verdict }));
      return json(res, 200, result);
    }

    return json(res, 404, { error: 'not found' });
  });
}

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
