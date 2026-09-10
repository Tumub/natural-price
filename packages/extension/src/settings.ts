/** User settings, kept in chrome.storage.local on this device only. */

/**
 * Where the clean session runs, and whether anything leaves the browser.
 *
 *  local  a private tab on this device, compared here. No network call to
 *         any server, ever. Works on every website. The default.
 *  both   the private tab, plus the server for the companies listed below.
 *  server the server only, for the companies listed below.
 */
export type CleanMode = 'local' | 'both' | 'server';

/**
 * Whether this build can talk to a server at all. False in the published
 * builds, where the two server modes do not exist, the options page does not
 * offer them, and no request can be made whatever is in storage. Self-hosters
 * turn it on with NP_SERVER_ENABLED=true at build time.
 */
export const SERVER_ENABLED: boolean = typeof __SERVER_ENABLED__ === 'undefined' ? false : __SERVER_ENABLED__;

/**
 * The only companies the extension will ever contact a server about. Sites
 * outside this list are compared on the device or not at all, whatever the
 * mode. Changing this list is a code change, reviewable in the repository.
 */
/** Sites with a tested price reader. Also the only sites a server-enabled build may contact a server about. */
const BUILT_IN = ['ikea.com', 'mediamarkt.ch', 'nike.com', 'booking.com'];

/**
 * Extra hosts can be compiled in with NP_EXTRA_SERVER_SITES when someone
 * builds the extension against their own server. Empty in the published
 * builds, so the list a user sees is the list in the source.
 */
export const SERVER_SITES: string[] = [...BUILT_IN, ...(typeof __EXTRA_SERVER_SITES__ === 'undefined' ? [] : __EXTRA_SERVER_SITES__)];

export function serverAllowed(url: URL | string): boolean {
  if (!SERVER_ENABLED) return false;
  const host = new URL(url.toString()).hostname;
  return SERVER_SITES.some((s) => host === s || host.endsWith('.' + s));
}

export interface Settings {
  serviceUrl: string;
  cleanMode: CleanMode;
  /** Read prices on every website, not only the ones with a tested reader. */
  allSites: boolean;
}

export const DEFAULTS: Settings = { serviceUrl: __SERVICE_URL__, cleanMode: 'local', allSites: true };

const MODES: CleanMode[] = ['local', 'both', 'server'];

export async function getSettings(): Promise<Settings> {
  const v = (await chrome.storage.local.get(DEFAULTS)) as Omit<Partial<Settings>, 'cleanMode'> & { cleanMode?: string };
  // 'private' was this mode's name in 0.5.0.
  const raw = v.cleanMode === 'private' ? 'local' : v.cleanMode;
  const stored = MODES.includes(raw as CleanMode) ? (raw as CleanMode) : DEFAULTS.cleanMode;
  return {
    serviceUrl: typeof v.serviceUrl === 'string' ? v.serviceUrl : DEFAULTS.serviceUrl,
    // A build without server support stays on the device whatever is stored.
    cleanMode: SERVER_ENABLED ? stored : 'local',
    allSites: v.allSites !== false,
  };
}
