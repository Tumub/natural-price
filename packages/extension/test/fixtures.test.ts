import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseHtml } from '../src/dom';
import { describe, expect, it } from 'vitest';
import { extract } from '../src/extractors/index';

const root = join(__dirname, '..', 'fixtures');

function* fixtures(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* fixtures(p);
    else if (f.endsWith('.html')) yield p;
  }
}

const files = Array.from(fixtures(root));

describe('fixtures', () => {
  it('has at least one fixture', () => expect(files.length).toBeGreaterThan(0));

  for (const file of files) {
    const rel = file.slice(root.length + 1);
    it(rel, () => {
      const html = readFileSync(file, 'utf8');
      const spec = JSON.parse(readFileSync(file.replace(/\.html$/, '.expected.json'), 'utf8'));
      expect(spec.expect.TODO, `${rel}: expected.json still has a TODO`).toBeUndefined();
      const obs = extract(parseHtml(html, spec.url), new URL(spec.url), new Date('2026-01-01T00:00:00Z'));
      expect(obs).not.toBeNull();
      expect(obs).toMatchObject(spec.expect);
      expect(obs!.url).not.toMatch(/[?#]/);
      expect(obs!.currency).toMatch(/^[A-Z]{3}$/);
      expect(obs!.price).toBeGreaterThan(0);
    });
  }
});
