function clean(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sourceReferences(candidate = {}) {
  if (Array.isArray(candidate)) return candidate;
  for (const key of ["coverage_sources", "sourceInputs", "sourceReferences"]) {
    if (Array.isArray(candidate?.[key]) && candidate[key].length) {
      return candidate[key];
    }
  }
  return [candidate];
}

function informativePoints(value = "") {
  return clean(value)
    .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(clean)
    .filter((point) => point.length >= 35);
}

export function assessCoverageEvidence(candidate = {}) {
  const references = sourceReferences(candidate)
    .map((reference) => ({
      sourceName: clean(reference?.sourceName || reference?.source_name || reference?.source),
      sourceUrl: clean(reference?.sourceUrl || reference?.source_url || reference?.url),
      summary: clean(
        reference?.summary ||
          reference?.description ||
          reference?.content ||
          ""
      ),
    }))
    .filter((reference) => reference.summary);
  const combined = references.map((reference) => reference.summary).join("\n");
  const words = combined.split(/\s+/).filter(Boolean).length;
  const points = informativePoints(combined);
  const evidenceSignals = points.filter((point) =>
    /\b(?:19|20)\d{2}\b|\d|\b(?:Act|Article|Bill|Report|Index|Committee|Court|Scheme|Mission|Convention|Ministry|Organisation|Organization|Authority|Commission)\b/i.test(
      point
    )
  ).length;
  const distinctSources = new Set(
    references
      .map((reference) =>
        `${reference.sourceName.toLowerCase()}|${reference.sourceUrl.toLowerCase()}`
      )
      .filter((value) => value !== "|")
  ).size;
  const accepted =
    (combined.length >= 400 && words >= 65 && points.length >= 3) ||
    (distinctSources >= 2 && combined.length >= 300 && words >= 50 && points.length >= 2);

  return {
    accepted,
    code: accepted ? "coverage_evidence_ready" : "insufficient_source_evidence",
    reason: accepted
      ? "Retained coaching evidence is sufficient for a bounded publication attempt."
      : `Deterministic source-evidence rejection: retained extract has ${words} words, ${points.length} informative points and ${distinctSources} distinct source${distinctSources === 1 ? "" : "s"}. A richer extract can revive this event.`,
    metrics: {
      characters: combined.length,
      words,
      informativePoints: points.length,
      evidenceSignals,
      distinctSources,
    },
  };
}

export function preferRicherCoverageReference(left = {}, right = {}) {
  const leftSummary = clean(left.summary || left.description || left.content);
  const rightSummary = clean(right.summary || right.description || right.content);
  if (rightSummary.length > leftSummary.length) return right;
  if (rightSummary.length < leftSummary.length) return left;

  const leftDate = new Date(left.publishedAt || left.published_at || 0).getTime();
  const rightDate = new Date(right.publishedAt || right.published_at || 0).getTime();
  return Number.isFinite(rightDate) && rightDate > leftDate ? right : left;
}
