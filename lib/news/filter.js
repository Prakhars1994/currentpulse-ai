import { isSameEvent } from "@/lib/news/eventCluster";
export function deduplicateArticles(articles) {
  const accepted = [];
  const seenUrls = new Set();

  for (const article of articles) {
    if (!article?.title || !article?.url) continue;
    if (seenUrls.has(article.url)) continue;

    const duplicate = accepted.find((existing) => isSameEvent(existing, article));

    if (duplicate) {
      duplicate.coverage = Array.from(
        new Set([...(duplicate.coverage || [duplicate.source]), article.source])
      );
      const additionalDescription = String(article.description || "").trim();
      if (
        additionalDescription &&
        !String(duplicate.description || "").includes(additionalDescription)
      ) {
        duplicate.description = `${duplicate.description || ""}\n\nADDITIONAL COVERAGE (${article.source || "source"}): ${additionalDescription}`
          .trim()
          .slice(0, 6500);
      }
      continue;
    }

    seenUrls.add(article.url);
    accepted.push({
      ...article,
      coverage: [article.source],
    });
  }

  return accepted.sort((a, b) => {
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
}
