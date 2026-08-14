import { isSameEvent } from "@/lib/news/eventCluster";
import {
  createCoverageEventKey,
  getCoverageSourceReferences,
} from "@/lib/coverage/sourceRegistry";

function normalizedKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function latestDate(first, second) {
  const dates = [first, second]
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));

  if (dates.length === 0) return first || second || null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function buildMergedSummary(sourceInputs) {
  return sourceInputs
    .map(
      (input) => `
SOURCE: ${input.sourceName}
SOURCE TITLE: ${input.sourceTitle}
SOURCE URL: ${input.sourceUrl}

${input.summary}
      `.trim()
    )
    .join("\n\n----------------------------------------\n\n")
    .slice(0, 30000);
}


const COVERAGE_TITLE_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with",
  "india", "indian", "current", "affairs", "update", "updates", "status",
  "overview", "explained", "new", "latest",
]);

function coverageTitleTokens(value = "") {
  return normalizedKey(value)
    .split(" ")
    .filter((token) => token.length > 2 && !COVERAGE_TITLE_STOP_WORDS.has(token));
}

function coverageTitleBigrams(value = "") {
  const tokens = coverageTitleTokens(value);
  const out = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    out.add(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return out;
}

function hasCoverageMergeIdentity(left = {}, right = {}) {
  const leftKey = normalizedKey(left.title);
  const rightKey = normalizedKey(right.title);
  if (leftKey && leftKey === rightKey) return true;

  const leftTokens = new Set(coverageTitleTokens(left.title));
  const rightTokens = new Set(coverageTitleTokens(right.title));
  if (!leftTokens.size || !rightTokens.size) return false;

  let common = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) common += 1;
  const containment = common / Math.min(leftTokens.size, rightTokens.size);

  const leftBigrams = coverageTitleBigrams(left.title);
  const rightBigrams = coverageTitleBigrams(right.title);
  const sharedBigram = [...leftBigrams].some((value) => rightBigrams.has(value));

  return (
    (common >= 3 && containment >= 0.6) ||
    (common >= 2 && containment >= 0.66 && sharedBigram)
  );
}

function mergeTopic(cluster, topic) {
  const references = getCoverageSourceReferences({
    sourceInputs: [
      ...(cluster.sourceInputs || []),
      ...(topic.sourceInputs || [topic]),
    ],
  });

  return {
    ...cluster,
    summary: buildMergedSummary(references),
    source: references.map((item) => item.sourceName).join(", "),
    sources: references.map((item) => item.sourceName),
    sourceInputs: references,
    publishedAt: latestDate(cluster.publishedAt, topic.publishedAt),
    imageUrl: cluster.imageUrl || topic.imageUrl || null,
    keywords: [...new Set([...(cluster.keywords || []), ...(topic.keywords || [])])],
  };
}

/**
 * Groups same-cycle coverage of one event and preserves every source input.
 * The publisher receives one hybrid evidence bundle instead of silently
 * discarding the additional coaching material.
 */
export function mergeCoverageTopics(topics) {
  const clusters = [];
  const seenSourceKeys = new Set();

  for (const topic of topics || []) {
    const references = getCoverageSourceReferences(topic);
    if (!topic?.title || references.length === 0) continue;

    const freshReferences = references.filter(
      (reference) => !seenSourceKeys.has(reference.sourceKey)
    );
    if (freshReferences.length === 0) continue;
    freshReferences.forEach((reference) => seenSourceKeys.add(reference.sourceKey));

    const prepared = {
      ...topic,
      sourceInputs: freshReferences,
      sources: freshReferences.map((reference) => reference.sourceName),
      summary: buildMergedSummary(freshReferences),
    };

    const existingIndex = clusters.findIndex((existing) => {
      if (!hasCoverageMergeIdentity(existing, prepared)) return false;

      return isSameEvent(
        {
          title: existing.title,
          description: existing.summary,
          publishedAt: existing.publishedAt,
        },
        {
          title: prepared.title,
          description: prepared.summary,
          publishedAt: prepared.publishedAt,
        }
      );
    });

    if (existingIndex >= 0) {
      clusters[existingIndex] = mergeTopic(clusters[existingIndex], prepared);
      continue;
    }

    prepared.eventKey = createCoverageEventKey(prepared);
    clusters.push(prepared);
  }

  return clusters.map((cluster) => ({
    ...cluster,
    eventKey: cluster.eventKey || createCoverageEventKey(cluster),
  }));
}

// Backward-compatible name for existing imports.
export const deduplicateCoverageTopics = mergeCoverageTopics;
