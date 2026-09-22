import fs from 'node:fs/promises';
import { load } from 'cheerio';

const origin = new URL(process.env.SEO_AUDIT_ORIGIN || 'https://cp.vliab.workers.dev').origin;
const get = (url) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
const maps = [];
const urls = new Set();
async function sitemap(url) {
  if (maps.some(row => row.url === url)) return;
  if (new URL(url).origin !== origin) throw new Error(`Unexpected sitemap origin: ${url}`);
  const response = await get(url);
  const xml = await response.text();
  maps.push({ url, status: response.status });
  if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}: ${url}`);
  const $ = load(xml, { xmlMode: true });
  if ($('sitemapindex').length) {
    for (const element of $('sitemap > loc').toArray()) await sitemap($(element).text());
  } else if ($('urlset').length) {
    $('url > loc').each((_, element) => urls.add($(element).text()));
  } else throw new Error(`Invalid sitemap: ${url}`);
}
await sitemap(`${origin}/sitemap.xml`);
const all = [...urls];
const selected = all.filter(url => !/^\/(news|current-affairs|exams)\//.test(new URL(url).pathname));
for (const slug of ['results', 'admit-cards', 'notifications', 'answer-keys', 'applications', 'deadlines', 'exam-dates', 'cut-offs', 'counselling']) {
  const url = `${origin}/exams/${slug}`;
  if (urls.has(url)) selected.push(url);
}
for (const section of ['news', 'current-affairs', 'exams']) {
  const group = all.filter(url => new URL(url).pathname.startsWith(`/${section}/`));
  for (let i = 0; i < Math.min(12, group.length); i++) selected.push(group[Math.floor(i * (group.length - 1) / Math.max(1, Math.min(12, group.length) - 1))]);
}
const results = [];
const full = process.env.SEO_AUDIT_FULL === '1';
const sample = full ? all : [...new Set(selected)];
for (let i = 0; i < sample.length; i += 3) {
  await Promise.all(sample.slice(i, i + 3).map(async url => {
    try {
      const response = await get(url);
      const $ = load(await response.text());
      const robots = $('meta[name="robots"],meta[name="googlebot"]').map((_, el) => $(el).attr('content')).get();
      const canonical = $('link[rel="canonical"]').attr('href') || '';
      const row = { url, status: response.status, location: response.headers.get('location'), robots, xRobotsTag: response.headers.get('x-robots-tag'), canonical, title: $('title').first().text(), description: $('meta[name="description"]').attr('content') || '', h1: $('h1').length };
      row.issues = [];
      if (row.status !== 200) row.issues.push('non-200');
      if (/noindex/i.test([...robots, row.xRobotsTag].join(','))) row.issues.push('noindex-in-sitemap');
      if (canonical.replace(/\/$/, '') !== url.replace(/\/$/, '')) row.issues.push('canonical-mismatch');
      if (!row.title) row.issues.push('missing-title');
      if (!row.description) row.issues.push('missing-description');
      if (!row.h1) row.issues.push('missing-h1');
      if (/\b(?:not found|application error|internal server error)\b/i.test(row.title)) row.issues.push('error-page');
      results.push(row);
    } catch (error) { results.push({ url, error: error.message, issues: ['fetch-error'] }); }
  }));
}
const report = { generatedAt: new Date().toISOString(), maps, sitemapUrls: all.length, sampleMethod: full ? 'Every sitemap URL; HTTP checks do not establish Google indexing.' : 'All sitemap pages outside article/exam sections, plus up to 12 evenly spaced URLs per section; not a population estimate or Google index-status check.', results };
// A successful homepage fetch cannot detect a broken archive or a silent
// noindex/canonical regression. Probe missing pages as well as published URLs.
const missingPaths = ['/definitely-missing-seo-audit-page'];
if (origin === 'https://cp.vliab.workers.dev') missingPaths.push('/news/page/99999', '/current-affairs?page=99999', '/current-affairs/hindi?page=99999');
report.missingPages = [];
for (const pathname of missingPaths) {
  const url = origin + pathname;
  try {
    const response = await get(url);
    const $ = load(await response.text());
    const robots = $('meta[name="robots"],meta[name="googlebot"]').map((_, el) => $(el).attr('content')).get();
    const noindex = /noindex/i.test([...robots, response.headers.get('x-robots-tag')].join(','));
    // Next may stream a 200 before notFound(), but must then emit noindex.
    const ok = [404, 410].includes(response.status) || (response.status === 200 && noindex);
    report.missingPages.push({ url, status: response.status, noindex, issues: ok ? [] : ['indexable-missing-page'] });
  } catch (error) {
    report.missingPages.push({ url, error: error.message, issues: ['fetch-error'] });
  }
}
await fs.mkdir('docs', { recursive: true });
await fs.writeFile(process.env.SEO_AUDIT_OUTPUT || 'docs/live-indexability-audit.json', JSON.stringify(report, null, 2) + '\n');
const issues = [...results, ...report.missingPages].filter(row => row.issues.length);
if (!all.length) issues.push({ issues: ['empty-sitemap'] });
console.log(JSON.stringify({ sitemapUrls: all.length, sampled: results.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
