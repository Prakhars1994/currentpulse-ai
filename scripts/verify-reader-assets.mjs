import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { readerAssetIssues } from '../lib/readerAssetHealth.mjs';

const outIndex = process.argv.indexOf('--out');
const root = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : '.open-next/assets');
const origin = 'https://cp.vliab.workers.dev';
const visited = new Set(), urls = new Set();
async function readMap(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const $ = load(await fs.readFile(path.join(root, relative), 'utf8'), { xmlMode: true });
  if (!$('sitemapindex,urlset').length) throw new Error(`Invalid sitemap ${relative}`);
  for (const element of $('loc').toArray()) {
    const url = new URL($(element).text());
    if (url.origin !== origin) throw new Error(`Unexpected sitemap origin ${url.origin}`);
    if ($('sitemapindex').length) await readMap(url.pathname.slice(1));
    else urls.add(url.href);
  }
}
await readMap('sitemap.xml');
if (!urls.size) throw new Error('Empty sitemap');
const failures = [];
for (const url of urls) {
  const pathname = new URL(url).pathname;
  const file = path.join(root, pathname.replace(/^\/+|\/+$/g, ''), 'index.html');
  const flat = path.join(root, pathname === '/' ? 'index.html' : pathname.slice(1) + '.html');
  let html;
  try { html = await fs.readFile(file, 'utf8'); }
  catch { try { html = await fs.readFile(flat, 'utf8'); } catch { failures.push({ url, issues: ['missing-static-asset'] }); continue; } }
  const issues = readerAssetIssues(html, url);
  if (issues.length) failures.push({ url, issues });
}
console.log(JSON.stringify({ checked: urls.size, failures }, null, 2));
if (failures.length) process.exitCode = 1;
