import { compare, type CleanResult } from './compare';
import { getInstallId } from './install-id';
import type { CheckRequest, CheckResponse, OpenPrivateRequest, OpenPrivateResponse } from './messages';
import { isProbeTab, probe, resolveProbe } from './probe';
import { getSettings, SERVER_ENABLED, serverAllowed } from './settings';

/**
 * Answers the content script's check.
 *
 * In the default mode nothing leaves the browser: the page is opened once
 * more in a private tab on this device, read, and the two prices compared
 * here with the same rules the server uses. There is no network call and no
 * server involved, on any website.
 *
 * The server is contacted only when the user has switched it on and only
 * for the companies in SERVER_SITES. Everything else falls back to the
 * device comparison.
 */
async function check(req: CheckRequest): Promise<CheckResponse> {
  const settings = await getSettings();
  const notes: string[] = [];
  const useServer = SERVER_ENABLED && settings.cleanMode !== 'local' && serverAllowed(req.observation.url);
  if (SERVER_ENABLED && settings.cleanMode !== 'local' && !useServer) {
    notes.push('this site is not one the server is allowed to contact, so the comparison stayed on your device');
  }

  // The private tab runs for every mode except server-only.
  let client: CleanResult[] = [];
  if (settings.cleanMode !== 'server' || !useServer) {
    const p = await probe(req.observation.url);
    if (p.observation) client = [{ observation: p.observation, status: 'ok', exitLocation: 'private-tab' }];
    else notes.push(`private tab: ${p.reason ?? 'no price read'}`);
  }

  if (!useServer) {
    const r = compare(req.observation, client);
    r.reasons = [...notes, 'compared on your device; nothing was sent to any server', ...r.reasons];
    return r;
  }

  const installId = await getInstallId();
  const body: Record<string, unknown> = { observation: req.observation, installId };
  if (client[0]?.observation) body.clientClean = client[0].observation;
  if (settings.cleanMode === 'both' && client.length === 0) notes.push('the server answered alone');

  const res = await fetch(new URL('/check', settings.serviceUrl).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`service answered ${res.status}`);
  const r = (await res.json()) as CheckResponse;
  r.reasons = [...notes, ...(r.reasons ?? [])];
  return r;
}

/**
 * Open the page in an incognito window for the user to compare. Works only
 * when the user has allowed the extension in incognito; otherwise Chrome
 * throws and the content script falls back to copying the link.
 */
async function openPrivate(req: OpenPrivateRequest): Promise<OpenPrivateResponse> {
  try {
    await chrome.windows.create({ url: req.url, incognito: true, focused: true });
    return { opened: true };
  } catch (e) {
    return { opened: false, reason: (e as Error).message };
  }
}

chrome.runtime.onMessage.addListener((msg: CheckRequest | OpenPrivateRequest, sender, sendResponse) => {
  if (msg?.type === 'check') {
    const tabId = sender.tab?.id;
    if (isProbeTab(tabId)) {
      // Our own clean-session tab reporting back. Not a user page.
      resolveProbe(tabId!, msg.observation);
      sendResponse({ probe: true } satisfies Partial<CheckResponse>);
      return false;
    }
    check(msg).then(sendResponse, (e: Error) => sendResponse({ error: e.message } satisfies Partial<CheckResponse>));
    return true;
  }
  if (msg?.type === 'open-private') {
    openPrivate(msg).then(sendResponse);
    return true;
  }
  return false;
});
