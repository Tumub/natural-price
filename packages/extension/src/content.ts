import { extract } from './extractors/index';
import { createBadge, type Badge } from './badge';
import type { CheckRequest, CheckResponse, OpenPrivateRequest, OpenPrivateResponse } from './messages';
import { normalizeUrl } from './extractors/index';
import { getSettings, SERVER_SITES } from './settings';

/**
 * Runs on product pages of the launch sites. Reads the price, asks the
 * background worker to check it, shows the badge. Re-runs when a
 * single-page app changes the URL without a reload, and keeps trying for
 * a while after each change because app-style sites fill in the product
 * data after navigation.
 */

let badge: Badge | null = null;
let lastUrl = '';
let attempts = 0;
/** Ticks of 1.5 s to keep looking for a price after a URL change: 30 s. */
const MAX_ATTEMPTS = 20;

/** Sites with a tested reader. Everything else needs "all websites" switched on. */
function isTestedSite(url: URL): boolean {
  return SERVER_SITES.some((s) => url.hostname === s || url.hostname.endsWith('.' + s));
}

async function run(): Promise<void> {
  const url = new URL(location.href);
  const settings = await getSettings();
  if (!settings.allSites && !isTestedSite(url)) return;
  const key = url.origin + url.pathname;
  if (key !== lastUrl) {
    lastUrl = key;
    attempts = 0;
    badge?.remove();
    badge = null;
  }
  if (badge || attempts >= MAX_ATTEMPTS) return;
  attempts++;

  const obs = extract(document, url);
  if (!obs) return;
  const privateUrl = normalizeUrl(url);
  const current = createBadge(obs, {
    openPrivate: async () => {
      const res = (await chrome.runtime.sendMessage({ type: 'open-private', url: privateUrl } satisfies OpenPrivateRequest)) as OpenPrivateResponse | undefined;
      if (res?.opened) return 'Opened. Compare the price there before you buy.';
      try {
        await navigator.clipboard.writeText(privateUrl);
        return 'Link copied. Open a private window (Cmd+Shift+N, or Ctrl+Shift+N on Windows) and paste it.';
      } catch {
        return `Open a private window and paste this link: ${privateUrl}`;
      }
    },
  });
  badge = current;
  current.checking();
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'check', observation: obs } satisfies CheckRequest)) as CheckResponse | undefined;
    if (!res) current.error('no answer from the extension');
    else if (res.probe) {
      // This tab is the extension's own clean session; nobody is looking at it.
      current.remove();
      badge = null;
    } else current.result(res);
  } catch (e) {
    current.error((e as Error).message);
  }
}

void run();
setInterval(() => void run(), 1500);
