# CurrentPulse Automation & Reader Ownership

## Production code
- **GitHub `CurrentPulse Production CI & Deploy`** validates every `main` change.
- It runs regression tests, builds the OpenNext bundle, renders the public reader into static HTML assets, deploys that exact validated bundle with Wrangler, and smoke-tests production.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are required for unattended GitHub deployment.

## Scheduled content automation
- **GitHub `CurrentPulse Background Automation` is the single heavy scheduled owner.**
- It runs at approximately **06:30, 09:30, 12:30, 15:30, 19:30, 22:30 and 23:30 IST**.
- The 06/12/19/22 windows run trusted coaching CA, queue processing and ResultPulse according to the schedule policy.
- News runs at the six freshness windows. The 23:30 window is reserved for archive/editorial cleanup.
- Existing cron-job.org calls remain heartbeat-only compatibility calls. They must not duplicate collection or AI work.

## Static reader release
- Reader traffic must not use Supabase as an origin per page view.
- After a successful scheduled content run, GitHub builds once, renders canonical public pages from the current database, writes them into `.open-next/assets`, then deploys them.
- Cloudflare serves matching HTML through **Static Assets before the Worker**. API and admin routes explicitly remain Worker-first.
- Static-reader requests are therefore decoupled from Worker SSR and Supabase request volume.
- If a requested reader URL has no materialized asset, OpenNext remains a fallback, but the high-traffic canonical corpus should be materialized.

## Maintenance
- `CurrentPulse Quality & Freshness Maintenance` is **manual-only**. It is no longer a second scheduled owner.
- Scheduled ResultPulse/quiz/cleanup work belongs to the background workflow.
- Production and background releases materialize public snapshots only after quality gates have run.

## Article quality
- `/api/editorial-cleanup` remains the single taxonomy authority.
- `/api/quality-repair` scores/quarantines weak content and repairs maps but never reclassifies taxonomy.
- New trusted CA AI output must meet the stronger public quality floor.
- Source-grounded emergency CA fallback may publish only when the retained source extract is rich enough; generic fallbacks remain queued for a later AI pass.

## 50k-read target
- Public reading must scale with Cloudflare Static Assets, not with the number of Worker/Supabase requests.
- Article view counting must never write to Supabase per reader.
- Supabase remains the private content origin for automation/admin/build-time rendering.
- Interactive AI remains a separate quota class and is not covered by the 50k free-reader target.
