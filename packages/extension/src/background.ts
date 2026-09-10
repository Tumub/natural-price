import { getInstallId } from './install-id';
import type { CheckRequest, CheckResponse } from './messages';

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

chrome.runtime.onMessage.addListener((msg: CheckRequest, _sender, sendResponse) => {
  if (msg?.type !== 'check') return false;
  check(msg).then(sendResponse, (e: Error) => sendResponse({ error: e.message } satisfies Partial<CheckResponse>));
  return true;
});
