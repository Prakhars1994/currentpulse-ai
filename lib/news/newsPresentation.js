const NEWS_PRESENTATION_PREFIX = "CURRENT_PULSE_NEWS_V1:";

function clean(value = "") {
  return typeof value === "string" ? value.trim() : "";
}

export function serializeNewsPresentation(article = {}) {
  const payload = {
    version: 1,
    title: clean(article.title),
    lead: clean(article.why_news),
    keyFacts: clean(article.data_examples),
    context: clean(article.static_foundation),
    whyItMatters: clean(article.india_relevance),
    visualSummary: clean(article.visual_summary),
  };

  return `${NEWS_PRESENTATION_PREFIX}${JSON.stringify(payload)}`;
}

export function parseNewsPresentation(value = "") {
  const text = clean(value);
  if (!text.startsWith(NEWS_PRESENTATION_PREFIX)) return null;

  try {
    const parsed = JSON.parse(text.slice(NEWS_PRESENTATION_PREFIX.length));
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasNewsPresentation(article = {}) {
  return Boolean(parseNewsPresentation(article.content));
}
