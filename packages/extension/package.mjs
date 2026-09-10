/** Zip packages/extension/dist into natural-price-extension-<version>.zip at the repo root. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/manifest.json missing: run `npm run build:extension` first');
  process.exit(1);
}
const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version;
const out = join(here, '..', '..', `natural-price-extension-${version}.zip`);
execFileSync('zip', ['-qr', out, '.'], { cwd: dist });
console.log(out);
