const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

/** One page, one request, no cookies. This is the only network call in the package. */
export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string; status: number }> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en', accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  return { html: await res.text(), finalUrl: res.url || url, status: res.status };
}
