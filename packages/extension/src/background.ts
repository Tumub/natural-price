import { getInstallId } from './install-id';
import type { CheckRequest, CheckResponse, OpenPrivateRequest, OpenPrivateResponse } from './messages';

/**
 * The only network call the extension makes: POST the observation to the
 * fetch service. Runs here rather than in the content script so the page's
 * own CSP and cookies play no part.
 */
async function check(req: CheckRequest): Promise<CheckResponse> {
  const { serviceUrl } = (await chrome.storage.local.get({ serviceUrl: __SERVICE_URL__ })) as { serviceUrl: string };
  const installId = await getInstallId();
  const res = await fetch(new URL('/check', serviceUrl).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ observation: req.observation, installId }),
  });
  if (!res.ok) throw new Error(`service answered ${res.status}`);
  return (await res.json()) as CheckResponse;
}

/**
 * Open the page in an incognito window. Works only when the user has allowed
 * the extension in incognito; otherwise Chrome throws and the content script
 * falls back to copying the link.
 */
async function openPrivate(req: OpenPrivateRequest): Promise<OpenPrivateResponse> {
  try {
    await chrome.windows.create({ url: req.url, incognito: true, focused: true });
    return { opened: true };
  } catch (e) {
    return { opened: false, reason: (e as Error).message };
  }
}

chrome.runtime.onMessage.addListener((msg: CheckRequest | OpenPrivateRequest, _sender, sendResponse) => {
  if (msg?.type === 'check') {
    check(msg).then(sendResponse, (e: Error) => sendResponse({ error: e.message } satisfies Partial<CheckResponse>));
    return true;
  }
  if (msg?.type === 'open-private') {
    openPrivate(msg).then(sendResponse);
    return true;
  }
  return false;
});
