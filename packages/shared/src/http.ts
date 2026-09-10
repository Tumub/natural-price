import type { IncomingMessage, ServerResponse } from 'node:http';

/** JSON response with permissive CORS: the extension's background worker and any self-hoster may call. */
export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

export async function readJson(req: IncomingMessage, maxBytes = 16 * 1024): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > maxBytes) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function pathOf(req: IncomingMessage): { path: string; query: URLSearchParams } {
  const [path, q] = (req.url ?? '/').split('?') as [string, string | undefined];
  return { path, query: new URLSearchParams(q ?? '') };
}
