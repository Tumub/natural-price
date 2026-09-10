/**
 * Bundle the extension into packages/extension/dist.
 *   NP_SERVICE_URL     origin of the fetch service (default http://localhost:8787)
 *   NP_EXTRA_MATCHES   comma list of extra content-script match patterns (tests)
 */
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const serviceUrl = (process.env.NP_SERVICE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const extra = (process.env.NP_EXTRA_MATCHES ?? '').split(',').map((s) => s.trim()).filter(Boolean);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(here, 'src/content.ts'), join(here, 'src/background.ts'), join(here, 'src/options.ts')],
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  outdir: dist,
  define: { __SERVICE_URL__: JSON.stringify(serviceUrl) },
  logLevel: 'warning',
});

const manifest = JSON.parse(readFileSync(join(here, 'manifest.template.json'), 'utf8'));
manifest.host_permissions = [new URL(serviceUrl).origin + '/*'];
manifest.content_scripts[0].matches.push(...extra);
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
copyFileSync(join(here, 'src/options.html'), join(dist, 'options.html'));
console.log(`built ${dist} for service ${serviceUrl}${extra.length ? ' with extra matches ' + extra.join(' ') : ''}`);
