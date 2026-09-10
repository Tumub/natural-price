import { DEFAULTS, getSettings, type CleanMode } from './settings';

const input = document.getElementById('serviceUrl') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const incognitoEl = document.getElementById('incognito') as HTMLParagraphElement;
const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cleanMode"]'));

async function load(): Promise<void> {
  const s = await getSettings();
  input.value = s.serviceUrl;
  for (const r of radios) r.checked = r.value === s.cleanMode;
  const isFirefox = typeof (globalThis as { browser?: { contextualIdentities?: unknown } }).browser?.contextualIdentities !== 'undefined';
  if (isFirefox) {
    incognitoEl.textContent = 'Firefox: the private tab runs in a temporary container in the background.';
  } else {
    const ok = await chrome.extension.isAllowedIncognitoAccess();
    incognitoEl.textContent = ok
      ? 'Chrome: incognito access is allowed; the private tab opens minimised and closes itself.'
      : 'Chrome: to use the private tab, open chrome://extensions, find Natural Price, Details, and switch on "Allow in Incognito".';
  }
}

document.getElementById('save')!.addEventListener('click', async () => {
  let origin: string;
  try {
    origin = new URL(input.value || DEFAULTS.serviceUrl).origin;
  } catch {
    statusEl.textContent = 'Not a valid URL.';
    return;
  }
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) {
    statusEl.textContent = 'Permission for that origin was not granted.';
    return;
  }
  const cleanMode = (radios.find((r) => r.checked)?.value ?? 'server') as CleanMode;
  await chrome.storage.local.set({ serviceUrl: origin, cleanMode });
  statusEl.textContent = 'Saved.';
});

void load();
