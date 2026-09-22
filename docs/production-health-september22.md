# Production health recovery — 22 September 2026

Baseline: origin/main `49bd00497f7a6f6f8063be3f2dfe671406c75eff`. The September 20 production deployment (35518831864) succeeded; the prior repairs were deployed. This incident is not explained by Google reporting lag.

## Verified production incident

- Supabase Data API returns HTTP 402 with `exceed_egress_quota`. The response says the owner must upgrade the plan or remove spend caps to restore service. The organization reports the Free plan. No billing changes were attempted.
- Reader-release run 35713849356 failed at its outbox preflight with HTTP 402. Background and image jobs also report failed runs.
- A full public crawl checked all 838 sitemap URLs: 378 returned HTTP 200 with Not Found titles, noindex, no canonical and no H1 (297 CA articles; 81 exam updates). The other 460 passed the audited metadata/status checks. This is not a content-quality or Google-indexing certification.
- Direct read-only SQL confirmed that three sampled failing CA articles remain published. Their public rendering path incorrectly swallowed database errors and treated null data as missing content.
- News and Hindi out-of-range archives were indexable. Static asset routing also ignored query pagination/filters on several archive roots.

## Repairs

- Distinguish data unavailability from a confirmed missing record in CA, News, exam detail and archive pages, categories, and the dynamic sitemap. Do not cache database failures as successful empty results.
- Use the CA reader's existing eligibility decision in sitemap selection; repeated sections that are cleaned for display do not exclude otherwise readable articles. Keep sitemap discovery queries lightweight.
- Build the actual release sitemap before materialization and recursively render its shards. Required sitemap pages cannot silently fail or be truncated by the page cap. A failed render does not replace a previously valid asset with a placeholder.
- Check every submitted URL's generated HTML, title, description, H1, robots and canonical before deployment. Run indexability checks in the incremental workflow before completing durable release requests.
- Add a Data API preflight before expensive builds/releases.
- Route archive content queries through Next, while unfiltered archive GET/HEAD requests use existing static assets. API/admin/member requests remain with their existing application handler. Preserve OpenNext exports through its documented custom-worker entry point.
- Extend the live audit with a full-sitemap mode and additional exhausted archive probes.

## Validation

- 220 regression tests pass, including actual page-loader outage tests, cache recovery, archive routing, recursive sitemap materialization, soft-404 rejection, and complete generated-asset verification.
- Next production compilation passed; TypeScript checks progressed to static page generation.
- Production build is BLOCKED at exam archive prerendering by the real Supabase HTTP 402. This is the intended failure instead of publishing an empty archive. Windows Node also reported a libuv shutdown assertion after the data failure; no successful build is claimed.
- The new Data API preflight independently reproduces the HTTP 402 restriction.
- No database content, RLS, accounts, or billing settings were changed.
- This change has not been deployed; production remains unhealthy until the external service is restored and a full release passes.

## Required completion sequence

1. The project owner restores the Supabase project service in the dashboard. Do not bypass the restriction using another endpoint or embed privileged keys in public files.
2. Confirm `node scripts/check-data-api.mjs` passes with the normal release environment.
3. Run regression tests and the production Cloudflare build; perform a full reader regeneration from the release sitemap. The changed rendering/routing files require a full release.
4. Require generated-asset verification before deployment and live verification afterward. Run `SEO_AUDIT_FULL=1 node scripts/audit-live-indexability.mjs` to check every submitted URL.
5. Inspect representative repaired URLs in Google Search Console, run live tests, and request indexing only after healthy content is served. Track Google's subsequent recrawls; no ranking or indexing deadline is guaranteed.

Evidence is retained in the parent workspace under `tmp/full-health-september22.json`, `tmp/health-september22-tests.log`, and `tmp/health-september22-build.log`.

Implementation references: https://opennext.js.org/cloudflare/howtos/custom-worker and https://developers.cloudflare.com/workers/static-assets/routing/worker-script/.
