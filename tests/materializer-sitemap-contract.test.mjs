import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

test('full materialization follows shipped sitemap shards and rejects a submitted soft 404', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-materializer-'));
  const origin = 'https://cp.vliab.workers.dev';
  const route = '/current-affairs/exact-shipped-article';
  let broken = false;
  const requests = [];
  const server = http.createServer((req,res) => {
    requests.push(req.url);
    if (req.url.startsWith('/news/page/')) {res.writeHead(404);res.end('missing');return;}
    if (req.url === '/robots.txt') {res.end('User-agent: *\nAllow: /');return;}
    res.setHeader('content-type','text/html');
    const placeholder = broken && req.url === route;
    res.end(`<html><head><title>${placeholder?'Article Not Found':'Study brief'}</title><meta name="description" content="Verified public reader"><link rel="canonical" href="${origin}${req.url}">${placeholder?'<meta name="robots" content="noindex">':''}</head><body><h1>Study brief</h1><p>${'Reader content. '.repeat(60)}</p></body></html>`);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    await fs.mkdir(path.join(dir,'sitemaps'));
    await fs.writeFile(path.join(dir,'sitemap.xml'),`<sitemapindex><sitemap><loc>${origin}/sitemaps/one.xml</loc></sitemap></sitemapindex>`);
    await fs.writeFile(path.join(dir,'sitemaps/one.xml'),`<urlset><url><loc>${origin}${route}</loc></url></urlset>`);
    async function run() {
      const child = spawn(process.execPath,['scripts/materialize-static-reader.mjs','--base',`http://127.0.0.1:${server.address().port}`,'--out',dir,'--sitemap-dir',dir], {
        cwd:new URL('../',import.meta.url), env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',STATIC_NEWS_ARCHIVE_PAGES:'2'},stdio:['ignore','pipe','pipe'],
      });
      let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
      const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
      return {code,output};
    }
    const good=await run();assert.equal(good.code,0,good.output);
    assert.ok(requests.includes(route));assert.ok(!requests.includes('/sitemap.xml'));
    const asset=path.join(dir,route.slice(1),'index.html');
    assert.match(await fs.readFile(asset,'utf8'),/currentpulse-static-reader/);
    broken=true;
    const bad=await run();assert.equal(bad.code,2,bad.output);assert.match(bad.output,/Submitted article rendered as not-found/);
    assert.doesNotMatch(await fs.readFile(asset,'utf8'),/Article Not Found/);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await fs.rm(dir,{recursive:true,force:true});
  }
});
