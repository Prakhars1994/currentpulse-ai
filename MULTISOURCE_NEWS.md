# Multi-source news engine

Endpoint: `/api/fetch-all-news`

Examples:

- Collection only (does not use Gemini): `/api/fetch-all-news?evaluate=false`
- Full filtering and ranking: `/api/fetch-all-news`
- Limit items per source: `/api/fetch-all-news?perSource=5`
- Limit AI evaluations: `/api/fetch-all-news?aiLimit=10`
- Filter groups: `/api/fetch-all-news?groups=indian-news,official`

The existing PIB endpoint remains unchanged at `/api/fetch-todays-news`.
Commercial publishers are collected from public headline/snippet/link feeds; their full articles are not republished.
