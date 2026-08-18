export const PIPELINE_RECOVERY_LOOKBACK_HOURS = 72;

function flags(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function isRecoverableNewsEntailmentRejection(row = {}) {
  const error = String(row.error || "");
  return (
    row.pipeline_kind === "news" &&
    row.status === "rejected" &&
    /PUBLICATION_BLOCKED:\s*unsupported_named_entities:/i.test(error) &&
    /\bVerified\b/i.test(error) &&
    /\bEssential\b/i.test(error)
  );
}

export function isRecoverableCoverageFallback(article = {}, quality = {}) {
  const storedFlags = new Set(flags(article.quality_flags));
  const currentFlags = new Set(flags(quality.flags));
  return (
    storedFlags.has("source_grounded_fallback") &&
    storedFlags.has("quarantined_quality_floor_v4") &&
    quality.passed === true &&
    Number(quality.score || 0) >= 76 &&
    !currentFlags.has("editorial_residue")
  );
}

export function recoveredCoverageFlags(article = {}, quality = {}) {
  const merged = new Set([
    ...flags(article.quality_flags),
    ...flags(quality.flags),
    "recovered_after_quality_gate_alignment",
  ]);
  merged.delete("quarantined_quality_floor_v4");
  merged.delete("needs_quality_upgrade_v4");
  return [...merged];
}