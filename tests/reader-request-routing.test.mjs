import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUERY_READER_PATHS, routeReaderRequest } from '../lib/readerRequestRouting.mjs';
test('all query archives reach the wrapper before Cloudflare assets', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.main, 'worker-entry.mjs');
  for (const path of QUERY_READER_PATHS) assert.ok(config.assets.run_worker_first.includes(path));
});
test('unfiltered archives use assets but content queries, RSC and mutations use Next', async () => {
  const env = {ASSETS:{fetch:async()=>new Response('static')}};
  const handler = {fetch:async()=>new Response('dynamic')};
  for (const path of QUERY_READER_PATHS) {
    const base='https://cp.vliab.workers.dev'+path;
    for(const suffix of ['', '?utm_source=test']) assert.equal(await (await routeReaderRequest(new Request(base+suffix),env,{},handler)).text(),'static');
    for(const suffix of ['?page=99999','?date=2026-09-20','?q=exam','?_rsc=1']) assert.equal(await (await routeReaderRequest(new Request(base+suffix),env,{},handler)).text(),'dynamic');
    assert.equal(await (await routeReaderRequest(new Request(base,{method:'POST'}),env,{},handler)).text(),'dynamic');
  }
  assert.equal(await (await routeReaderRequest(new Request('https://cp.vliab.workers.dev/api/private'),env,{},handler)).text(),'dynamic');
  env.ASSETS.fetch=async()=>new Response('missing',{status:404});
  assert.equal(await (await routeReaderRequest(new Request('https://cp.vliab.workers.dev/news'),env,{},handler)).text(),'dynamic');
});
