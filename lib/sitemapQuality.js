const HELPER_CA_TITLE = /^(?:related\s+upsc\s+pyq|prelims(?:\s+facts?|\s+focus)?|definition|static\s+foundation|memory\s+(?:aid|trick)|answer\s+framework)\b/i;
const HELPER_CA_FRAGMENT = /^(?:[•·▪]\s*)?(?:upi\s*(?:→|->|to)\s*npci)\b/i;
const HELPER_CA_SLUG = /^(?:related-upsc-pyq|prelims-facts?|definition|static-foundation|memory-(?:aid|trick)|answer-framework)(?:-|$)/i;
const PDF_FRONT_MATTER_TITLE = /^(?:currentpulse\s+ai|open\s+currentpulse\s+ai\b.*|\d{1,2}\s+[a-z]{3,9}\s+20\d{2}\s+topic\s+mix|today['’]?s\s+\d+|news\s+static\s*\+\s*evidence\s+prelims\s*\+\s*mains|how\s+to\s+use\s+this\s+\d+-page\s+brief)$/i;
const GENERIC_EXAM_NAV_TITLE = /^(?:mobile\s+game\s+application|selection\s+process|air\s+force\s+selection\s+boards?|model\s+questions?|syllabus|general\s+terms(?:\s*&|\s+and)\s+conditions|faqs?|news\s*&\s*updates(?:\s+faqs\s+notifications\s+results)?|selection\s+selection\s+process\b.*)$/i;
const FUTURE_EVENT_TYPES = new Set(["exam-date", "deadline", "application", "counselling"]);
const MONTH_PATTERN = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseLeadingListingDate(value = "") {
  const text = clean(value);
  const monthMatch = text.match(new RegExp(`^(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(20\\d{2})\\b`, "i"));
  if (monthMatch) {
    const parsed = new Date(`${monthMatch[1]} ${monthMatch[2]} ${monthMatch[3]} 12:00:00 +0530`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const numeric = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if (numeric) {
    const parsed = new Date(`${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}T12:00:00+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function hasImpossibleFutureListingDate(row = {}) {
  const parsed = parseLeadingListingDate(row.title);
  if (!parsed) return false;
  const type = clean(row.update_type).toLowerCase();
  if (FUTURE_EVENT_TYPES.has(type)) return false;
  return parsed.getTime() > Date.now() + 12 * 60 * 60 * 1000;
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

export function examDisplayTitle(value = "") {
  return clean(value)
    .replace(new RegExp(`^\\d{1,2}\\s+(?:${MONTH_PATTERN})\\s+20\\d{2}\\s*`, "i"), "")
    .replace(/^\d(?=\d{1,2}[./-]\d{1,2}[./-]20\d{2})/, "")
    .replace(/^\d{1,2}[./-]\d{1,2}[./-]20\d{2}\s*/i, "")
    .replace(/^\d{1,3}[.)-]?\s*(?=[A-Za-z])/, "")
    .replace(/^click\s+here\s+to\s+download\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeExamEventTitle(value = "") {
  return examDisplayTitle(value)
    .replace(/\b(?:click here|read more|new update)\s*$/i, "")
    .replace(/([a-z])([A-Z]{2,})/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function assessExamSitemapRecord(row = {}) {
  const rawTitle = clean(row.title);
  const title = examDisplayTitle(rawTitle);
  const slug = clean(row.slug);
  const officialUrl = clean(row.official_url);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 8) {
    return { allowed: false, code: "malformed_slug" };
  }
  if (hasImpossibleFutureListingDate(row)) {
    return { allowed: false, code: "future_listing_date" };
  }
  if (!title || normalizeExamEventTitle(title).length < 12) {
    return { allowed: false, code: "generic_or_empty_title" };
  }
  if (/^(?:apply online|online application|application form|click here to apply online|download|read more|notification|notice)$/i.test(title)) {
    return { allowed: false, code: "generic_navigation_item" };
  }
  if (GENERIC_EXAM_NAV_TITLE.test(title)) {
    return { allowed: false, code: "generic_reference_page" };
  }
  try {
    const url = new URL(officialUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { allowed: false, code: "invalid_official_url" };
    }
  } catch {
    return { allowed: false, code: "invalid_official_url" };
  }
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
