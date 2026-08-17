# CurrentPulse timeout architecture

## Core rule

No scheduled request may try to finish the entire CurrentPulse workload.

Durable collection, AI publication, maintenance, static rendering and deployment
are independent bounded phases. A slow source/provider can defer its own work but
must not fail unrelated Current Affairs, News, ResultPulse or public delivery.

## Current Affairs

- Seven UPSC-focused coaching sources only.
- Each source adapter has a 45-second whole-source deadline.
- Individual HTTP fetches default to 12 seconds.
- Coverage import performs fetch -> sanitize -> dedupe -> durable queue only.
- It never calls AI publication inline.
- Queue publication is separately bounded by the queue processor.

## News

- Scheduled runs are small source slices.
- A manual/full refresh is six publishers per request.
- Response metadata exposes batchIndex, batchCount and hasMore.
- A slow publisher cannot hold all configured news publishers hostage.

## ResultPulse

- Scheduled runs keep the existing six-authority rotation.
- Full catch-up is at most six official authorities per request.
- The caller continues through batch metadata.

## Queue / AI

- The API has its own runtime hard stop.
- Workflow draining stops when multiple temporary failures establish a provider outage.
- Pending rows remain durable and retry at a later window; the workflow does not hammer
  exhausted free AI providers for the rest of the job.

## Editorial and quality maintenance

- Each request scans at most 300 rows.
- created_at cursors expose nextBefore/hasMore.
- Initial catch-up loops through cursor pages.
- Normal scheduled maintenance only needs the newest bounded page.
- Editorial duplicate comparison is therefore bounded to at most ~90k comparisons per request.

## Static reader

- Materialization defaults to 1,200 high-priority/recent reader pages.
- Per-page requests are bounded.
- The whole materialization release has a 12-minute deadline.
- Core pages render first.
- Within Current Affairs/News classes, sitemap order is preserved so newest content wins.
- Unrendered old pages fall back to the Worker rather than causing the release to time out.

## GitHub deploy

- Missing CLOUDFLARE_API_TOKEN is a deploy-readiness warning, not a failed code build.
- Content automation can still finish and persist to Supabase.
- Unattended static snapshot deployment remains skipped until the repository token is added.

## Local project selection

- tools/find-currentpulse-production.ps1 discovers the clean checkout that matches origin/main.
- Future update scripts must call/replicate this check before modifying any CurrentPulse copy.
