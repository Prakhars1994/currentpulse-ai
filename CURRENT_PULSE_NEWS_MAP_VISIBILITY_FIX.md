# CurrentPulse News + Map Visibility Refinement

This is a UI-only delta patch intended to be applied **after** the coaching coverage patch.
It does not modify coaching collection, deduplication, queueing, Supabase migrations, or publishing logic.

## Fixes

- News article text contrast corrected for the light newsroom theme.
- Oversized news headline reduced and reading width improved.
- News sections changed to compact white newsroom cards.
- Key facts use compact evidence cards rather than duplicated headings / dark alternating list blocks.
- Dark Current Affairs list styles are blocked from leaking into News pages.
- Static map replaced with an accurate reusable map-base approach.
- India locations use a labelled India political map and a local inset.
- Bengaluru resolves as `India -> Karnataka -> Bengaluru` and uses a Karnataka local inset.
- World locations use a political world map base.
- No live map or tracking.

## Map licenses

- `public/maps/india-states-en.svg`: Wikimedia Commons, India-map-en.svg, CC BY-SA 3.0.
- `public/maps/world-political-blank.svg`: Wikimedia Commons, BlankMap-World.svg, public domain.
- `public/maps/karnataka-districts.svg`: Wikimedia Commons, Map of Karnataka.svg; file page marks it as freely reusable/public-domain-related with Free Art License information.

Marker positions are approximate study locators, not survey-grade geographic coordinates.
