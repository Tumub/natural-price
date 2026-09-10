import { JSDOM, VirtualConsole } from 'jsdom';

/** Parse HTML without jsdom echoing the page's own parse errors to stderr. */
export function parseHtml(html: string, url: string): Document {
  const virtualConsole = new VirtualConsole();
  return new JSDOM(html, { url, virtualConsole }).window.document;
}
