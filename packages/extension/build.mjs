/**
 * Bundle the extension into packages/extension/dist (Chrome) or
 * dist-firefox (Firefox).
 *   NP_TARGET          chrome (default) or firefox
 *   NP_SERVICE_URL     origin of the fetch service (default http://localhost:8787)
 *   NP_EXTRA_MATCHES   comma list of extra content-script match patterns (tests)
 *   NP_EXTRA_SERVER_SITES  comma list of extra hosts the server may be contacted about
 *   NP_SERVER_ENABLED  "true" to compile in the optional server modes (default: off)
 */
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = process.env.NP_TARGET === 'firefox' ? 'firefox' : 'chrome';
const dist = join(here, target === 'firefox' ? 'dist-firefox' : 'dist');
const serviceUrl = (process.env.NP_SERVICE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const extra = (process.env.NP_EXTRA_MATCHES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const extraSites = (process.env.NP_EXTRA_SERVER_SITES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const serverEnabled = process.env.NP_SERVER_ENABLED === 'true';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(here, 'src/content.ts'), join(here, 'src/background.ts'), join(here, 'src/options.ts')],
  bundle: true,
  format: 'esm',
  target: target === 'firefox' ? 'firefox128' : 'chrome120',
  outdir: dist,
  define: {
    __SERVICE_URL__: JSON.stringify(serviceUrl),
    __EXTRA_SERVER_SITES__: JSON.stringify(extraSites),
    __SERVER_ENABLED__: JSON.stringify(serverEnabled),
  },
  logLevel: 'warning',
});

const manifest = JSON.parse(readFileSync(join(here, 'manifest.template.json'), 'utf8'));
manifest.content_scripts[0].matches.push(...extra);
if (target === 'firefox') {
  // Firefox runs MV3 background scripts as an event page, not a service worker.
  manifest.background = { scripts: ['background.js'], type: 'module' };
  // Temporary container tabs for the clean session on this device.
  manifest.permissions.push('contextualIdentities', 'cookies');
  delete manifest.incognito;
  manifest.browser_specific_settings = { gecko: { id: '{7e1c4a2e-9d0b-4c47-9c1f-natural-price}'.replace('natural-price', '5a1f7b2c9e3d'), strict_min_version: '128.0' } };
}
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
copyFileSync(join(here, 'src/options.html'), join(dist, 'options.html'));
console.log(`built ${dist} (${target}) ${serverEnabled ? `with the server enabled at ${serviceUrl}` : 'with no server capability'}${extra.length ? ' with extra matches ' + extra.join(' ') : ''}`);
