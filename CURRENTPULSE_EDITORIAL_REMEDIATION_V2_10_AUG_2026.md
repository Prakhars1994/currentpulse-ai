# CurrentPulse editorial remediation v2 — 10 August 2026

This patch implements the complete seven-point live-site audit. It deliberately
does not redesign the Current Affairs article template, which the audit found to
be one of the stronger parts of the product.

## 1. Source-page rejection

- ForumIAS is restricted to dated `9 PM UPSC Current Affairs Articles` digest
  sections. Guides, courses, interview material, stores, PDFs and archive pages
  cannot enter through the ForumIAS adapter or retained source references.
- Current Affairs rejects guide pages, interview preparation/transcripts,
  topper strategy, residential batches, weekly/monthly compilations, generic
  taxonomy/category wrappers, static study material and multi-topic “in news for
  UPSC” compilations before AI generation.
- Vision source records now point to the Vision daily-summary section rather
  than incorrectly presenting its external newspaper link as the coaching URL.

## 2. Eventness gate

- A long page and a recent crawl date no longer make a page current affairs.
- Every coaching candidate must contain an explicit time-bound trigger: a
  decision, announcement, judgment, report release, research finding, disaster
  or comparable development.
- The same deterministic gate runs at collection, queue processing, final
  publication and public-display boundaries.
- Archive validation compares the retained source date with the article's own
  publication date, so legitimate older CA remains visible while static pages
  are rejected.

## 3. Strict AI-failure fallback

- Source-only fallback requires at least five usable source points for Current
  Affairs.
- Unsupported current figures and office-holder claims still fail grounding.
- Promotional and pipeline/debug paragraphs are removed before fallback.
- Fallback output must pass the same publication and eventness checks as AI
  output; otherwise the queue item is rejected instead of publishing a polished
  but unsupported page.

## 4. Hard taxonomy validation

- Epigenetics, genetics, DNA methylation, genomics and related material map to
  `Science & Technology · GS-3`.
- Nauru/Naoero and relevant Pacific-island diplomatic developments map to
  `International Relations · GS-2`.
- AI/source category hints are weak evidence and cannot overpower the article's
  subject matter.
- `Sports` requires actual sports vocabulary.
- Category-to-paper consistency is enforced; `Social Issues` maps to `GS-2`.
- Cleanup now applies every deterministic category/paper correction, not only
  two hard-coded overrides.

## 5. Event duplicate clustering

- Short shared subjects and bigrams now catch `Organ Donation...` and
  `Bail Conditions...` rewrites.
- Pact/agreement, donation/transplantation and country-name normalization catch
  the Turkey–Saudi Arabia–Pakistan defence-pact rewrite.
- Opposite actions such as `RBI cuts` and `RBI raises` are not merged.
- Identical subjects more than three days apart can remain separate genuine
  developments.
- Duplicate checks run before AI generation, after headline generation, in the
  queue, in public lists and in the archive cleanup.
- Concurrent queue workers defer a matching active event, closing a race that
  could otherwise create two records simultaneously.

## 6. Internal and promotional text sanitizer

- Existing prompt/debug rejection remains active.
- ForumIAS promotional blocks such as topper-answer/course advertisements are
  removed from retained source text and public knowledge fields.
- Cleanup reports and repairs affected fields without rewriting article facts.

## 7. Existing-record cleanup

`/api/editorial-cleanup` remains protected by `CRON_SECRET` and is preview-only
unless `apply=1` is supplied.

It now finds:

- unsafe/non-event Current Affairs;
- routine procurement, tenders, company-quarter results, corporate contracts
  and celebrity social posts in News;
- stale source dates and old years presented as fresh news;
- taxonomy inconsistencies;
- promotional/internal text;
- same-event duplicate groups.

Apply mode does not delete articles. Unsafe and duplicate rows become drafts.
For duplicate groups, the richest/highest-quality article is retained and the
duplicate's source-provenance rows and queue links are moved to that keeper.

## Deployment

Extract the overlay, commit it and push `main`. After Vercel reports a successful
production deployment, run cleanup preview first:

```cmd
run-editorial-cleanup.cmd
```

Read the JSON findings. Then apply the remediation once:

```cmd
run-editorial-cleanup.cmd apply
```

Finally collect and process fresh content through the corrected pipeline:

```cmd
run-currentpulse-pipeline.cmd
```

## Verification

```cmd
npm run test:editorial
npm run lint
npm run build
```

The focused test suite covers every named failure from the audit, including the
three duplicate examples and the required negative control for opposite/later
developments.
