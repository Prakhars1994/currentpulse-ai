const HELPER_CA_TITLE = /^(?:related\s+upsc\s+pyq|prelims(?:\s+facts?|\s+focus)?|definition|static\s+foundation|memory\s+(?:aid|trick)|answer\s+framework)\b/i;
const HELPER_CA_FRAGMENT = /^(?:[•·▪]\s*)?(?:upi\s*(?:→|->|to)\s*npci)\b/i;
const HELPER_CA_SLUG = /^(?:related-upsc-pyq|prelims-facts?|definition|static-foundation|memory-(?:aid|trick)|answer-framework)(?:-|$)/i;
const PDF_FRONT_MATTER_TITLE = /^(?:currentpulse\s+ai|open\s+currentpulse\s+ai\b.*|\d{1,2}\s+[a-z]{3,9}\s+20\d{2}\s+topic\s+mix|today['’]?s\s+\d+|news\s+static\s*\+\s*evidence\s+prelims\s*\+\s*mains|how\s+to\s+use\s+this\s+\d+-page\s+brief)$/i;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isStandaloneCurrentAffairsArticle(article = {}) {
  const title = clean(article.title);
  const slug = clean(article.slug).toLowerCase();
  if (!title || !slug) return false;
  return !HELPER_CA_TITLE.test(title) &&
    !HELPER_CA_FRAGMENT.test(title) &&
    !HELPER_CA_SLUG.test(slug) &&
    !PDF_FRONT_MATTER_TITLE.test(title);
}

export function normalizeExamEventTitle(value = "") {
  return clean(value)
    .replace(/^\d(?=\d{1,2}[./-]\d{1,2}[./-]20\d{2})/, "")
    .replace(/^\d{1,3}[.)-]?\s*(?=[A-Za-z])/, "")
    .replace(/^\d{1,2}[./-]\d{1,2}[./-]20\d{2}\s*/i, "")
    .replace(/\b(?:click here|read more|new update)\s*$/i, "")
    .replace(/([a-z])([A-Z]{2,})/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function assessExamSitemapRecord(row = {}) {
  const title = clean(row.title);
  const slug = clean(row.slug);
  const officialUrl = clean(row.official_url);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 8) {
    return { allowed: false, code: "malformed_slug" };
  }
  if (!title || normalizeExamEventTitle(title).length < 12) {
    return { allowed: false, code: "generic_or_empty_title" };
  }
  if (/^(?:apply online|online application|application form|click here to apply online|download|read more|notification|notice)$/i.test(title)) {
    return { allowed: false, code: "generic_navigation_item" };
  }
  try {
    const url = new URL(officialUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { allowed: false, code: "invalid_official_url" };
    }
  } catch {
    return { allowed: false, code: "invalid_official_url" };
  }
  // Officially announced future exam/deadline dates are intentionally allowed.
  // Only the collector's source-publication parser may reject an impossible
  // future publication timestamp.
  return { allowed: true, code: "useful_exam_update" };
}

export function examSitemapEventKey(row = {}) {
  return [
    clean(row.source_name || row.agency).toLowerCase(),
    clean(row.update_type).toLowerCase(),
    normalizeExamEventTitle(row.title),
  ].join("|");
}

export function selectExamSitemapRecords(rows = []) {
  const included = [];
  const excluded = [];
  const events = new Set();
  const slugs = new Set();
  for (const row of rows) {
    const assessment = assessExamSitemapRecord(row);
    if (!assessment.allowed) {
      excluded.push({ row, reason: assessment.code });
      continue;
    }
    if (slugs.has(row.slug)) {
      excluded.push({ row, reason: "duplicate_slug" });
      continue;
    }
    const eventKey = examSitemapEventKey(row);
    if (events.has(eventKey)) {
      excluded.push({ row, reason: "duplicate_event" });
      continue;
    }
    slugs.add(row.slug);
    events.add(eventKey);
    included.push(row);
  }
  return { included, excluded };
}
