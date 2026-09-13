# CurrentPulse Current Affairs Publishing Contract

This file is the canonical, versioned source of truth for generating and publishing CurrentPulse Current Affairs. ChatGPT/Codex/admin tooling must synchronize with current production code and this contract before preparing a new CA batch. If an assistant response, PDF generator, importer, database normalizer, quality gate, or live reader is out of sync, do not publish until the mismatch is resolved.

## Permanent CA PDF style

Use the approved CurrentPulse 3-page-per-article format represented by the CA 162-169 template and the CA 186-193 12 Sep 2026 batch.

Each article must contain exactly one machine boundary pair:

- `[[CA_START]]`
- `[[CA_END]]`

Metadata immediately after `[[CA_START]]`:

- `CA_TITLE:`
- `CA_CATEGORY:`
- `CA_GS:`
- `CA_DATE: YYYY-MM-DD`
- `CA_IMAGE: NO` unless a manually reviewed image is deliberately embedded

Visible reader/editorial order:

1. `CURRENT AFFAIRS N`
2. Article title
3. Metadata table: Category | GS | Date | Quick rule
4. `FAST READ - read only this box if short on time`
5. `WHY IN NEWS`
6. `TOP DATA & FACTS`
7. `PRELIMS`
8. `QUICK REVISION`
9. `PROBABLE OBJECTIVE QUESTION`
10. Four options `(a)` `(b)` `(c)` `(d)`
11. `Answer:` and `Explanation:`
12. `Ask CurrentPulse AI: Prelims`
13. `PROBABLE MAINS QUESTION`
14. `MODEL ANSWER (~300 WORDS)`
15. `INTRODUCTION`
16. Topic-specific `SIGNIFICANCE`
17. Topic-specific `CHALLENGES`
18. `WAY FORWARD`
19. `CONCLUSION`
20. `Ask CurrentPulse AI: Mains`
21. `SOURCES`

## Permanent visual rules

- Exactly 3 A4 pages per CA.
- White background, dark-blue CurrentPulse section bars/titles, light-blue metadata table, yellow FAST READ box.
- Clean whitespace; no clipping, overlapping text, broken glyphs, or raw extraction/control metadata in reader content.
- The visible metadata table should not leak `Category GS Date Quick rule` into extracted article text. Rasterization is acceptable where required.
- Footer/header should identify CurrentPulse AI, batch CA range/date, and page number.

## Editorial density

Preferred target per article:

- FAST READ: 3 concise bullets.
- WHY IN NEWS: 2-3 genuinely different bullets; never copy FAST READ verbatim.
- TOP DATA & FACTS: 12-15 strong, factual, exam-relevant bullets; minimum production gate applies.
- PRELIMS: 6 compact exam-oriented bullets preferred.
- QUICK REVISION: 4-6 compact recall bullets and long enough to satisfy the current production gate.
- MCQ: exactly 4 visible options, one intended answer, explanation present. Deliberately vary correct-answer positions across each batch.
- Mains: approximately 270-330 words preferred, always inside the currently deployed quality-gate limits.
- Use at least four explicit analytical subheadings and always include INTRODUCTION, WAY FORWARD, and CONCLUSION (or current production-approved equivalents).
- Sources: official primary source first, with a clickable URL. Add reputable secondary sources only when they materially improve verification/context.
- Numerical/factual density: every CA should carry at least 10-15 genuinely useful numerical or concrete factual data points when the topic supports them. Distribute these across FAST READ, WHY IN NEWS, TOP DATA & FACTS, PRELIMS, QUICK REVISION, MCQ explanation and Mains where relevant; do not concentrate all numbers in one box or pad with meaningless figures.

## Content-quality prohibitions

Reject before publication if any article contains:

- Repeated recent topic/event already published.
- FAST READ and WHY IN NEWS that are exact editorial duplicates.
- Generic filler such as reusable governance boilerplate unrelated to the topic.
- Literal `\\n`, raw `##`/metadata leakage, `[[CA_START]]`/`[[CA_END]]` leakage, or visible PDF page chrome in public content.
- Missing or malformed MCQ options/answer/explanation.
- Predictable all-`(a)` answer pattern across a batch.
- Weak/non-official sourcing when an official source is available.
- Bare or generic Mains headings such as `ANALYTICAL DIMENSIONS` when current gate rejects them.

## Synchronization rule

Before generating or publishing CA or News:

1. Read the current production quality-gate/importer contract from the repository.
2. Check the live/database state for the dates/topics already published.
3. Generate against the CURRENT schema, not a remembered older schema.
4. Run the same/current quality rules against extracted content.
5. Run duplicate-topic checks.
6. Publish.
7. Verify archive, representative article pages, date selection/homepage, and reader formatting live.

If ChatGPT/Codex instructions and CurrentPulse production disagree, production code + this versioned contract must be reconciled first. Do not guess.

## Reliability / Cloudflare subrequest rule

The synchronous PDF publish request must prioritise publication durability. Do not perform per-article external image searches during the same Worker invocation. Image enrichment is a separate/deferred resolve-once operation so a batch cannot partially fail because Cloudflare subrequest limits are exhausted.

A re-upload of the same PDF must be idempotent: already imported source keys are duplicates, not failures, and duplicates must not trigger expensive image re-resolution in the publish request.

## News separation

News uses its own current production publishing contract. Do not automatically apply CA-only section requirements to News. The synchronization rule applies equally: check current production implementation before generating or publishing News.
