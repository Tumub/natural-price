import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from 'playwright';
import { startFixtureServer } from '../../../test-support/fixture-server';

/**
 * The claim the published build makes: it cannot contact a server, whatever
 * is in storage. Built with the server compiled out, then asked to use a
 * server anyway, pointed at a listener that counts every request.
 */
const skip = !!process.env.NP_SKIP_BROWSER;
const ext = join(import.meta.dirname, '..');

describe.skipIf(skip)('a build with no server capability', () => {
  let fixtures: Awaited<ReturnType<typeof startFixtureServer>>;
  let spy: Server;
  let spyUrl: string;
  let context: BrowserContext;
  let hits = 0;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    spy = createServer((_req, res) => {
      hits++;
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
    await new Promise<void>((r) => spy.listen(0, '127.0.0.1', r));
    spyUrl = `http://127.0.0.1:${(spy.address() as AddressInfo).port}`;
    // No NP_SERVER_ENABLED: the published configuration.
    execFileSync('node', [join(ext, 'build.mjs')], {
      env: { ...process.env, NP_SERVICE_URL: spyUrl, NP_EXTRA_MATCHES: 'http://127.0.0.1/*', NP_EXTRA_SERVER_SITES: '127.0.0.1' },
      stdio: 'ignore',
    });
    const dist = mkdtempSync(join(tmpdir(), 'np-noserver-'));
    cpSync(join(ext, 'dist'), dist, { recursive: true });
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
  }, 90_000);

  afterAll(async () => {
    await context?.close();
    spy?.close();
    fixtures?.server.close();
  });

  it('makes no request even when storage asks for the server', async () => {
    const [sw] = context.serviceWorkers();
    const worker = sw ?? (await context.waitForEvent('serviceworker'));
    await worker.evaluate((url) => chrome.storage.local.set({ cleanMode: 'both', serviceUrl: url }), spyUrl);
    expect(await worker.evaluate(() => chrome.storage.local.get('cleanMode'))).toEqual({ cleanMode: 'both' });

    const page = await context.newPage();
    await page.goto(fixtures.url('ikea', 'billy-bookcase'));
    const verdict = page.locator('[data-np-verdict]');
    await expect.poll(() => verdict.getAttribute('data-np-verdict'), { timeout: 40_000 }).not.toBe('checking');
    await page.locator('summary').click();
    expect(await page.locator('details').textContent()).toMatch(/nothing was sent to any server/);
    expect(hits).toBe(0);
    await page.close();
  }, 90_000);
});
