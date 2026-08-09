# CurrentPulse AI — Quality & Architecture Upgrade

Date: 08 August 2026

This is a **patch**, not a replacement project. Extract it over the active project:

`C:\Users\prana\CurrentPulse-Original-Multi\my-app`

It intentionally contains only changed/new files so your secrets, Supabase config, Git history, `lib\coverage`, and unrelated production work stay untouched.

## What this upgrade changes

### 1. News and Current Affairs are now separate products
- `/news` is a general-public newsroom, with no UPSC/Prelims/Mains template.
- New `/news/[slug]` page has: What happened, Key facts, Context, Why it matters, map (when useful), and sources.
- `/current-affairs/[slug]` is reserved for trusted coaching/UPSC Current Affairs.
- Old wrong-stream URLs permanently redirect to the correct canonical route.
- Search, homepage cards, breaking news, feed and sitemaps use the correct stream URL.

### 2. Duplicate protection is much stronger
- Stable event keys ignore trivial headline changes and common newsroom verbs.
- Strong title similarity rejects the same event even when feed timestamps differ.
- Queue duplicate lookback: 21 days.
- Published duplicate check: 120 days.
- Homepage/stream/sitemap/feed dedupe old database duplicates at display time.
- Recent RSS items older than 96 hours are discarded by default (`NEWS_MAX_AGE_HOURS` can override this).

### 3. UPSC relevance gate rejects low-value noise
Routine tenders/procurement, ordinary company sales/earnings, routine appointments and local-noise items are rejected unless there is genuine policy/strategic significance.

### 4. Current Affairs generation is compact and higher quality
- Syllabus & Exam Relevance: 2–3 compact bullets.
- Static Foundation: 5–7 short bullets, normally 80–160 words.
- Data, Reports, Cases & Examples: target 5–6 source-backed evidence bullets.
- Prelims: 5–8 short high-yield bullets + at most 2 supported traps.
- Mains: 220–380 word analytical layer.
- Answer Framework: 100–170 word practical outline.
- Quality gate requires at least 5 evidence items and sufficient factual evidence.
- Important figures, years, Articles, Acts and institutions are highlighted automatically, including older articles.

### 5. Freshness is a hard rule
- Current office-holders, current years and current numerical data must be present in source material.
- Source-grounding normalizes `%` / `per cent` and spacing before checking.
- Unsupported current facts trigger a source-only correction, otherwise publication fails.
- Low-quality trusted-source fallback is **OFF by default**. It can only be re-enabled explicitly with:
  `ALLOW_TRUSTED_SOURCE_FALLBACK=true`

This prevents quota outages from publishing visibly degraded Current Affairs.

### 6. Cleaner article UI
- Compact Syllabus card.
- Compact Static Foundation.
- 5–6 evidence highlight cards.
- Short Prelims block.
- Mains Perspective + Answer Framework + Mains Question are hidden under one click-to-expand accordion.
- Current Affairs previous/next/related navigation stays inside the Current Affairs stream.

### 7. Safer imagery and static maps
- No random generic category image is displayed.
- No live Google Maps iframe.
- Only clearly reusable Wikimedia/Commons images with provenance are accepted for display.
- Current-event Commons images must match the requested event year in metadata; otherwise no image is safer.
- Small static schematic India/world locator maps appear when a named location is useful.

### 8. AI Assistant is resilient
- Searches published CurrentPulse content first.
- Current facts must come from retrieved CurrentPulse material.
- If Gemini/OpenRouter is unavailable but relevant articles exist, it returns a grounded CurrentPulse source brief instead of only saying “temporarily unavailable”.
- New AI Lab theme and source links.

### 9. 12-year UPSC paper library
- Coverage: 2015–2026.
- Prelims and Mains are separate tabs.
- Recent verified direct PDFs are used where configured.
- Older years open the official UPSC archive rather than guessing legacy PDF filenames.

### 10. Page identities
One CurrentPulse brand, but major areas no longer look identical:
- News: light newsroom theme.
- Current Affairs: academic cyan/slate.
- AI: violet/cyan AI Lab.
- Quiz: violet/blue.
- PDFs: emerald/amber.
- Notes: fuchsia/indigo.
- PYQ: indigo/gold.
- Question papers: academic archive.
- Videos: rose/orange.

### 11. SEO architecture
- Canonical URLs now match the content stream.
- Main sitemap routes News and Current Affairs correctly and removes duplicate events.
- News sitemap is News-only, recent, deduped and has no fragile image XML.
- RSS feed uses stream-correct canonical links.
- News articles use `NewsArticle`; Current Affairs use `Article` structured data.

## Important prerequisite

The uploaded snapshot was created with a command that excluded directories named `coverage`, so the uploaded ZIP did not contain `lib\coverage`. Your active local project previously has those files. **Do not delete `lib\coverage`.** This patch does not replace it.

The production-upgrade migration that creates `article_sources` must already be applied. Your current project already references that table. No new SQL migration is required by this patch.

## Safe Windows extraction

First back up the active project, then extract this patch over it and overwrite matching files.

Example PowerShell from CMD:

```cmd
cd /d C:\Users\prana\CurrentPulse-Original-Multi\my-app && powershell -NoProfile -Command "$src='C:\PATH\TO\CurrentPulse-Quality-Architecture-Upgrade-08-Aug-2026-PATCH.zip'; $backup='C:\Users\prana\CurrentPulse-Backup-Before-Quality-08-Aug-2026'; if(Test-Path $backup){Remove-Item $backup -Recurse -Force}; robocopy . $backup /E /XD node_modules .next .git .turbo /XF .env .env.* *.log *.zip | Out-Null; Expand-Archive -Path $src -DestinationPath . -Force"
```

Replace `C:\PATH\TO\...zip` with the downloaded patch location.

## Validate before push

```cmd
cd /d C:\Users\prana\CurrentPulse-Original-Multi\my-app && npm run build
```

If build passes:

```cmd
git status --short && git add app components lib && git commit -m "Upgrade CurrentPulse content quality news UX and SEO" && git push origin main
```

Do not use `git add .` if temporary ZIP/check files are present.

## After Vercel deploys

Check these URLs:

- `https://currentpulse-ai.vercel.app/`
- `https://currentpulse-ai.vercel.app/news`
- `https://currentpulse-ai.vercel.app/current-affairs`
- `https://currentpulse-ai.vercel.app/ai`
- `https://currentpulse-ai.vercel.app/question-papers`
- `https://currentpulse-ai.vercel.app/sitemap.xml`
- `https://currentpulse-ai.vercel.app/news-sitemap.xml`

Then test:
1. One normal News article opens under `/news/...` and has no UPSC template.
2. One coaching Current Affairs article opens under `/current-affairs/...`.
3. Mains is collapsed by default.
4. Repeated versions of the same News event no longer appear in stream/sitemap.
5. Ask AI a topic that already exists in CurrentPulse and verify source links appear.
