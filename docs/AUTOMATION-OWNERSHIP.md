# CurrentPulse Automation Ownership

## Production code
- **GitHub `CurrentPulse Production CI & Deploy`** is the only code build/deploy pipeline.
- Every push to `main` runs regression tests, builds the OpenNext Cloudflare Worker, deploys that exact build, then smoke-tests production.
- A missing `CLOUDFLARE_API_TOKEN` is a real deployment failure and must not appear green.

## Scheduled content collection
- Existing **external cron runners** own scheduled News and Current Affairs collection.
- `.github/workflows/currentpulse-background.yml` is manual catch-up only.
- Do not enable a second hourly GitHub collector unless the external cron architecture is intentionally retired.

## Maintenance
- `CurrentPulse Quality & Freshness Maintenance` owns ResultPulse activity-window checks, daily quiz refreshes and editorial/quality maintenance.
- Data maintenance updates Supabase only. It does **not** rebuild or redeploy the Worker.

## Taxonomy
- `/api/editorial-cleanup` is the single authority for category and GS-paper corrections.
- `/api/quality-repair` owns quality scoring/quarantine and map cleanup, but never changes taxonomy.
- This prevents category oscillation between consecutive maintenance passes.

## Cost rule
A database content change must not trigger a code deployment. Public pages use runtime/ISR reads and Cloudflare incremental cache, so only code/config changes need a Worker build.
