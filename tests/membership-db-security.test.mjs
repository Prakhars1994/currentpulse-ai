import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidates = [
  'supabase/migrations',
  'migrations',
].filter((p) => fs.existsSync(p));

function allSql() {
  return candidates.flatMap((dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))).join('\n');
}

test('repository migrations do not expose service role credentials', () => {
  const sql = allSql();
  assert.doesNotMatch(sql, /SUPABASE_SERVICE_ROLE_KEY\s*=|service_role\s*[:=]\s*['\"][A-Za-z0-9._-]{20,}/i);
});

test('payment source never embeds Razorpay secret', () => {
  const files = [
    'app/api/payments/razorpay/order/route.ts',
    'app/api/payments/razorpay/verify/route.ts',
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /rzp_(test|live)_[A-Za-z0-9]{10,}/i);
    assert.doesNotMatch(source, /RAZORPAY_KEY_SECRET\s*=\s*['\"]/i);
  }
});
