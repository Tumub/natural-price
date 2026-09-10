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

export interface ExitLocation {
  label: string;
  /** Playwright proxy config, or undefined for the server's own connection. */
  proxy?: { server: string; username?: string; password?: string };
}

/**
 * Locale and timezone that match the exit's country. A Swiss IP with a
 * UTC clock and en-US locale is a fingerprint in itself. The label's first
 * two letters are read as a country code; anything else gets a neutral
 * profile.
 */
const PROFILES: Record<string, { locale: string; timezoneId: string; acceptLanguage: string }> = {
  ch: { locale: 'de-CH', timezoneId: 'Europe/Zurich', acceptLanguage: 'de-CH,de;q=0.9,en;q=0.8' },
  de: { locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8' },
  at: { locale: 'de-AT', timezoneId: 'Europe/Vienna', acceptLanguage: 'de-AT,de;q=0.9,en;q=0.8' },
  fr: { locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' },
  it: { locale: 'it-IT', timezoneId: 'Europe/Rome', acceptLanguage: 'it-IT,it;q=0.9,en;q=0.8' },
  nl: { locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', acceptLanguage: 'nl-NL,nl;q=0.9,en;q=0.8' },
  es: { locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptLanguage: 'es-ES,es;q=0.9,en;q=0.8' },
  gb: { locale: 'en-GB', timezoneId: 'Europe/London', acceptLanguage: 'en-GB,en;q=0.9' },
  uk: { locale: 'en-GB', timezoneId: 'Europe/London', acceptLanguage: 'en-GB,en;q=0.9' },
  us: { locale: 'en-US', timezoneId: 'America/New_York', acceptLanguage: 'en-US,en;q=0.9' },
};
const NEUTRAL = { locale: 'en-US', timezoneId: 'UTC', acceptLanguage: 'en-US,en;q=0.9' };

export function profileFor(label: string) {
  return PROFILES[label.slice(0, 2).toLowerCase()] ?? NEUTRAL;
}

/** A desktop Chrome user agent whose major version matches the real browser. */
function userAgentFor(version: string): string {
  const major = version.split('.')[0] ?? '128';
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
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
  private userAgent = userAgentFor('128');
  private inFlight = 0;
  constructor(
    private exits: ExitLocation[],
    private maxConcurrent = 2,
    private timeoutMs = 20_000,
  ) {}

  async start(): Promise<void> {
    // Full Chromium in new headless mode, not the headless shell: closer to a
    // real browser in every fingerprintable way.
    this.browser = await chromium.launch({ channel: 'chromium', headless: true });
    this.userAgent = userAgentFor(this.browser.version());
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
    const profile = profileFor(exit.label);
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      ...(exit.proxy ? { proxy: exit.proxy } : {}),
      extraHTTPHeaders: { 'accept-language': profile.acceptLanguage },
    });
    try {
      // The one automation tell that is cheap to remove.
      await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined, configurable: true });
      });
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
      const msg = firstLine((e as Error).message);
      // Full Chromium turns an HTTP error with an empty body into a navigation
      // failure. Ask once more, cheaply, what the status actually was.
      if (/ERR_HTTP_RESPONSE_CODE_FAILURE/.test(msg)) {
        const status = await context.request.get(url, { maxRedirects: 5, timeout: 5_000 }).then((r) => r.status()).catch(() => 0);
        const blocked = status === 403 || status === 429 || status === 503;
        return { observation: null, status: blocked ? 'blocked' : 'no_price', exitLocation: exit.label, reason: `http ${status}, empty body` };
      }
      return { observation: null, status: 'error', exitLocation: exit.label, reason: msg };
    } finally {
      this.inFlight--;
      await context.close();
    }
  }
}

function firstLine(s: string): string {
  return (s.split('\n')[0] ?? s).slice(0, 160);
}

function tryExtract(html: string, url: string, now: Date): Observation | null {
  try {
    return extract(parseHtml(html, url), new URL(url), now);
  } catch {
    return null;
  }
}
