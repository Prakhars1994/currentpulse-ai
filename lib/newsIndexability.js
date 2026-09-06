// Match the News reader's intentional exclusion of licensed republications.
export function isIndexableNewsArticle(article = {}) {
  return !(Array.isArray(article.quality_flags) &&
    article.quality_flags.includes("licensed_republish_the_conversation"));
}
