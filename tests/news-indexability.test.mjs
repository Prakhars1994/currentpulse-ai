import test from 'node:test';
import assert from 'node:assert/strict';
import { isIndexableNewsArticle } from '../lib/newsIndexability.js';

test('licensed Conversation republications stay out of search sitemaps', () => {
  assert.equal(isIndexableNewsArticle({ quality_flags: ['reviewed', 'licensed_republish_the_conversation'] }), false);
});

test('ordinary news and historical rows remain eligible', () => {
  for (const row of [{}, { quality_flags: null }, { quality_flags: [] }, { quality_flags: ['reviewed'] }]) {
    assert.equal(isIndexableNewsArticle(row), true);
  }
});
