import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('member auth UI supports login and signup without privileged browser secrets', () => {
  const auth = read('app/member/login/page.tsx');
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /signUp/);
  assert.doesNotMatch(auth, /SERVICE_ROLE/i);
});

test('member dashboard uses authenticated data rather than placeholder statistics', () => {
  const page = read('app/member/page.tsx');
  assert.doesNotMatch(page, /Production authentication UI is being connected/);
  assert.match(page, /mains_entitlements/);
  assert.match(page, /mains_attempts/);
});

test('shop obtains products from server and starts payment server-side', () => {
  const shop = read('app/member/shop/page.tsx');
  assert.match(shop, /mains_products/);
  assert.match(shop, /api\/payments\/razorpay\/order/);
});

test('payment order route uses authoritative database price and requires authentication', () => {
  const route = read('app/api/payments/razorpay/order/route.ts');
  assert.match(route, /auth\.getUser/);
  assert.match(route, /mains_products/);
  assert.match(route, /price_paise/);
  assert.doesNotMatch(route, /body\.price|amount_paise\s*=\s*body/i);
});

test('payment verification validates signature before granting entitlement', () => {
  const route = read('app/api/payments/razorpay/verify/route.ts');
  const verifyAt = route.search(/timingSafeEqual|signature/i);
  const entitlementAt = route.indexOf('mains_entitlements');
  assert.ok(verifyAt >= 0, 'signature verification is required');
  assert.ok(entitlementAt > verifyAt, 'entitlement must be granted only after verification');
});

test('no test-payment bypass can grant production entitlement', () => {
  for (const path of ['app/api/payments/razorpay/order/route.ts','app/api/payments/razorpay/verify/route.ts']) {
    const source = read(path);
    assert.doesNotMatch(source, /simulate[_ -]?payment|fake[_ -]?payment|bypass[_ -]?payment|grant[_ -]?without[_ -]?payment/i);
  }
});
