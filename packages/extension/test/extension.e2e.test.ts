import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { chromium, type BrowserContext } from 'playwright';
import { CleanFetcher } from '../../fetch-service/src/browser';
import { createApp } from '../../fetch-service/src/server';
import { startFixtureServer } from '../../../test-support/fixture-server';

/**
 * Loads the built extension into Chromium, opens a locally served fixture,
 * and waits for the badge. The fetch service runs in-process against the
 * same fixture server, so "your price" and the "clean price" are the same
 * page and the badge must say so.
 */
const skip = !!process.env.NP_SKIP_BROWSER;
const ext = join(import.meta.dirname, '..');

describe.skipIf(skip)('extension end to end', () => {
  let fixtures: Awaited<ReturnType<typeof startFixtureServer>>;
  let fetcher: CleanFetcher;
  let app: Server;
  let context: BrowserContext;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    fetcher = new CleanFetcher([{ label: 'direct' }]);
    await fetcher.start();
    app = createApp({ fetcher, allowedHosts: ['127.0.0.1'], fetchesPerCheck: 1 });
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const api = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
    execFileSync('node', [join(ext, 'build.mjs')], { env: { ...process.env, NP_SERVICE_URL: api, NP_EXTRA_MATCHES: 'http://127.0.0.1/*' }, stdio: 'inherit' });
    const dist = join(ext, 'dist');
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
  }, 90_000);

  afterAll(async () => {
    await context?.close();
    app?.close();
    await fetcher?.stop();
    fixtures?.server.close();
  });

  it('shows a "same" badge on the IKEA fixture', async () => {
    const page = await context.newPage();
    await page.goto(fixtures.url('ikea', 'billy-bookcase'));
    const verdict = page.locator('[data-np-verdict]');
    await expect.poll(() => verdict.getAttribute('data-np-verdict'), { timeout: 30_000 }).not.toBe('checking');
    expect(await verdict.textContent()).toMatch(/You were shown .*59\.95.*clean session was shown the same/);
    expect(await verdict.getAttribute('data-np-verdict')).toBe('same');
    await page.close();
  }, 60_000);

  it('shows "higher" with the private-window button when your price is above the clean one', async () => {
    const page = await context.newPage();
    // The fixture server shows this tab an inflated price; the clean fetch (query stripped) sees the real one.
    await page.goto(fixtures.url('ikea', 'billy-bookcase') + '?np_price=64.95');
    const verdict = page.locator('[data-np-verdict]');
    await expect.poll(() => verdict.getAttribute('data-np-verdict'), { timeout: 30_000 }).not.toBe('checking');
    expect(await verdict.textContent()).toMatch(/64\.95.*59\.95.*8\.3% less/);
    const button = page.locator('[data-np-action="open-private"]');
    await expect.poll(() => button.count()).toBe(1);
    await button.click();
    const status = page.locator('[data-np-status]');
    await expect.poll(() => status.textContent(), { timeout: 10_000 }).toMatch(/Opened|Link copied|paste this link/);
    await page.close();
  }, 60_000);

  it('shows the badge on the Nike variant page too', async () => {
    const page = await context.newPage();
    await page.goto(fixtures.url('nike', 'cw2288-111'));
    const verdict = page.locator('[data-np-verdict]');
    await expect.poll(() => verdict.getAttribute('data-np-verdict'), { timeout: 30_000 }).not.toBe('checking');
    expect(await verdict.textContent()).toMatch(/clean session was shown the same/);
    await page.close();
  }, 60_000);
});
