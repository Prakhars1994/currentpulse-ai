# SEO recovery audit — 20 September 2026

Baseline: CurrentPulse main 37649ef2387bac16f20ef91b993205588fa92b9e; VDL main 9c0158add09c87f27788bccacc8f0887c3bd2a34.

## Verified findings

- CurrentPulse production run 35421543047 failed before build/deployment: tests/resultpulse-filters.test.mjs ended inside a test. The two preceding production runs also failed. Restoring the test exposed two whitespace-sensitive assertions; their checks now tolerate formatting without changing the behavior asserted.
- The public CurrentPulse sitemap lists 838 URLs. All 77 sampled sitemap URLs passed HTTP status, robots, canonical, title and description checks. This is a bounded sample, not a full crawl or Google index-status report.
- /current-affairs?page=99999 returns HTTP 200 with index/follow and no content. A bounded read-only database query confirmed that a counted range beyond the final row returns HTTP 416, PGRST103. The loader treated this as an outage, preventing the existing page notFound guard from running. The repair normalizes only PGRST103 on later offsets into an exhausted page; other errors are preserved.
- /news/page/99999 returns a streamed HTTP 200 with noindex. The audit accepts this Next.js fallback while preferring real 404/410 responses.
- All 11 VDL sitemap URLs passed the same checks, and its unknown-page probe returned 404. No verified VDL crawl-blocking defect was found; rewriting it is not justified by these results.
- Both current hosts serve robots.txt and sitemap.xml successfully. The older cp.vishwakarma-labs.workers.dev hostname could not be reached. Restoring redirects from an unavailable old host requires control of that host.

## Prevention

The live indexability audit now exits unsuccessfully for detected issues, rejects an empty sitemap, and probes missing archive pages. Production CI runs it after deployment before recording a validated release snapshot. SEO_AUDIT_ORIGIN and SEO_AUDIT_OUTPUT allow the same audit to check VDL. Existing article publication/indexability policies remain in force.

## Validation

- Complete local regression suite: 211 passed, zero failed.
- New tests execute the actual archive loader with PostgREST responses; range exhaustion, database connection failures, authorization errors and first-page range errors are covered.
- New audit against live CurrentPulse: fails specifically on the known indexable empty archive URL.
- New audit against live VDL: 11 sitemap pages passed, zero issues.
- Production build and deployment status must be recorded separately; passing unit tests does not establish a live repair.

## Google evidence still required

Current Search Console Page indexing exclusions, URL Inspection results, Google-selected canonicals, sitemap processing timestamps and impressions were not available. A public fetch or site-search result does not establish Google indexing. Inspect representative home, service and article URLs in the exact current-host properties. Use Google’s live URL test after release and request indexing for a small representative set; monitor subsequent recrawls. Do not manufacture publication dates, remove legitimate noindex rules, or assume sitemap submission guarantees indexing.

References: https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors and https://postgrest.org/en/stable/references/errors.html.

## Final local build verification

Production Next.js build completed successfully. Requests to the built app confirmed:
- /current-affairs?page=99999: streamed HTTP 200, noindex present, archive content absent.
- /current-affairs: HTTP 200, no noindex, archive content present.

A true HTTP 404 remains preferable, but the repaired Next.js notFound path now emits its exclusion directive. Cloudflare/OpenNext CI and post-deployment verification have not run. Automatic approval review blocked pushing the repair branch because publishing to the external repository was not explicitly authorized. No push or deployment was performed.

## Search Console diagnosis and routing recovery

The 20 September Search Console Page indexing report shows 798 URLs as "Discovered – currently not indexed" and one URL as "Crawled – currently not indexed." This points to crawl prioritization and page reliability, not a robots.txt block. A complete public sitemap crawl found 838 submitted URLs: 425 Current Affairs articles, 350 ResultPulse updates, 30 News articles, and 33 landing pages.

Sequential checks of representative submitted URLs then reproduced the decisive delivery failure: a Current Affairs article returned Cloudflare Worker error 1102/HTTP 503; other submitted article, News, and ResultPulse URLs returned HTTP 200 with no canonical, title, description, or H1. The deployment configuration forced every public reader path through the Worker even though the release pipeline had already materialized static HTML for those paths.

The route policy now makes public reader pages, XML, and archives asset-first. Only `/api/*`, `/admin/*`, and member-only paths remain Worker-first. This lets Cloudflare serve the generated reader HTML without executing the Supabase-heavy rendering path; URLs with no matching static file still fall through to the Worker.

Validation after this recovery change: all 211 regression tests pass and the production Next.js build completes. The local build reported `JWT issued at future` for optional News/homepage data during static generation, but it completed successfully; that is an environment-clock/key issue to correct in CI if it also appears there, not a release failure in the asset-route change.
