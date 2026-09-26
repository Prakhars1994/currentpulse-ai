export const QUERY_READER_PATHS = new Set(['/current-affairs', '/current-affairs/hindi', '/news', '/exams']);
const CONTENT_QUERY_KEYS = new Set(['date', 'page', 'exam', 'lang', 'type', 'group', 'source', 'q']);
// A bad page number must never be allowed to fall through to a static archive
// asset.  Apart from wasting crawl budget, that can turn an exhausted archive
// into an indexable page-one clone when an asset deployment is stale.
const MAX_ARCHIVE_PAGE = 10_000;

function invalidArchivePage(url) {
  if (!url.searchParams.has('page')) return false;
  const value = url.searchParams.get('page') || '';
  if (!/^[1-9]\d*$/.test(value)) return true;
  const page = Number(value);
  return !Number.isSafeInteger(page) || page > MAX_ARCHIVE_PAGE;
}

function goneArchiveResponse() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

export async function routeReaderRequest(request, env, ctx, handler) {
  const url = new URL(request.url);
  if (QUERY_READER_PATHS.has(url.pathname) && invalidArchivePage(url)) {
    return goneArchiveResponse();
  }
  const contentQuery = [...url.searchParams.keys()].some(key => CONTENT_QUERY_KEYS.has(key));
  const frameworkRequest = url.searchParams.has('_rsc') || request.headers.has('RSC') || request.headers.has('Next-Action');
  if (QUERY_READER_PATHS.has(url.pathname) && ['GET', 'HEAD'].includes(request.method) && !contentQuery && !frameworkRequest) {
    // Keep ordinary archive visits off the database while allowing pagination
    // and filters to reach Next instead of silently serving page one's asset.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  }
  return handler.fetch(request, env, ctx);
}
