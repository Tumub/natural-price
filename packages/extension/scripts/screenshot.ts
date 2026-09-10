/**
 * Renders the badge on a locally served fixture and saves screenshots for the
 * README. The "same" state is real end-to-end. The "higher" state is rendered
 * by feeding the badge a synthetic service answer, because no fixture can
 * honestly produce it.
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

await page.evaluate(() => {
  const root = (document.querySelector('[data-natural-price]') as HTMLElement).shadowRoot!;
  const p = root.querySelector('[data-np-verdict]') as HTMLElement;
  const box = p.parentElement as HTMLElement;
  box.dataset.verdict = 'higher';
  p.setAttribute('data-np-verdict', 'higher');
  p.textContent = 'You were shown CHF 64.95. A clean session was shown CHF 59.95, 7.7% less.';
  const c = root.querySelector('.c');
  if (c) c.textContent = 'Confidence: medium.';
  const a = document.createElement('div');
  a.className = 'a';
  a.textContent = 'Try opening this page in a private window and compare before you buy.';
  box.insertBefore(a, root.querySelector('details'));
});
await host.screenshot({ path: join(out, 'badge-higher.png') });
await ctx.close();
app.close();
await fetcher.stop();
fixtures.server.close();
console.log(`wrote ${out}/badge-same.png and badge-higher.png`);
