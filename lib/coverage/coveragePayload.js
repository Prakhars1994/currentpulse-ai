import { getCoverageSourceReferences } from "@/lib/coverage/sourceRegistry";

export function buildCoverageSummary(references = []) {
  return references
    .map(
      (reference) => `
SOURCE: ${reference.sourceName}
SOURCE TITLE: ${reference.sourceTitle}
SOURCE URL: ${reference.sourceUrl}

${reference.summary}
      `.trim()
    )
    .join("\n\n----------------------------------------\n\n")
    .slice(0, 30000);
}

export function topicWithCoverageSources(topic = {}, references = []) {
  return {
    ...topic,
    sourceInputs: references,
    sources: references.map((reference) => reference.sourceName),
    source: references.map((reference) => reference.sourceName).join(", "),
    summary: buildCoverageSummary(references),
  };
}

export function toCoveragePublishingSource(topic = {}) {
  const references = getCoverageSourceReferences(topic);

  return {
    title: topic.title,
    description: topic.summary,
    content: topic.summary,
    url: topic.url,
    source: topic.source || "Trusted UPSC Source",
    sourceName: topic.source || "Trusted UPSC Source",
    sourceReferences: references,
    publishedAt: topic.publishedAt || topic.published_at,
    category: topic.category || "Polity & Governance",
    paper: topic.paper || "Prelims",
    importance: 10,
    evaluation_reason: `Synthesized from ${references.length} trusted Current Affairs source${references.length === 1 ? "" : "s"}; no CurrentPulse importance/eventness selection applied.`,
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    image_url: topic.imageUrl || topic.image_url || null,
    trustedCoverage: true,
    generationMode: "trusted_coverage",
  };
}

