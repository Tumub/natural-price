import { chromium, type Browser } from 'playwright';
import { extract, type Observation } from '@natural-price/extension';
import { parseHtml } from '@natural-price/extension/src/dom';
import type { CleanResult } from './compare';

/**
 * Clean-room fetch. One fresh browser context per request: no cookies, no
 * storage, a generic desktop profile, a neutral locale. The page is loaded
 * once, the same extractor the extension uses reads it, the context is
 * closed. Nothing is kept.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export interface ExitLocation {
  label: string;
  /** Playwright proxy config, or undefined for the server's own connection. */
  proxy?: { server: string; username?: string; password?: string };
}

/** NP_EXITS="direct;ch=http://user:pass@host:port;de=http://host:port" */
export function exitsFromEnv(env = process.env): ExitLocation[] {
  const raw = env.NP_EXITS?.trim();
  if (!raw) return [{ label: 'direct' }];
  return raw.split(';').map((part) => {
    const [label, server] = part.split('=', 2) as [string, string | undefined];
    if (!server) return { label: label.trim() };
    const u = new URL(server);
    const proxy: ExitLocation['proxy'] = { server: `${u.protocol}//${u.host}` };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return { label: label.trim(), proxy };
  });
}

const BLOCK_MARKERS = [/access denied/i, /captcha/i, /are you a robot/i, /unusual traffic/i, /request blocked/i, /cf-chl/i];

export class CleanFetcher {
  private browser: Browser | null = null;
  private inFlight = 0;
  constructor(
    private exits: ExitLocation[],
    private maxConcurrent = 2,
    private timeoutMs = 20_000,
  ) {}

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  get exitLabels(): string[] {
    return this.exits.map((e) => e.label);
  }

  /** Fetch from up to `count` distinct exits, in parallel. */
  async fetchMany(url: string, count: number, now = new Date()): Promise<CleanResult[]> {
    const chosen = this.exits.slice(0, Math.max(1, Math.min(count, this.exits.length)));
    return Promise.all(chosen.map((e) => this.fetchOne(url, e, now)));
  }

  async fetchOne(url: string, exit: ExitLocation, now = new Date()): Promise<CleanResult> {
    if (!this.browser) throw new Error('fetcher not started');
    if (this.inFlight >= this.maxConcurrent) return { observation: null, status: 'error', exitLocation: exit.label, reason: 'busy' };
    this.inFlight++;
    const context = await this.browser.newContext({
      userAgent: UA,
      locale: 'en-US',
      viewport: { width: 1366, height: 768 },
      ...(exit.proxy ? { proxy: exit.proxy } : {}),
      extraHTTPHeaders: { 'accept-language': 'en' },
    });
    try {
      const page = await context.newPage();
      // Images and media are not needed to read a price and only cost time.
      await page.route('**/*', (route) => {
        const t = route.request().resourceType();
        return ['image', 'media', 'font'].includes(t) ? route.abort() : route.continue();
      });
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
      const status = res?.status() ?? 0;
      const finalUrl = page.url();
      let html = await page.content();
      let obs = tryExtract(html, finalUrl, now);
      if (!obs) {
        // Some sites inject JSON-LD after hydration. Give them one more chance.
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
        html = await page.content();
        obs = tryExtract(html, finalUrl, now);
      }
      if (obs) return { observation: obs, status: 'ok', exitLocation: exit.label };
      if (status === 403 || status === 429 || status === 503 || BLOCK_MARKERS.some((m) => m.test(html.slice(0, 20_000)))) {
        return { observation: null, status: 'blocked', exitLocation: exit.label, reason: `http ${status}` };
      }
      return { observation: null, status: 'no_price', exitLocation: exit.label, reason: `http ${status}` };
    } catch (e) {
      return { observation: null, status: 'error', exitLocation: exit.label, reason: (e as Error).message.slice(0, 200) };
    } finally {
      this.inFlight--;
      await context.close();
    }
  }
}

function tryExtract(html: string, url: string, now: Date): Observation | null {
  try {
    return extract(parseHtml(html, url), new URL(url), now);
  } catch {
    return null;
  }
}
