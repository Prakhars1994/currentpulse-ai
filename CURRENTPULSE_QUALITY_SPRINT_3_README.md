# CurrentPulse Quality Sprint 3 — 10 Aug 2026

This is a delta patch for the current project after the dual-stream/coaching-source work.

## Fixes

### 1. News archive no longer collapses to 1–2 visible cards
The previous loader paginated raw database rows first and then applied display-quality filtering and event deduplication. If most of the first 48 raw rows were removed, the page could show only a couple of stories and older News appeared to vanish.

The new loader scans News-source rows in bounded chunks until the requested *cleaned* display page is full, then paginates. Older News remains reachable with Newer/Older navigation.

### 2. Current Affairs queue throughput
- Processing concurrency raised from 2 to 3.
- One temporary AI/model failure no longer stops the entire queue run.
- The run continues through other candidates and only stops after 6 temporary AI failures, protecting both coverage and quota.

This is intended to reduce the situation where many coaching items are queued but only 1–2 Current Affairs articles publish in a day.

### 3. Stronger in-sentence highlighting
Highlighting now covers more than section headings:
- historical and current years
- dates
- percentages and measured quantities
- rupee/dollar/euro/pound amounts
- Articles, Sections, Chapters, Schedules and Amendments
- Acts, Bills, Codes, Rules, Treaties, Conventions and Agreements
- Reports, Indices, Surveys, Census, Schemes, Missions and Policies
- major institutions
- useful acronyms such as RBI, BNSS, UPI, GDP, PLI, etc.
- short concept labels before a colon

### 4. Accurate political + physical static maps
The old manual percentage markers were replaced for supported locations with latitude/longitude-based markers on equirectangular location maps.

For Indian locations the card shows both:
- Political map
- Physical/relief map

Both use the same geographic limits, so the same coordinate marker aligns on both views. Common UPSC locations include Mumbai, Bengaluru, Tamluk, Satara, Ballia, Delhi, state capitals and major states. Unknown places are shown without a guessed marker rather than marked incorrectly.

World locations use equirectangular political and physical maps as well.

## Map licenses / attribution
- India political map: Wikimedia Commons, Uwe Dedering — CC BY-SA 3.0.
- India relief map: Wikimedia Commons, Uwe Dedering — CC BY-SA 3.0.
- World political map: Wikimedia Commons, public domain.
- World physical map: Wikimedia Commons, Gundan — CC BY-SA 4.0.

The UI includes a compact attribution note.

## Files changed
- `app/news/page.js`
- `app/api/process-queue/route.js`
- `app/globals.css`
- `lib/articleStreams.js`
- `lib/study/highlightFacts.js`
- `components/ArticleStudyVisuals.jsx`
- `public/maps/india-location-map.svg`
- `public/maps/india-relief-location-map.jpg`
- `public/maps/world-location-map.svg`
- `public/maps/world-physical-map.jpg`
