/** Remove query string and fragment. Tracking parameters never leave the browser. */
export function stripUrl(input: string | URL): string {
  const u = new URL(input.toString());
  u.search = '';
  u.hash = '';
  return u.toString();
}

/** Prefer the page's own canonical link, fall back to the stripped page URL. */
export function canonicalUrl(document: Document, url: URL): string {
  const href = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (href) {
    try {
      return stripUrl(new URL(href, url));
    } catch {
      /* malformed canonical, ignore */
    }
  }
  return stripUrl(url);
}
