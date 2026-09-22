import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readerAssetIssues } from '../lib/readerAssetHealth.mjs';

const origin = 'https://cp.vliab.workers.dev';
const html = (route, extra = '') => `<html><head><title>Study brief</title><meta name="description" content="A verified study brief"><link rel="canonical" href="${origin}${route}">${extra}</head><body><h1>Study brief</h1></body></html>`;
test('asset health rejects placeholders, missing content, wrong canonicals and noindex', () => {
  assert.deepEqual(readerAssetIssues(html('/news/example'), origin+'/news/example'), []);
  assert.ok(readerAssetIssues(html('/news/example', '<meta name="robots" content="noindex">'), origin+'/news/example').includes('noindex'));
  assert.ok(readerAssetIssues(html('/wrong'), origin+'/news/example').includes('canonical-mismatch'));
  assert.ok(readerAssetIssues('<html><title>Article Not Found</title></html>', origin+'/news/example').includes('error-page'));
});
test('release verification checks all nested sitemap assets and fails if even one is absent', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-reader-health-'));
  try {
    await fs.mkdir(path.join(dir, 'sitemaps'));
    await fs.writeFile(path.join(dir, 'sitemap.xml'), `<sitemapindex><sitemap><loc>${origin}/sitemaps/one.xml</loc></sitemap></sitemapindex>`);
    await fs.writeFile(path.join(dir, 'sitemaps/one.xml'), `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/news/example</loc></url></urlset>`);
    await fs.writeFile(path.join(dir, 'index.html'), html('/'));
    async function run() {
      const child = spawn(process.execPath, ['scripts/verify-reader-assets.mjs', '--out', dir], { cwd: new URL('../', import.meta.url), stdio: ['ignore','pipe','pipe'] });
      let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
      const code = await new Promise((resolve, reject) => {child.on('error',reject);child.on('close',resolve);});
      return { code, output };
    }
    let result = await run(); assert.equal(result.code, 1); assert.match(result.output, /missing-static-asset/);
    await fs.mkdir(path.join(dir,'news/example'), { recursive:true });
    await fs.writeFile(path.join(dir,'news/example/index.html'), html('/news/example'));
    result = await run(); assert.equal(result.code, 0, result.output);
    await fs.writeFile(path.join(dir,'news/example/index.html'), html('/news/example','<meta name="robots" content="noindex">'));
    result = await run(); assert.equal(result.code, 1); assert.match(result.output, /noindex/);
  } finally { await fs.rm(dir, {recursive:true,force:true}); }
});
