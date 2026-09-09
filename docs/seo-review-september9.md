# CurrentPulse indexing review — 9 September 2026

Production source inspected: origin/main at 073147a. Repair branch: fix/seo-september9.

## Evidence

- The supplied Performance screenshot shows only the homepage with impressions. Performance is not the Page indexing report, so this does not establish that every other URL is unindexed.
- Today's live sitemap contains 1,357 URLs. A bounded sample of 78 URLs had HTTP 200, matching canonicals, descriptions and titles, and no noindex directives. This is not a full-site crawl or a Google index-status check. See live-indexability-september9.json.
- Public robots.txt allows crawling and advertises the canonical sitemap.
- Live Current Affairs page 2 canonicalizes to page 1. The Hindi archive does the same and repeats the site name in its title.
- Live empty archive pages, including /news/page/99999, return 200 with empty results. See live-archive-audit-september9.json.
- The current archive exposes seven dates in a form selector and only five in its recent-date links. Older dates require sequential navigation.
- An earlier local review recorded Google's August 28 report as one indexed, 495 discovered-not-indexed and one crawled-not-indexed. That is historical evidence, not today's status.
- GSC Wizard refused access because the connected subscription expired. Current Google-selected canonicals, crawl timestamps and exclusion reasons could not be verified in this run.

## Repairs

Preserve page numbers in English/Hindi archive canonicals; validate positive integer pagination and real calendar dates; use Next.js notFound for invalid and exhausted later pages; link all dates returned by the archive loader using server-rendered anchors; give date/exam/language combinations appropriate metadata; remove the duplicated Hindi title brand and implementation language from reader copy. Existing publication and licensed-content indexing policies remain authoritative.

## Validation and release

174 regression tests pass, including executing the actual page metadata and empty-page handlers with controlled data. Targeted ESLint reports zero errors and two existing img warnings. No production build or deployment has been performed locally. CI should validate the Cloudflare build before release; after release, verify not-found handling, canonicals and archive links in real HTTP responses (Next.js streaming can affect status delivery).

## Search Console follow-up

1. Open Page indexing and inspect representative published article URLs from the sitemap. Record coverage reason, last crawl, fetch state, user canonical and Google canonical.
2. Verify sitemap.xml is processed successfully and its last download is recent; resubmit it if stale or failed.
3. After deployment, use Test live URL and Request indexing for a small set of substantive current-affairs articles and the archive hubs. Do not request empty URLs or intentionally noindexed republications.
4. Compare indexed pages and page/query impressions after Google recrawls. If technically valid pages remain discovered-not-indexed, assess unique editorial value, source attribution, overlap and internal links using Google's actual exclusion evidence. Do not mass-remove noindex or manufacture article updates.

Google recommends self-canonicals for each paginated page and crawlable anchors: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading

Recrawling may take days to weeks and does not guarantee inclusion: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
