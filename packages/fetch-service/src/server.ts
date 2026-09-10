import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import type { Observation } from '@natural-price/extension';
import { stripUrl } from '@natural-price/extension';
import { RateLimiter, json, pathOf, readJson, validateCheckBody } from '@natural-price/shared';
import { CleanFetcher } from './browser';
import { Breaker } from './breaker';
import { compare, type CleanResult, type Comparison } from './compare';
import { CrowdClient } from './crowd';
import { Stats } from './stats';

/**
 * Two routes.
 *   POST /check  { observation, installId }  -> Comparison   (what the extension calls)
 *   POST /fetch  { url }                      -> CleanResult[] (debugging)
 *   GET  /health                              -> exits, paused hosts
 *   GET  /stats                               -> per-host per-day counters
 * Logs carry no IP, no install id, no URL query. See PRIVACY.md.
 */

export interface ServerOptions {
  fetcher: CleanFetcher;
  limiter?: RateLimiter;
  /** Only fetch URLs on these hosts (suffix match). Empty means any host. */
  allowedHosts?: string[];
  /** How many exits to use per check. */
  fetchesPerCheck?: number;
  breaker?: Breaker;
  stats?: Stats;
  /** Crowd API client. Unset means no crowd baseline. */
  crowd?: CrowdClient;
}

function hostAllowed(url: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const h = new URL(url).hostname;
  return allowed.some((a) => h === a || h.endsWith('.' + a));
}

export function createApp(opts: ServerOptions) {
  const limiter = opts.limiter ?? new RateLimiter();
  const perCheck = opts.fetchesPerCheck ?? 2;
  const breaker = opts.breaker ?? new Breaker();
  const stats = opts.stats ?? new Stats();

  /** Fetch through the breaker: a paused host is not touched. */
  async function guardedFetch(url: string): Promise<CleanResult[]> {
    const host = new URL(url).hostname;
    if (breaker.isOpen(host)) return [{ observation: null, status: 'blocked', exitLocation: 'none', reason: 'circuit open: recent fetches to this site were blocked' }];
    const cleans = await opts.fetcher.fetchMany(url, perCheck);
    if (cleans.some((c) => c.status === 'ok')) breaker.recordOk(host);
    else if (cleans.some((c) => c.status === 'blocked')) breaker.recordBlocked(host);
    return cleans;
  }

  return createServer(async (req, res) => {
    const { path } = pathOf(req);
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.method === 'GET' && path === '/health') return json(res, 200, { ok: true, exits: opts.fetcher.exitLabels, paused: breaker.snapshot(), crowd: !!opts.crowd });
    if (req.method === 'GET' && path === '/stats') return json(res, 200, { successRate: stats.successRate(), days: stats.snapshot() });
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
      return json(res, 200, await guardedFetch(url));
    }

    if (path === '/check') {
      const v = validateCheckBody(body);
      if (!v.ok) return json(res, 400, { error: 'payload does not match docs/payload-schema.json', details: v.errors });
      const yours = body.observation as Observation;
      const url = stripUrl(yours.url);
      if (!hostAllowed(url, opts.allowedHosts)) return json(res, 403, { error: 'host not allowed' });
      if (!limiter.allow('check:' + hash(body.installId))) return json(res, 429, { error: 'rate limited' });
      const started = Date.now();
      // Clean fetch and crowd lookup run side by side; the crowd never delays the badge beyond its own timeout.
      const [cleans, crowd] = await Promise.all([guardedFetch(url), opts.crowd ? opts.crowd.observe({ ...yours, url }, body.installId) : Promise.resolve(null)]);
      const result: Comparison = compare({ ...yours, url }, cleans, crowd);
      stats.record(new URL(url).hostname, cleans, result.verdict);
      console.log(JSON.stringify({ t: new Date().toISOString(), host: new URL(url).hostname, ms: Date.now() - started, statuses: cleans.map((c) => c.status), verdict: result.verdict }));
      return json(res, 200, result);
    }

    return json(res, 404, { error: 'not found' });
  });
}

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
