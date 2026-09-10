import { createServer } from 'node:http';
import type { Observation } from '@natural-price/extension';
import { RateLimiter, json, pathOf, readJson, validateCheckBody } from '@natural-price/shared';
import type { CrowdStore } from './store';

/**
 *   POST /observe        { observation, installId } -> CrowdAnswer   (stores, then answers)
 *   GET  /aggregate?productKey&currency&country     -> CrowdAnswer   (read only)
 *   GET  /export/YYYY-MM-DD                          -> open dataset for that day
 *   GET  /health
 * The body is the same schema the fetch service accepts. No URL is stored,
 * only its hostname. No timestamp finer than the hour.
 */
export interface CrowdServerOptions {
  store: CrowdStore;
  limiter?: RateLimiter;
  /** Only hostnames in this list are accepted (suffix match). Empty means any. */
  allowedHosts?: string[];
}

function hostAllowed(url: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const h = new URL(url).hostname;
  return allowed.some((a) => h === a || h.endsWith('.' + a));
}

export function createCrowdApp(opts: CrowdServerOptions) {
  const limiter = opts.limiter ?? new RateLimiter(30, 500);
  return createServer(async (req, res) => {
    const { path, query } = pathOf(req);
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.method === 'GET' && path === '/health') return json(res, 200, { ok: true, observations: opts.store.count() });
    if (req.method === 'GET' && path === '/aggregate') {
      const productKey = query.get('productKey');
      const currency = query.get('currency');
      if (!productKey || !currency || !/^[A-Z]{3}$/.test(currency)) return json(res, 400, { error: 'productKey and currency required' });
      return json(res, 200, opts.store.answer(productKey, currency, query.get('country') ?? undefined));
    }
    const exp = /^\/export\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    if (req.method === 'GET' && exp) return json(res, 200, { day: exp[1], licence: 'CC-BY-4.0', rows: opts.store.exportDay(exp[1]!) });
    if (req.method === 'POST' && path === '/observe') {
      let body: any;
      try {
        body = await readJson(req);
      } catch (e) {
        return json(res, 400, { error: (e as Error).message });
      }
      const v = validateCheckBody(body);
      if (!v.ok) return json(res, 400, { error: 'payload does not match docs/payload-schema.json', details: v.errors });
      const o = body.observation as Observation;
      if (!hostAllowed(o.url, opts.allowedHosts)) return json(res, 403, { error: 'host not allowed' });
      if (!limiter.allow(body.installId)) return json(res, 429, { error: 'rate limited' });
      opts.store.add(o, body.installId);
      return json(res, 200, opts.store.answer(o.productKey, o.currency, o.country));
    }
    return json(res, 404, { error: 'not found' });
  });
}
