import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal chrome.storage.local, and the build-time constant the module reads.
let store: Record<string, unknown> = {};
vi.stubGlobal('__SERVICE_URL__', 'https://example.test');
vi.stubGlobal('__EXTRA_SERVER_SITES__', []);
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults, ...store }),
      set: async (v: Record<string, unknown>) => Object.assign(store, v),
    },
  },
});

const { DEFAULTS, getSettings, serverAllowed, SERVER_SITES } = await import('../src/settings');

describe('settings', () => {
  beforeEach(() => {
    store = {};
  });

  it('defaults to the device-only mode on every website', async () => {
    expect(DEFAULTS.cleanMode).toBe('local');
    expect(DEFAULTS.allSites).toBe(true);
    expect(await getSettings()).toMatchObject({ cleanMode: 'local', allSites: true, serviceUrl: 'https://example.test' });
  });

  it('keeps a chosen mode and migrates the 0.5.0 name', async () => {
    store = { cleanMode: 'both' };
    expect((await getSettings()).cleanMode).toBe('both');
    store = { cleanMode: 'private' };
    expect((await getSettings()).cleanMode).toBe('local');
    store = { cleanMode: 'nonsense' };
    expect((await getSettings()).cleanMode).toBe('local');
  });

  it('allows the server only for the listed companies', () => {
    for (const site of SERVER_SITES) expect(serverAllowed(`https://www.${site}/p/1`)).toBe(true);
    expect(serverAllowed('https://www.ikea.com/ch/en/p/x/')).toBe(true);
    expect(serverAllowed('https://ikea.com.evil.test/p')).toBe(false);
    expect(serverAllowed('https://www.zalando.ch/p')).toBe(false);
    expect(serverAllowed('https://shop.example/p')).toBe(false);
  });
});
