const input = document.getElementById('serviceUrl') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

chrome.storage.local.get({ serviceUrl: __SERVICE_URL__ }).then((v) => (input.value = String((v as { serviceUrl: string }).serviceUrl)));

document.getElementById('save')!.addEventListener('click', async () => {
  let origin: string;
  try {
    origin = new URL(input.value).origin;
  } catch {
    statusEl.textContent = 'Not a valid URL.';
    return;
  }
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) {
    statusEl.textContent = 'Permission for that origin was not granted.';
    return;
  }
  await chrome.storage.local.set({ serviceUrl: origin });
  statusEl.textContent = 'Saved.';
});
