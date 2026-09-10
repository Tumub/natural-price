/**
 * Save a real product page as a test fixture, stripped of everything that is
 * not needed to test extraction: every <script> that is not JSON-LD, inline
 * event handlers, and <noscript>/<iframe>/<svg> bodies. Page is fetched with
 * no cookies, so nothing personal is in it to begin with.
 *
 *   npm run add-fixture -- <url> <site> <name>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { extract } from '../extractors/index';
import { fetchPage } from './fetch-page';

const [url, site, name] = process.argv.slice(2);
if (!url || !site || !name) {
  console.error('usage: npm run add-fixture -- <url> <site> <name>');
  process.exit(2);
}

const page = await fetchPage(url);
if (page.status >= 400) {
  console.error(`HTTP ${page.status}. Site blocks anonymous fetches; save the page from your browser instead.`);
  process.exit(1);
}

const dom = new JSDOM(page.html, { url: page.finalUrl, virtualConsole: new VirtualConsole() });
const doc = dom.window.document;
for (const s of Array.from(doc.querySelectorAll('script'))) {
  if (s.getAttribute('type') !== 'application/ld+json') s.remove();
}
for (const el of Array.from(doc.querySelectorAll('noscript, iframe, svg, template'))) el.remove();
for (const el of Array.from(doc.querySelectorAll('*'))) {
  for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
}

const dir = join('packages', 'extension', 'fixtures', site);
mkdirSync(dir, { recursive: true });
const html = `<!-- Fixture for Natural Price. Fetched anonymously ${new Date().toISOString().slice(0, 10)} from ${page.finalUrl}. Non-JSON-LD scripts removed. -->\n` + dom.serialize();
writeFileSync(join(dir, `${name}.html`), html);

const obs = extract(doc, new URL(page.finalUrl));
const expected = {
  url: page.finalUrl.replace(/[?#].*$/, ''),
  fetchedAt: new Date().toISOString().slice(0, 10),
  expect: obs
    ? { productKey: obs.productKey, productKeyType: obs.productKeyType, price: obs.price, currency: obs.currency, ...(obs.country ? { country: obs.country } : {}), ...(obs.name ? { name: obs.name } : {}) }
    : { TODO: 'no extractor found a price; write a site extractor and fill this in' },
};
writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(expected, null, 2) + '\n');
console.log(`wrote ${dir}/${name}.html (${(html.length / 1024).toFixed(0)} kB) and ${name}.expected.json`);
console.log(JSON.stringify(expected.expect, null, 2));
