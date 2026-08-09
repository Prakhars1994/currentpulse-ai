# CurrentPulse Coaching Coverage Completeness Upgrade

Purpose: collect all *new/recent daily current-affairs items* exposed by each configured coaching source, then let the existing CurrentPulse event-level deduplication and source-merging pipeline create one hybrid event per real-world development.

Key changes:
- Daily-digest adapters scan multiple recent digest pages instead of only the first/latest URL.
- Tiny 10/14/20 topic caps are removed/replaced with high safety ceilings.
- Vajiram collects both Prelims and Mains daily streams.
- A 2-4 page rolling overlap catches items missed by a previous cron run.
- Coverage import candidate ceiling raised from 200/250 to 600/800.
- No historical archive flood: the crawler focuses on recent rolling pages and relies on the existing article/source dedup state.

After applying: run `npm run build`, then test `/api/coverage-import?source=all&limit=800` with the CRON_SECRET bearer header. Inspect `sources`, `sourceErrors`, `fetched`, `hybridEvents`, `queued`, `queueUpdated`, `alreadyMerged`, and `noiseRejected` in the JSON result.
