import { load } from 'cheerio';

export function readerAssetIssues(html, url, { indexable = true } = {}) {
  const $ = load(html);
  const issues = [];
  const title = $('title').first().text().trim();
  const robots = $('meta[name="robots"],meta[name="googlebot"]').map((_, el) => $(el).attr('content')).get().join(',');
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  if (!title) issues.push('missing-title');
  if (!$('h1').length) issues.push('missing-h1');
  if (!($('meta[name="description"]').attr('content') || '').trim()) issues.push('missing-description');
  if (/\b(?:not found|application error|internal server error)\b/i.test(title) || /NEXT_HTTP_ERROR_FALLBACK;404/.test(html)) issues.push('error-page');
  if (indexable && /\bnoindex\b/i.test(robots)) issues.push('noindex');
  if (indexable && canonical.replace(/\/$/, '') !== url.replace(/\/$/, '')) issues.push('canonical-mismatch');
  return issues;
}
