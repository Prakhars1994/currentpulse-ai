import fs from 'node:fs/promises';
import { load } from 'cheerio';

const origin = 'https://cp.vliab.workers.dev';
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
const sample = [...new Set(selected)];
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
      results.push(row);
    } catch (error) { results.push({ url, error: error.message, issues: ['fetch-error'] }); }
  }));
}
const report = { generatedAt: new Date().toISOString(), maps, sitemapUrls: all.length, sampleMethod: 'All sitemap pages outside article/exam sections, plus up to 12 evenly spaced URLs per section; not a population estimate or Google index-status check.', results };
await fs.mkdir('docs', { recursive: true });
await fs.writeFile('docs/live-indexability-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sitemapUrls: all.length, sampled: results.length, issues: results.filter(row => row.issues.length) }, null, 2));
