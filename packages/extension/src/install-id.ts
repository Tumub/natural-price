/**
 * A random id created once per install, stored locally, and hashed before it
 * ever leaves the browser. Used for rate limiting only. See PRIVACY.md.
 */
export async function getInstallId(): Promise<string> {
  const { installUuid } = await chrome.storage.local.get('installUuid');
  let uuid = typeof installUuid === 'string' ? installUuid : '';
  if (!uuid) {
    uuid = crypto.randomUUID();
    await chrome.storage.local.set({ installUuid: uuid });
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uuid));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
