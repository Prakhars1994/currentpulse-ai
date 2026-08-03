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

    const titleKey = normalizedKey(prepared.title);
    const existingIndex = clusters.findIndex((existing) => {
      if (normalizedKey(existing.title) === titleKey) return true;

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
