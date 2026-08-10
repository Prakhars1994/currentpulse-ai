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
  /^source\s*\/\s*references?\s*:?s*$/i,
  /^guides?\s*(?:[-–—:]|for)\s*upsc/i,
  /^upsc ias toppers? strategy/i,
];

const TAXONOMY_ONLY = /^(?:art(?:\s*&\s*culture)?|culture|indian geography|geography|environment(?:\s*&\s*ecology)?|ecology|science(?:\s*&\s*technology)?|technology|health|government schemes?|polity(?:\s*&\s*governance)?|governance|economy|industry|energy|agriculture|international relations|international reports?|defence(?:\s*&\s*security)?|security|social justice|society|awards?(?:\s*&\s*honours)?|biodiversity|disaster management|biotechnology|astronomy)(?:\s*[\/,]\s*(?:art(?:\s*&\s*culture)?|culture|indian geography|geography|environment(?:\s*&\s*ecology)?|ecology|science(?:\s*&\s*technology)?|technology|health|government schemes?|polity(?:\s*&\s*governance)?|governance|economy|industry|energy|agriculture|international relations|international reports?|defence(?:\s*&\s*security)?|security|social justice|society|awards?(?:\s*&\s*honours)?|biodiversity|disaster management|biotechnology|astronomy))*$/i;

export function isCoverageNoiseTitle(title = "") {
  const value = String(title || "").trim();
  return !value || TAXONOMY_ONLY.test(value) || COVERAGE_NOISE_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}
