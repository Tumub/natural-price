import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';

const root = join(import.meta.dirname, '..', 'packages', 'extension', 'fixtures');

/** Serves packages/extension/fixtures at http://127.0.0.1:<port>/<site>/<name>.html */
export async function startFixtureServer(): Promise<{ server: Server; origin: string; url: (site: string, name: string) => string }> {
  const server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0]!;
    if (!/^\/[a-z0-9-]+\/[a-z0-9-]+\.html$/.test(path)) {
      res.writeHead(404).end();
      return;
    }
    try {
      // Real pages carry a canonical link to the real site. Served locally, the
      // page must be self-consistent, so the canonical is rewritten to this URL.
      const local = `http://${req.headers.host}${path}`;
      const html = (await readFile(join(root, path), 'utf8')).replace(
        /(<link[^>]*rel="canonical"[^>]*href=")[^"]*(")/i,
        `$1${local}$2`,
      );
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, origin, url: (site, name) => `${origin}/${site}/${name}.html` };
}

export async function expectedFor(site: string, name: string) {
  return JSON.parse(await readFile(join(root, site, `${name}.expected.json`), 'utf8'));
}
