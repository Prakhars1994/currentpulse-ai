export const QUERY_READER_PATHS = new Set(['/current-affairs', '/current-affairs/hindi', '/news', '/exams']);
const CONTENT_QUERY_KEYS = new Set(['date', 'page', 'exam', 'lang', 'type', 'group', 'source', 'q']);

export async function routeReaderRequest(request, env, ctx, handler) {
  const url = new URL(request.url);
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
