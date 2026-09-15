# CurrentPulse membership + payment E2E

## Production safety rule

There is deliberately no fake-payment endpoint in production. A test must never create a paid entitlement merely because a browser says payment succeeded.

## Zero-cost CI path

Every commit runs static/contract regression tests that verify:

1. login/signup remain wired to Supabase Auth;
2. member dashboard reads real entitlements and attempts;
3. shop reads server-backed products;
4. payment order route authenticates the student and obtains the price from `mains_products`;
5. payment verification occurs before entitlement grant;
6. no privileged Supabase or Razorpay secret is embedded in browser/source code;
7. no fake-payment bypass exists.

This path consumes no payment transaction and no AI inference.

## Real gateway E2E path (only after merchant onboarding)

Use the payment provider's TEST credentials in Worker secrets, never in source code.

Golden journey:

1. create/login a test student;
2. open `/member/shop`;
3. select Daily Mains Sprint;
4. server creates a provider test order using the DB price;
5. complete provider TEST checkout;
6. server verifies provider payment signature;
7. `mains_orders.status` becomes `paid`;
8. exactly one `mains_entitlements` row is created;
9. dashboard credit increases by exactly one;
10. logout/login and verify credit persists.

Failure/security journeys:

- unauthenticated order request => 401;
- inactive/unknown product => rejected;
- browser-modified amount => ignored/rejected because DB price is authoritative;
- invalid payment signature => no entitlement;
- repeated verification => no duplicate entitlement;
- another student cannot read the order/entitlement;
- missing gateway credentials => safe configuration error, never free access.

## Live activation

Do not enable live payments until the TEST golden journey and all failure/security journeys pass. Merchant KYC and settlement-bank configuration are external provider requirements and are not stored in this repository.
