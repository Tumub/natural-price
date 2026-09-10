import type { Observation } from './types';

/**
 * A clean session on the user's own device: the page opened in a tab with
 * no cookies, login or history. Chrome: an incognito window, created
 * minimised and unfocused (the user must have allowed the extension in
 * incognito). Firefox: a temporary container tab in the background, no
 * window at all. The content script in that tab reads the price and sends
 * it here like any other page; we recognise the tab and resolve.
 *
 * Same IP and device as the user, so this baseline sees cookie, login and
 * history effects only. The server baseline sees location and device too.
 */

interface Pending {
  resolve: (r: ProbeResult) => void;
  cleanup: () => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}

export interface ProbeResult {
  observation: Observation | null;
  reason?: string;
}

const pending = new Map<number, Pending>();
const TIMEOUT_MS = 25_000;

type FirefoxApis = {
  contextualIdentities?: {
    create(d: { name: string; color: string; icon: string }): Promise<{ cookieStoreId: string }>;
    remove(id: string): Promise<unknown>;
  };
};

export function isProbeTab(tabId: number | undefined): boolean {
  return tabId !== undefined && pending.has(tabId);
}

/** Called by the message handler when a probe tab reports its observation. */
export function resolveProbe(tabId: number, observation: Observation): void {
  const p = pending.get(tabId);
  if (!p) return;
  finish(tabId, p, { observation });
}

async function finish(tabId: number, p: Pending, r: ProbeResult): Promise<void> {
  pending.delete(tabId);
  clearTimeout(p.timer);
  p.resolve(r);
  await p.cleanup().catch(() => undefined);
}

/** Open the page in a clean tab and wait for its observation. Never throws. */
export async function probe(url: string): Promise<ProbeResult> {
  const ff = (globalThis as unknown as { browser?: FirefoxApis }).browser;
  try {
    if (ff?.contextualIdentities) return await probeInContainer(url, ff.contextualIdentities);
    return await probeInIncognito(url);
  } catch (e) {
    return { observation: null, reason: (e as Error).message };
  }
}

function waitFor(tabId: number, cleanup: () => Promise<void>): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const p = pending.get(tabId);
      if (p) void finish(tabId, p, { observation: null, reason: 'the private tab did not report a price in time' });
    }, TIMEOUT_MS);
    pending.set(tabId, { resolve, cleanup, timer });
  });
}

async function probeInIncognito(url: string): Promise<ProbeResult> {
  const allowed = await chrome.extension.isAllowedIncognitoAccess();
  if (!allowed) {
    return { observation: null, reason: 'private tab needs "Allow in Incognito" for this extension in chrome://extensions' };
  }
  const win = await chrome.windows.create({ url, incognito: true, focused: false, state: 'minimized' });
  const tabId = win?.tabs?.[0]?.id;
  if (!win?.id || tabId === undefined) {
    if (win?.id) await chrome.windows.remove(win.id).catch(() => undefined);
    return { observation: null, reason: 'could not open a private window' };
  }
  const winId = win.id;
  return waitFor(tabId, () => chrome.windows.remove(winId).then(() => undefined));
}

async function probeInContainer(url: string, ci: NonNullable<FirefoxApis['contextualIdentities']>): Promise<ProbeResult> {
  const identity = await ci.create({ name: 'Natural Price clean session', color: 'grey', icon: 'fingerprint' });
  const tab = await chrome.tabs.create({ url, active: false, cookieStoreId: identity.cookieStoreId } as chrome.tabs.CreateProperties);
  if (tab.id === undefined) {
    await ci.remove(identity.cookieStoreId);
    return { observation: null, reason: 'could not open a container tab' };
  }
  const tabId = tab.id;
  return waitFor(tabId, async () => {
    await chrome.tabs.remove(tabId).catch(() => undefined);
    await ci.remove(identity.cookieStoreId);
  });
}
