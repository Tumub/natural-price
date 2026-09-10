import { getInstallId } from './install-id';
import type { CheckRequest, CheckResponse, OpenPrivateRequest, OpenPrivateResponse } from './messages';
import { isProbeTab, probe, resolveProbe } from './probe';
import { getSettings } from './settings';

/**
 * The only network call the extension makes: POST the observation to the
 * fetch service. Runs here rather than in the content script so the page's
 * own CSP and cookies play no part. Depending on the setting, a clean
 * session on this device runs first and travels with the request.
 */
async function check(req: CheckRequest): Promise<CheckResponse> {
  const settings = await getSettings();
  const installId = await getInstallId();
  const body: Record<string, unknown> = { observation: req.observation, installId };
  const notes: string[] = [];

  if (settings.cleanMode !== 'server') {
    const p = await probe(req.observation.url);
    if (p.observation) body.clientClean = p.observation;
    else notes.push(`private tab: ${p.reason ?? 'no price read'}`);
    if (settings.cleanMode === 'private') body.skipServer = true;
  }

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
