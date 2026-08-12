# CurrentPulse AI — Low-CPU Automation Fix

Baseline verified against `CurrentPulse-LATEST-12-Aug-2026.zip` supplied on 12 Aug 2026.
This patch is an overlay: it changes only the automation/scaling files listed below and does not remove the user's other ResultPulse work.

## What this fixes

- `/api/auto-publish` defaults to a **scheduled low-CPU mode** instead of scanning every News + coaching source on every call.
- The 5 agenda Indian publishers + 5 agenda world publishers + PIB stay hot every News run; supplemental sources rotate.
- Coaching Current Affairs sources rotate 2 per hourly run, covering all 8 across four hourly slots.
- News duplicate checks use a shorter active-news-cycle window and preload recent queue state once instead of doing an expensive event scan for every candidate.
- Queue Processor drops from 3 workers / 6 items / 300s ceiling to 2 workers / 4 items / 150s ceiling.
- AI quota failures now cool down for 120 minutes; broad failed-item recovery runs only every 6 hours.
- Legacy article quality upgrades no longer run inside the production queue cron.
- Quiz refresh is attempted only around 06:00 and 18:00 IST instead of every queue run.
- ResultPulse keeps UPSC, SSC, and NTA hot every run and rotates two supplemental exam sources; all 11 sources are covered across four 2-hour slots.
- ResultPulse persists ETag / Last-Modified / content hash checkpoints. Unchanged official pages skip Cheerio parsing and database candidate writes.
- ResultPulse bulk-checks fingerprints and bulk-inserts unseen records instead of upserting every candidate one by one.
- First successful scan of each exam source is treated as bootstrap and does **not** generate alert spam for historical rows.
- Notification delivery is capped to one event / 150 subscribers per invocation and continues by cursor offset instead of looping through hundreds or thousands in one function run.
- Duplicate article checks in publishing use a normal active-news-cycle window for News while retaining a longer trusted-coverage window for Current Affairs.

## Files changed

- `app/api/auto-publish/route.js`
- `app/api/process-queue/route.js`
- `app/api/exams/run/route.js`
- `lib/automation/schedulePolicy.js` (new)
- `lib/coverage/queueCoverageImport.js`
- `lib/exams/collector.js`
- `lib/notifications/dispatch.js`
- `lib/publisher/publishArticle.js`
- `lib/queue/queueCandidate.js`
- `supabase/migrations/20260811_resultpulse_notifications.sql`
- `supabase/migrations/20260812_low_cpu_automation.sql` (new)
- `tests/automation-schedule.test.mjs` (new)
- `package.json`

## Required database step

Before re-enabling ResultPulse automation, run this migration in Supabase SQL Editor:

`supabase/migrations/20260812_low_cpu_automation.sql`

It is idempotent and adds the low-CPU queue indexes, notification delivery cursor, and persistent official-source checkpoint table.

## Recommended external cron schedule after successful deployment

- Auto News / CA: every 60 minutes at `:00`
- Queue Processor: every 60 minutes at `:30`
- ResultPulse Exams: every 2 hours at `:45`

Keep all three jobs disabled until the migration, local build, Git push, Vercel deployment, and one manual endpoint test have succeeded.

## Manual full scans

Normal cron requests should use the bare endpoints. Full scans are intentionally manual-only:

- Full News + CA: `/api/auto-publish?scope=all&full=1&wait=1`
- Full ResultPulse: `/api/exams/run?full=1`

Do not schedule these full-scan URLs.

## Validation performed in the patch workspace

- Node syntax checks passed for every changed JS route/library file.
- Automation schedule tests passed: 3/3.
- Tests verify that core News sources stay hot, all coaching sources rotate through four hourly slots, and UPSC/SSC/NTA stay hot while all exam supplements rotate through four 2-hour slots.

A complete `next build` should still be run on the user's machine before commit because the isolated patch workspace does not carry the project's installed `node_modules` from the user's Windows project.
