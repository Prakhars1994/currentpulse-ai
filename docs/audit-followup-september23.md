# Audit follow-up — September 23

The previous claim of a completed line-by-line end-to-end audit was too broad. Repository searches, lint, type checks, dependency scanning and regression tests do not establish full manual coverage or live correctness.

## Verified

- GitHub run 35763647428 for commit 0d2f69e passed all 220 regressions, then failed the data API preflight with HTTP 402 / exceed_egress_quota.
- A fresh read-only preflight on September 23 reproduced that restriction. No billing changes were made.
- The AI page's browser-dependent state initializer could disagree with server rendering for topic links. It now uses a consistent server snapshot and reads the browser topic after hydration, retaining user edits.

## Still required

- Complete a production OpenNext build with the updated dependencies; the new dependency set has not passed that build.
- Validate the js-yaml major-version override against its callers; a clean advisory scan alone does not establish compatibility.
- Reconcile sitemap discovery with reader eligibility. Removing body fields means body-based publication checks cannot detect excluded content in the sitemap fallback.
- Paginate the static sitemap's exam query: a single unrestricted REST select may be truncated by the server row limit.
- Verify live rendered assets, hydration, archive filters, private member flows, and release freshness after service recovery.
- Audit remaining source files and database policies with an explicit coverage inventory. No every-line coverage claim is made.

The draft PR remains undeployed. Zero-cost constraints remain in force.
