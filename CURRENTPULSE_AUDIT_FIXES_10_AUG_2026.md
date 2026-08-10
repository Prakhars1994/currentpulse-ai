# CurrentPulse audit fixes — 10 August 2026

## What the screenshots proved

1. The Naoero/Nauru article had no map because `ArticleStudyVisuals` returned
   `null` whenever an older database row had an empty `map_locations` field.
2. The paper library offered Mains-only years while the Prelims tab was active,
   producing an empty screen.
3. The PYQ page exposed only a 12-item annotated sampler (GS-2/GS-3,
   2018–2023) as though it were the main archive.
4. `vercel.json` had no scheduled jobs, so automatic collection and queue
   processing depended on manual curl commands.

## Fixes applied

- Map locations now use stored metadata first and then infer only known,
  coordinate-backed locations from the article title and lead.
- `Naoero`, `Republic of Naoero` and `Republic of Nauru` resolve to Nauru.
- The atlas is placed before the article text on geographical Current Affairs
  pages, so it is visible near the top rather than after several study sections.
- Nauru includes nearby Pacific states plus Pacific Ocean and Equator context.
- Indian state/location coverage and recent CA geography terms were expanded.
- Future source-grounded articles can retain the newly supported locations.
- Paper years now change with the selected stage and the year resets when the
  stage changes.
- Prelims coverage is indexed from 2011–2026; Mains from 2011–2025.
- Direct UPSC PDFs, UPSC archive links and a trusted legacy index are labelled
  separately. No third-party mirror is called an official UPSC PDF.
- The PYQ route now begins with 56 General Studies papers across 15 Mains
  examination years. It correctly identifies the 2011–2012 legacy two-paper
  pattern and the GS-I to GS-IV pattern from 2013.
- The 12 annotated themes remain available but are explicitly labelled as a
  non-exhaustive paraphrased sampler.
- Vercel cron jobs now collect four times per day and process the queue eight
  times per day. Each definition runs once daily, compatible with the Hobby
  plan's minimum interval. Vercel sends `CRON_SECRET` automatically.
- `run-currentpulse-pipeline.cmd` provides a manual catch-up command without
  copying the secret into the command prompt.

## Verification

- `npm run lint`: 0 errors (existing non-blocking warnings remain).
- `npm run build`: production build completed successfully, including all
  static and dynamic routes.
- Paper data check: 16 Prelims years, 15 Mains years, 56 Mains GS paper entries.

## Honest limits

- The official UPSC public digital archive does not expose a complete 60-year
  set of individually verifiable CSE PDFs. CurrentPulse therefore does not
  invent legacy URLs or label mirrors as official.
- Publication volume remains constrained by available Gemini/OpenRouter quota.
  The scheduler keeps retrying pending items, but it cannot make a rate-limited
  provider generate content immediately.
