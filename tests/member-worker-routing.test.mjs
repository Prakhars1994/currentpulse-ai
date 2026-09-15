import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('authenticated member routes always execute through the Worker', () => {
  const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(wrangler, /"\/member"/);
  assert.match(wrangler, /"\/member\/\*"/);
  assert.match(wrangler, /"\/api\/\*"/);
});
