# CurrentPulse — Important News → Current Affairs Dual Stream + 4 Source Repair

Date: 09 Aug 2026

This patch is designed to be applied **after commit e3a8e58 / the current successful build**.
It also includes the previously supplied 4-source coaching repair because that ZIP had not yet been applied.

## 1) Important News now also becomes Current Affairs

Every item that reaches the automatic News publishing queue has already passed the CurrentPulse UPSC relevance gate.
For those items, CurrentPulse now keeps **one database article** but preserves two presentations:

- `/news/[slug]` → normal newsroom presentation for ordinary readers
- `/current-affairs/[slug]` → UPSC study presentation with syllabus, static foundation, evidence, Prelims and Mains

The newsroom version is stored in the existing `content` field using an internal versioned JSON snapshot. The UPSC fields can then be enriched without destroying the normal News version.

## 2) When a News event already exists as Current Affairs

The system no longer treats that as a dead-end duplicate. It:

- attaches the News source to the existing article,
- creates/preserves the normal News presentation,
- keeps the Current Affairs presentation,
- exposes the same underlying event in both streams.

## 3) When coaching coverage later finds a News event

The coaching merge/enrichment can update the Current Affairs analysis while the News presentation remains preserved in `content`.

## 4) Stream logic

- News stream: article has at least one `source_kind = news`.
- Current Affairs stream: article has coaching coverage **or** has study-ready syllabus + Prelims + Mains fields.
- A dual article can therefore correctly appear in both sections.

## 5) SEO / sitemap

A dual article can expose two genuinely different presentation URLs:

- News version uses NewsArticle presentation/canonical.
- Current Affairs version uses Article study presentation/canonical.
- Main sitemap can include both when both presentations exist.
- News sitemap keeps the News URL even after coaching material is merged.

## 6) 4 coaching-source repair included

Included repaired adapters:

- Insights IAS
- ForumIAS
- Vajiram & Ravi
- IASbaba

These are the same 4-source repair files from the previous patch that had not yet been applied.

## Files in this patch

- `app/api/process-queue/route.js`
- `app/current-affairs/[slug]/page.js`
- `app/current-affairs/page.js`
- `app/globals.css`
- `app/news/[slug]/page.js`
- `app/news-sitemap.xml/route.js`
- `app/sitemap.ts`
- `lib/articleStreams.js`
- `lib/news/newsPresentation.js`
- `lib/publisher/publishArticle.js`
- `lib/coverage/adapters/insights.js`
- `lib/coverage/adapters/forum.js`
- `lib/coverage/adapters/vajiram.js`
- `lib/coverage/adapters/iasbaba.js`

## Validation

Plain JavaScript modules in the patch were syntax checked in the packaging environment.
Run `npm run build` locally before commit/push because the local project contains the full Next.js dependency tree and production environment variables.
