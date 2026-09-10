import { readFileSync } from 'node:fs';
import { parseHtml } from './dom';
import { extract } from './extractors/index';
import { fetchPage } from './tools/fetch-page';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: npm run demo -- <product-page-url | fixture.html> [url-for-fixture]');
  process.exit(2);
}

let html: string;
let url: string;
if (/^https?:\/\//.test(arg)) {
  const page = await fetchPage(arg);
  if (page.status >= 400) {
    console.error(`HTTP ${page.status} for ${arg}`);
    process.exit(1);
  }
  html = page.html;
  url = page.finalUrl;
} else {
  html = readFileSync(arg, 'utf8');
  url = process.argv[3] ?? JSON.parse(readFileSync(arg.replace(/\.html$/, '.expected.json'), 'utf8')).url;
}

const obs = extract(parseHtml(html, url), new URL(url));
if (!obs) {
  console.log('No price found. Not a product page, or no extractor knows this site yet.');
  process.exit(1);
}
console.log(JSON.stringify(obs, null, 2));
