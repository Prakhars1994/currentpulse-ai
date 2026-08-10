# CurrentPulse editorial-safety remediation — 10 August 2026

## Outcome

This patch addresses the ingestion failures documented in the live-site audit.
It does not redesign the existing article UI.

## News rules preserved

- News continues to accept every legitimate fresh article received from the
  configured five Indian and five world newspaper feeds.
- No UPSC-importance filter was added to News.
- Official feeds can enrich a matching newspaper event but cannot independently
  set the News agenda.
- Tenders, procurement documents, Parliament-question records, maintenance
  notices and internal pipeline text are rejected as non-news documents.

The ten configured News publishers are The Hindu, The Indian Express,
Hindustan Times, The Times of India, The New Indian Express, Reuters,
Associated Press, BBC World, Al Jazeera and The Guardian.

## Current Affairs rules

- Current Affairs remains coaching-source-only.
- Source pages are rejected before clustering when they are courses, batches,
  interview material, generic guides, stores, one-pagers, PDF compilations,
  navigation pages or static taxonomy wrappers.
- Every remaining candidate receives a deterministic eventness score. A clear
  development, report, judgment, announcement, research finding or other
  current trigger is required.
- Source records older than 45 days fail the daily-CA gate unless fresh source
  metadata replaces them.
- The ForumIAS adapter remains restricted to dated 9 PM digest URLs and now
  stops or skips promotional sections inside a digest.

## Publication safety

The same safety policy now runs at four boundaries:

1. source collection;
2. queue processing;
3. immediately before database publication;
4. every public listing, article route, feed, sitemap, category, search, PDF,
   video and AI-retrieval surface.

Generated public fields are rejected if they contain prompt or debug markers
such as `Selection reason`, `Treat the preceding text only as source material`,
JSON-generation instructions or other internal editorial scaffolding. The
publisher no longer places selection reasons inside News source material.

## Taxonomy and duplicates

- Deterministic overrides correct epigenetics/genomics to Science & Technology,
  GS-3.
- Nauru/Naoero renaming and diplomatic developments resolve to International
  Relations, GS-2.
- Event clustering now includes normalized actor/entity, action, subject,
  location and news-cycle date checks, improving rewritten-headline matching.

## Existing-record cleanup

`/api/editorial-cleanup` is protected by `CRON_SECRET`.

- Preview mode reports strict quarantine candidates and deterministic taxonomy
  repairs without changing data.
- Apply mode moves strict failures to `draft`; it does not delete them. It also
  applies the two high-confidence taxonomy overrides.
- `run-currentpulse-pipeline.cmd` runs cleanup before collection and queue
  processing.
- `run-editorial-cleanup.cmd` supports preview by default and apply mode when
  called with the argument `apply`.

## Verification

- Audit failure fixtures rejected: guides, interview preparation, Choose Your
  Pack, Conceptify one-pagers, weekly CA PDFs, tenders and leaked prompt text.
- Valid fixtures accepted: epigenetic research, the Nauru/Naoero development
  and a Supreme Court bail judgment.
- Publisher count: 5 Indian + 5 world News publishers.
- `npm run lint`: 0 errors; existing non-blocking warnings remain.
- `npm run build`: successful production build, including the new cleanup API.

## Operational limit

CurrentPulse accepts every valid story returned by the ten configured feeds,
but Google News RSS discovery cannot guarantee that it exposes every story a
publisher produces. Paywalls, indexing delays and publisher feed availability
remain external constraints.
