import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { indiaDateRange } from '../lib/study/digestDates.js';

function streamModule(response) {
  const ranges = [];
  const query = new Proxy({}, { get(_, key) {
    if (key === 'then') return (resolve) => Promise.resolve(response).then(resolve);
    return (...args) => { if (key === 'range') ranges.push(args); return query; };
  }});
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL('../lib/articleStreams.js', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules = {
    '@/lib/supabase-server': { createServerSupabase: () => query },
    '@/lib/study/digestDates': { indiaDateRange },
    '@/lib/examPrep/examRelevance': { articleMatchesExam: () => true },
  };
  vm.runInNewContext(code, { exports, console, require: name => modules[name] });
  return { ...exports, ranges };
}

test('out-of-range counted archive queries become exhausted pages', async () => {
  const streams = streamModule({ data: null, count: null, error: { code: 'PGRST103', message: 'Requested range not satisfiable' } });
  const result = await streams.loadCurrentAffairsDatePage({ date: '2026-09-18', offset: 2399952 });
  assert.equal(result.error, null);
  assert.equal(result.hasMore, false);
  assert.equal(result.articles.length, 0);
  assert.equal(result.date, '2026-09-18');
  assert.deepEqual(streams.ranges, [[2399952, 2399976]]);
});

test('real database failures and invalid first-page ranges remain errors', async () => {
  for (const [code, offset] of [['PGRST000', 24], ['42501', 24], ['PGRST103', 0]]) {
    const streams = streamModule({ data: null, count: null, error: { code, message: 'query failed' } });
    const result = await streams.loadCurrentAffairsDatePage({ date: '2026-09-18', offset });
    assert.equal(result.error.code, code);
  }
});
