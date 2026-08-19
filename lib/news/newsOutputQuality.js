import { parseNewsPresentation } from "./newsPresentation.js";

const RAW_PIPELINE_MARKERS = [
  /\bADDITIONAL COVERAGE\b/i,
  /\bOFFICIAL VERIFICATION\b/i,
  /\bCOMPLETE EXTRACTED SOURCE CONTENT\b/i,
  /\bNEWS ARTICLE SOURCE\b/i,
  /\bSOURCE TITLE\s*:/i,
  /\bSOURCE URL\s*:/i,
  /\bSELECTION REASON\s*:/i,
];

function clean(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_#>`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value = "") {
  return new Set(
    clean(value)
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function overlap(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return { containment: 0, jaccard: 0 };
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return {
    containment: common / Math.min(a.size, b.size),
    jaccard: common / (a.size + b.size - common),
  };
}

function sectionValues(article = {}) {
  const presentation = parseNewsPresentation(article.content);
  if (presentation) {
    return {
      presentation: true,
      sections: [
        ["lead", presentation.lead],
        ["keyFacts", presentation.keyFacts],
        ["context", presentation.context],
        ["whyItMatters", presentation.whyItMatters],
      ],
    };
  }

  return {
    presentation: false,
    sections: [
      ["lead", article.why_news || article.description],
      ["keyFacts", article.data_examples],
      ["context", article.static_foundation],
      ["whyItMatters", article.india_relevance],
    ],
  };
}

function isSourceGroundedNewsFallback(article = {}) {
  return article.__sourceFallback === true &&
    Array.isArray(article.quality?.flags) &&
    article.quality.flags.includes("source_grounded_news_fallback");
}

export function assessNewsOutputQuality(article = {}) {
  const { presentation, sections } = sectionValues(article);
  const sourceGroundedFallback = isSourceGroundedNewsFallback(article);
  const populated = sections
    .map(([name, value]) => [name, clean(value)])
    .filter(([, value]) => value.length >= 30);
  const combined = sections.map(([, value]) => String(value || "")).join("\n");

  const marker = RAW_PIPELINE_MARKERS.find((pattern) => pattern.test(combined));
  if (marker) {
    return {
      allowed: false,
      code: "raw_source_aggregation",
      reason: "Reader-facing News still contains source/pipeline aggregation markers.",
    };
  }

  if (presentation) {
    const byName = Object.fromEntries(sections.map(([name, value]) => [name, clean(value)]));
    if (byName.lead.length < 60) {
      return { allowed: false, code: "thin_news_lead", reason: "News lead is too thin." };
    }
    if (byName.keyFacts.length < 45) {
      return { allowed: false, code: "thin_news_facts", reason: "News key facts are too thin." };
    }
    if (byName.context.length < 45) {
      return { allowed: false, code: "thin_news_context", reason: "News context is too thin." };
    }
  }

  for (let i = 0; i < populated.length; i += 1) {
    for (let j = i + 1; j < populated.length; j += 1) {
      const [leftName, left] = populated[i];
      const [rightName, right] = populated[j];
      const normalizedLeft = left.toLowerCase();
      const normalizedRight = right.toLowerCase();
      const score = overlap(left, right);

      if (
        (Math.min(left.length, right.length) >= 70 &&
          normalizedLeft === normalizedRight) ||
        (Math.min(left.length, right.length) >= 90 &&
          score.containment >= 0.78 &&
          score.jaccard >= 0.55)
      ) {
        if (sourceGroundedFallback) continue;
        return {
          allowed: false,
          code: "duplicated_news_sections",
          reason: `${leftName} and ${rightName} substantially repeat the same material.`,
        };
      }
    }
  }

  return {
    allowed: true,
    code: "news_output_ready",
    reason: "News has distinct reader-facing sections and no raw pipeline markers.",
  };
}
