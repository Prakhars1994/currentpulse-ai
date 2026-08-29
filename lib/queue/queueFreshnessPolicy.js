export const LEGACY_NEWS_MAX_AGE_DAYS = 3;

function timestamp(value) {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isLegacyNewsQueueItem(item = {}) {
  return !["coaching", "coaching_enrichment"].includes(item.pipeline_kind);
}

export function assessQueueFreshness(item = {}, now = Date.now()) {
  if (!isLegacyNewsQueueItem(item)) {
    return { eligible: true, lane: "coverage", reason: "durable_current_affairs_retry" };
  }

  const publishedAt = timestamp(item.published_at);
  if (!publishedAt) {
    return { eligible: false, lane: "news", reason: "news_missing_publication_date" };
  }
  if (publishedAt > now + 12 * 60 * 60 * 1000) {
    return { eligible: false, lane: "news", reason: "news_future_dated" };
  }
  if (publishedAt < now - LEGACY_NEWS_MAX_AGE_DAYS * 86_400_000) {
    return { eligible: false, lane: "news", reason: "obsolete_legacy_news" };
  }
  return { eligible: true, lane: "news", reason: "current_legacy_news_retry" };
}

export function isQueueItemFreshEnough(item, now = Date.now()) {
  return assessQueueFreshness(item, now).eligible;
}
