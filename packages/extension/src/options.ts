import { DEFAULTS, getSettings, SERVER_ENABLED, SERVER_SITES, type CleanMode } from './settings';

const input = document.getElementById('serviceUrl') as HTMLInputElement | null;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const incognitoEl = document.getElementById('incognito') as HTMLParagraphElement;
const allSitesEl = document.getElementById('allSites') as HTMLInputElement;
const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cleanMode"]'));

for (const id of ['sites', 'tested']) {
  for (const site of SERVER_SITES) {
    const li = document.createElement('li');
    li.textContent = site;
    document.getElementById(id)?.appendChild(li);
  }
}

if (!SERVER_ENABLED) {
  document.getElementById('noServer')!.hidden = false;
  for (const id of ['modes', 'serverOnly']) document.getElementById(id)?.remove();
}

async function load(): Promise<void> {
  const s = await getSettings();
  if (input) input.value = s.serviceUrl;
  allSitesEl.checked = s.allSites;
  for (const r of radios) r.checked = r.value === s.cleanMode;
  const isFirefox = typeof (globalThis as { browser?: { contextualIdentities?: unknown } }).browser?.contextualIdentities !== 'undefined';
  if (isFirefox) {
    incognitoEl.textContent = 'Firefox: the private tab runs in a temporary container in the background.';
  } else {
    const ok = await chrome.extension.isAllowedIncognitoAccess();
    incognitoEl.textContent = ok
      ? 'Chrome: incognito access is allowed; the private tab opens minimised and closes itself.'
      : 'Chrome: the private tab needs one permission. Open chrome://extensions, find Natural Price, Details, and switch on "Allow in Incognito".';
  }
}

document.getElementById('save')!.addEventListener('click', async () => {
  const cleanMode = (SERVER_ENABLED ? (radios.find((r) => r.checked)?.value ?? DEFAULTS.cleanMode) : 'local') as CleanMode;
  let origin = DEFAULTS.serviceUrl;
  if (cleanMode !== 'local') {
    try {
      origin = new URL(input?.value || DEFAULTS.serviceUrl).origin;
    } catch {
      statusEl.textContent = 'Not a valid server address.';
      return;
    }
    const has = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (!has && !(await chrome.permissions.request({ origins: [origin + '/*'] }))) {
      statusEl.textContent = 'Permission for that address was not granted.';
      return;
    }
  }
  await chrome.storage.local.set({ serviceUrl: origin, cleanMode, allSites: allSitesEl.checked });
  statusEl.textContent = 'Saved.';
});

void load();
