import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as publicData from '../lib/publicData.js';
const require = createRequire(import.meta.url);
function load(file, overrides) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, fileName: file,
  }).outputText;
  const modules = { 'next/cache': { unstable_cache: fn => fn }, '@/lib/publicData': publicData, ...overrides };
  vm.runInNewContext(code, { exports, console, require: name => modules[name] || (name.startsWith('@/') ? {} : require(name)) });
  return exports;
}
function query(result) {
  const proxy = new Proxy({}, { get: (_, name) => name === 'then' ? resolve => Promise.resolve(result()).then(resolve) : () => proxy });
  return proxy;
}
test('article metadata distinguishes outages from genuinely absent records', async () => {
  for (const file of ['app/current-affairs/[slug]/page.js','app/news/[slug]/page.js']) {
    let response = { data: null, error: { message: 'exceed_egress_quota' } };
    const page = load(file, { '@/lib/supabase-server': { createServerSupabase: () => query(() => response) } });
    await assert.rejects(page.generateMetadata({params:Promise.resolve({slug:'published-article'})}), /temporarily unavailable/);
    response = {data:null,error:null};
    assert.equal((await page.generateMetadata({params:Promise.resolve({slug:'missing'})})).robots.index,false);
  }
});
test('exam metadata propagates data failures rather than declaring the URL missing', async () => {
  const page = load('app/exams/[slug]/page.js', { '@/lib/exams/repository': { loadExamUpdateBySlug: async () => ({update:null,error:{message:'quota'}}) } });
  await assert.rejects(page.generateMetadata({params:Promise.resolve({slug:'exam-update'})}), /temporarily unavailable/);
});
test('exam repository retries after outage instead of caching a false missing record', async () => {
  let calls=0;
  const repository=load('lib/exams/repository.js', {
    '@/lib/supabase-server': {createServerSupabase:()=>query(()=>++calls===1?{data:null,error:{message:'quota'}}:{data:null,error:null})},
  });
  assert.ok((await repository.loadExamUpdateBySlug('example')).error);
  assert.equal((await repository.loadExamUpdateBySlug('example')).error,null);
  assert.equal(calls,2);
});
