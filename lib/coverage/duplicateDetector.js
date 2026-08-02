function normalizedKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deduplicateCoverageTopics(topics) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = [];

  for (const topic of topics || []) {
    const urlKey = normalizedKey(topic?.url).replace(/\s+/g, "");
    const titleKey = normalizedKey(topic?.title);

    if (!titleKey || !urlKey) continue;
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    unique.push(topic);
  }

  return unique;
}
