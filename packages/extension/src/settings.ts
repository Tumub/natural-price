/** User settings, kept in chrome.storage.local. */
export type CleanMode = 'server' | 'private' | 'both';

export interface Settings {
  serviceUrl: string;
  /** Where the clean session runs: your server, a private tab on this device, or both. */
  cleanMode: CleanMode;
}

export const DEFAULTS: Settings = { serviceUrl: __SERVICE_URL__, cleanMode: 'server' };

export async function getSettings(): Promise<Settings> {
  const v = (await chrome.storage.local.get(DEFAULTS)) as Partial<Settings>;
  const mode = v.cleanMode;
  return {
    serviceUrl: typeof v.serviceUrl === 'string' ? v.serviceUrl : DEFAULTS.serviceUrl,
    cleanMode: mode === 'private' || mode === 'both' ? mode : 'server',
  };
}
