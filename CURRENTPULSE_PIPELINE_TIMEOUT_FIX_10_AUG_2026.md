# CurrentPulse pipeline timeout fix — 10 August 2026

## Problem

The synchronous pipeline called News collection and every UPSC Current Affairs
adapter in one Vercel invocation. Optional topic-page enrichment could also open
every topic found in a daily digest. Together these jobs could exceed the
function's 300-second execution limit and return `FUNCTION_INVOCATION_TIMEOUT`.

## Fix

- Added `scope=news` and `scope=coverage` modes to `/api/auto-publish`.
- The Windows runner now gives News and Current Affairs separate Vercel
  invocations and separate runtime budgets.
- Daily-digest detail enrichment is capped at 24 topics per source invocation.
  Remaining topics are retained from their already-extracted digest summaries,
  so the cap reduces optional HTTP work rather than discarding CA topics.
- Added `run-currentpulse-pipeline.cmd resume` to continue after a successful
  cleanup without running the cleanup step again.

## Run after deployment

```cmd
run-currentpulse-pipeline.cmd resume
```

The script continues to read `CRON_SECRET` automatically from `.env.local`.
