import { extract } from './extractors/index';
import { createBadge, type Badge } from './badge';
import type { CheckRequest, CheckResponse } from './messages';

/**
 * Runs on product pages of the launch sites. Reads the price, asks the
 * background worker to check it, shows the badge. Re-runs when a
 * single-page app changes the URL without a reload.
 */

let badge: Badge | null = null;
let lastUrl = '';

async function run(): Promise<void> {
  const url = new URL(location.href);
  const key = url.origin + url.pathname;
  if (key === lastUrl) return;
  lastUrl = key;
  badge?.remove();
  badge = null;

  const obs = extract(document, url);
  if (!obs) return;
  badge = createBadge(obs);
  badge.checking();
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'check', observation: obs } satisfies CheckRequest)) as CheckResponse | undefined;
    if (!res) badge.error('no answer from the extension');
    else badge.result(res);
  } catch (e) {
    badge.error((e as Error).message);
  }
}

void run();
setInterval(() => void run(), 1500);
