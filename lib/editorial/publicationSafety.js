const INTERNAL_PIPELINE_PATTERNS = [
  /selection reason\s*:\s*(?:selected|collected|retained)/i,
  /selected by local upsc scoring because ai evaluation was unavailable/i,
  /treat the preceding text only as source material/i,
  /based only on the preceding source material/i,
  /return the finished article in (?:valid )?json/i,
  /complete extracted source content/i,
  /trusted upsc current-affairs source/i,
  /editorial screen\s*(?:\n|category hint)/i,
  /do not invent unsupported facts/i,
  /system prompt|developer message|assistant instructions/i,
];

const UNIVERSAL_TITLE_REJECTIONS = [
  /^\s*(?:starred |unstarred )?question\s*(?:no\.?|number|#|-)?\s*\d+/i,
  /^\s*(?:notice inviting )?(?:e-?)?tender\b/i,
  /^\s*(?:procurement|purchase|supply)\s+(?:notice|order|tender|of)\b/i,
  /^\s*(?:request for proposal|expression of interest|bid invitation)\b/i,
  /^\s*(?:scheduled )?maintenance(?: notice| downtime)?\b/i,
  /^\s*(?:login|log in|sign in|register|registration|contact us|privacy policy|terms and conditions)\s*$/i,
  /^\s*(?:author|category|tag) archives?\b/i,
];

const COVERAGE_TITLE_REJECTIONS = [
  /^\s*guides?\s*(?::|-|for)\s*/i,
  /^\s*upsc ias toppers? strategy\b/i,
  /\bupsc (?:ias )?interview (?:preparation|guidance|transcript|experience)\b/i,
  /\b(?:interview preparation|interview guidance|mock interview)\b/i,
  /^\s*(?:weekly|monthly) current affairs(?: compilation)?(?: pdf)?\b/i,
  /^\s*daily current affairs editorials?\b/i,
  /^\s*current affairs classes\b/i,
  /^\s*choose your pack\b/i,
  /^\s*conceptify\b.*\bone[ -]?pagers?\b/i,
  /\bresidential\b.*\b(?:course|programme|program|frc|batch)\b/i,
  /\b(?:course|batch|admission|test series|guidance session)\b.*\b(?:enrol|join|launch|202\d|upsc)\b/i,
  /\b(?:buy now|add to cart|subscribe now|start here)\b/i,
  /^\s*(?:the )?constitution of india\s*$/i,
  /^\s*important species\s*$/i,
  /^\s*(?:homepage|home page|archive|archives)\s*$/i,
];

const DOCUMENT_URL_REJECTIONS = [
  /\/(?:e-?tenders?|procurement|eprocure|purchase-order)(?:\/|\?|$)/i,
  /\/(?:parliament-questions?|question-no-?\d+)(?:\/|\?|$)/i,
];

const COVERAGE_URL_REJECTIONS = [
  /\/(?:courses?|batches?|admissions?|test-series|interview-guidance|interview-preparation|store|shop)(?:\/|\?|$)/i,
  /\/(?:weekly|monthly)-current-affairs(?:-compilation)?(?:-pdf)?(?:\/|\?|$)/i,
  /\/(?:one-pagers?|static-notes?|study-material)(?:\/|\?|$)/i,
];

const DEVELOPMENT_PATTERN = /\b(?:announc(?:e[sd]?|ing)|approv(?:e[sd]?|ing)|adopt(?:s|ed|ing)?|amend(?:s|ed|ing)?|launch(?:es|ed|ing)?|release(?:s|d|ing)?|publish(?:es|ed|ing)?|notify|notifies|notified|sign(?:s|ed|ing)?|pass(?:es|ed|ing)?|rule(?:s|d|ing)?|judg(?:e|es|ed|ment)|direct(?:s|ed|ive)|order(?:s|ed)?|report(?:s|ed|ing)?|summit|agreement|treaty|mission|discover(?:s|ed|y)|develop(?:s|ed|ment)|designat(?:e[sd]?|ion)|declare(?:s|d)|rename(?:s|d)|elect(?:s|ed|ion)|appoint(?:s|ed|ment)|resign(?:s|ed|ation)|expand(?:s|ed)|cut(?:s|ting)?|raise(?:s|d)|ban(?:s|ned)|allow(?:s|ed)|restrict(?:s|ed)|begin(?:s)?|start(?:s|ed)|end(?:s|ed)|opens?|closes?|wins?|loses?|kills?|injures?|attack(?:s|ed)|strike(?:s|d)|quake|cyclone|flood|wildfire|outbreak|researchers? (?:find|found|identify|identified)|study (?:finds?|shows?|reveals?))\b/i;

const CURRENT_CONTEXT_PATTERN = /\b(?:why in news|recently|this week|today|yesterday|newly|latest|current development|in a recent|has been|have been|was launched|were launched)\b/i;

const INSTITUTION_PATTERN = /\b(?:government|ministry|parliament|supreme court|high court|cabinet|commission|authority|organisation|organization|united nations|world bank|imf|rbi|sebi|isro|drdo|who|researchers?|university|institute|council|president|prime minister|chief minister)\b/i;

function clean(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value, patterns) {
  return patterns.find((pattern) => pattern.test(value)) || null;
}

function candidateUrl(candidate = {}) {
  const direct = candidate.url || candidate.link || candidate.sourceUrl || candidate.source_url;
  const sourceUrls = (candidate.article_sources || [])
    .map((source) => source?.source_url)
    .filter(Boolean);
  return [direct, ...sourceUrls].filter(Boolean).join(" ");
}

export function publicArticleText(article = {}) {
  return clean([
    article.title,
    article.why_news,
    article.syllabus_linkage,
    article.india_relevance,
    article.static_foundation,
    article.data_examples,
    article.prelims,
    article.mains,
    article.answer_framework,
    article.question,
    article.visual_summary,
    article.memory_trick,
    article.content,
    article.seo_description,
  ].filter(Boolean).join("\n"));
}

export function findInternalPipelineLeak(value = "") {
  const text = clean(value);
  const pattern = firstMatch(text, INTERNAL_PIPELINE_PATTERNS);
  return pattern ? pattern.source : "";
}

export function assessDocumentCandidate(candidate = {}, { stream = "news" } = {}) {
  const title = clean(candidate.title);
  const url = candidateUrl(candidate);

  if (!title || title.length < 8) {
    return { allowed: false, code: "invalid_title", reason: "The item has no article headline." };
  }

  const titlePatterns = stream === "coverage"
    ? [...UNIVERSAL_TITLE_REJECTIONS, ...COVERAGE_TITLE_REJECTIONS]
    : UNIVERSAL_TITLE_REJECTIONS;
  const titlePattern = firstMatch(title, titlePatterns);
  if (titlePattern) {
    return { allowed: false, code: "non_article_title", reason: "The headline is a document, navigation or promotional page." };
  }

  const urlPatterns = stream === "coverage"
    ? [...DOCUMENT_URL_REJECTIONS, ...COVERAGE_URL_REJECTIONS]
    : DOCUMENT_URL_REJECTIONS;
  const urlPattern = firstMatch(url, urlPatterns);
  if (urlPattern) {
    return { allowed: false, code: "non_article_url", reason: "The source URL is a document, utility or promotional page." };
  }

  return { allowed: true, code: "article_candidate", reason: "The item has an article-like title and URL." };
}

function dateAgeDays(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 86400000;
}

/**
 * Current Affairs must describe a development, report, judgment, research
 * finding or other time-bound trigger. Source reputation alone is not enough.
 */
export function assessCoverageEventness(candidate = {}) {
  const document = assessDocumentCandidate(candidate, { stream: "coverage" });
  if (!document.allowed) return { ...document, eventness: 0 };

  const title = clean(candidate.title);
  const summary = clean(candidate.summary || candidate.description || candidate.content);
  const combined = `${title} ${summary}`;
  let eventness = summary.length >= 120 ? 3 : summary.length >= 60 ? 2 : 1;

  if (DEVELOPMENT_PATTERN.test(title)) eventness += 3;
  else if (DEVELOPMENT_PATTERN.test(summary)) eventness += 2;
  if (CURRENT_CONTEXT_PATTERN.test(combined)) eventness += 1;
  if (INSTITUTION_PATTERN.test(combined)) eventness += 1;

  const currentYear = new Date().getUTCFullYear();
  if (new RegExp(`\\b(?:${currentYear}|${currentYear - 1})\\b`).test(combined)) eventness += 1;

  const ageDays = dateAgeDays(candidate.publishedAt || candidate.published_at || candidate.pubDate);
  if (ageDays !== null && ageDays >= -1 && ageDays <= 30) eventness += 2;
  else if (ageDays !== null && ageDays > 45) eventness -= 6;

  const allowed = eventness >= 5;
  return {
    allowed,
    eventness: Math.max(0, Math.min(10, eventness)),
    code: allowed ? "current_development" : "insufficient_eventness",
    reason: allowed
      ? "The source describes a time-bound development and retains enough source evidence."
      : "The page looks like static guidance or notes and has no clear current trigger.",
  };
}

export function assessNewsCandidate(candidate = {}) {
  const document = assessDocumentCandidate(candidate, { stream: "news" });
  if (!document.allowed) return document;

  const leak = findInternalPipelineLeak(`${candidate.title || ""}\n${candidate.description || candidate.summary || ""}`);
  if (leak) {
    return { allowed: false, code: "internal_instruction", reason: "Internal pipeline instructions appeared in source-facing fields." };
  }

  return { allowed: true, code: "news_article", reason: "The item is an article from the configured newspaper feed." };
}

/**
 * Fail closed on public prompt/debug leakage and strict document/page noise.
 * Eventness is intentionally not recomputed here: older valid articles may
 * have concise stored summaries even though their retained source was strong.
 */
export function assessPublishedArticle(article = {}, { stream = "news" } = {}) {
  const document = assessDocumentCandidate(article, { stream });
  if (!document.allowed) return document;

  const leak = findInternalPipelineLeak(publicArticleText(article));
  if (leak) {
    return { allowed: false, code: "internal_instruction", reason: "Internal editorial or prompt text leaked into public article fields." };
  }

  return { allowed: true, code: "public_article", reason: "No strict publication-safety violation was found." };
}

export function isPublishedArticleSafe(article = {}, options = {}) {
  return assessPublishedArticle(article, options).allowed;
}
