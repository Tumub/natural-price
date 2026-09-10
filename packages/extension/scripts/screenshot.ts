/**
 * Renders the badge on a locally served fixture and saves screenshots for the
 * README. Both states are real end-to-end: for "higher" the fixture server
 * shows the tab an inflated price and the clean fetch reads the genuine one.
 *
 *   npx tsx packages/extension/scripts/screenshot.ts
 */
import { execFileSync } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CleanFetcher } from '../../fetch-service/src/browser';
import { createApp } from '../../fetch-service/src/server';
import { startFixtureServer } from '../../../test-support/fixture-server';

const ext = join(import.meta.dirname, '..');
const out = join(ext, '..', '..', 'docs', 'assets');
const fixtures = await startFixtureServer();
const fetcher = new CleanFetcher([{ label: 'direct' }]);
await fetcher.start();
const app = createApp({ fetcher, allowedHosts: ['127.0.0.1'], fetchesPerCheck: 1 });
await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
const api = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
execFileSync('node', [join(ext, 'build.mjs')], { env: { ...process.env, NP_SERVICE_URL: api, NP_EXTRA_MATCHES: 'http://127.0.0.1/*' }, stdio: 'ignore' });
const dist = join(ext, 'dist');
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
const page = await ctx.newPage();
await page.goto(fixtures.url('ikea', 'billy-bookcase'));
const verdict = page.locator('[data-np-verdict]');
await verdict.waitFor({ timeout: 30_000 });
for (let i = 0; i < 60 && (await verdict.getAttribute('data-np-verdict')) === 'checking'; i++) await page.waitForTimeout(250);
const host = page.locator('.np');
await host.screenshot({ path: join(out, 'badge-same.png') });

// The "higher" state is real too: the fixture server shows this tab an
// inflated price while the clean fetch sees the genuine one.
await page.goto(fixtures.url('ikea', 'billy-bookcase') + '?np_price=64.95');
await verdict.waitFor({ timeout: 30_000 });
for (let i = 0; i < 60 && (await verdict.getAttribute('data-np-verdict')) === 'checking'; i++) await page.waitForTimeout(250);
await host.screenshot({ path: join(out, 'badge-higher.png') });
await ctx.close();
app.close();
await fetcher.stop();
fixtures.server.close();
console.log(`wrote ${out}/badge-same.png and badge-higher.png`);
