# CurrentPulse AI — GitHub Actions background-compute phase

This patch moves scheduled heavy automation off the public hosting request path without changing the existing API implementation.

## Why this intermediate design

The runner starts a private Next.js development server on `127.0.0.1` inside the ephemeral GitHub Actions VM and calls the existing authenticated route handlers there. News collection, coaching coverage, queue publishing, AI orchestration, ResultPulse parsing, and Supabase writes therefore execute on the GitHub runner rather than on Vercel/Cloudflare.

This deliberately avoids duplicating the production pipeline or maintaining a second implementation. A later refactor can extract the route cores into direct CLI workers to remove the small Next dev-server startup overhead.

## Schedule

- `:07` each hour: scheduled News/CA collection + one queue batch.
- `:37` each hour: one queue batch only.
- Every second `:07` run: scheduled ResultPulse source scan, notifications disabled.
- Manual workflow modes: smart, collect, queue, exams.

The workflow uses one concurrency group so overlapping automation runs cannot pile up.

## Required GitHub repository secrets

Minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended if the corresponding features are enabled:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- AI provider keys already used by CurrentPulse (`GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, etc.)
- Notification provider keys only when notifications are intentionally enabled later.

The workflow uses a local-only `CRON_SECRET` because the Next server is bound to `127.0.0.1` inside the runner. Do not copy the production CRON secret into GitHub just for this workflow.

## Safety

Keep Vercel crons and cron-job.org jobs disabled while validating this workflow. Do not enable notification delivery yet; the ResultPulse scheduled call uses `notifications=0`.

No GitHub Actions artifacts are uploaded, keeping Actions storage usage at zero for these scheduled jobs. npm dependency caching is enabled through `actions/setup-node`.
