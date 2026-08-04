const COVERAGE_NOISE_TITLE_PATTERNS = [
  /^about upsc(?: civil services examination)?/i,
  /^upsc civil services examination(?: \(upsc cse\))?$/i,
  /^news in short\b/i,
  /^daily current affairs$/i,
  /^current affairs$/i,
  /^privacy policy$/i,
  /^terms (?:and|&) conditions$/i,
  /^contact us$/i,
  /^frequently asked questions$/i,
];

export function isCoverageNoiseTitle(title = "") {
  const value = String(title || "").trim();
  return !value || COVERAGE_NOISE_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}
