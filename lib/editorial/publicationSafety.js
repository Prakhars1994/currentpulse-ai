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
  /publication safety rejected this queue item/i,
  /waiting for ai availability/i,
  /source-grounded fallback upgrade/i,
];

const UNIVERSAL_TITLE_REJECTIONS = [
  /^\s*(?:starred |unstarred )?question\s*(?:no\.?|number|#|-)?\s*\d+/i,
  /^\s*(?:notice inviting )?(?:e-?)?tender\b/i,
  /^\s*(?:procurement|purchase|supply)\s+(?:notice|order|tender|of)\b/i,
  /^\s*(?:request for proposal|expression of interest|bid invitation)\b/i,
  /^\s*(?:scheduled )?maintenance(?: notice| downtime)?\b/i,
  /^\s*(?:login|log in|sign in|register|registration|contact us|privacy policy|terms and conditions)\s*$/i,
  /^\s*(?:author|category|tag) archives?\b/i,
  /^\s*(?:category|tag|topic)\s*:\s*[^:]+$/i,
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
  /\b(?:study material|static notes?|download(?:able)? pdf|course material)\b/i,
  /\b(?:weekly|monthly)\b[\s\S]*\b(?:compilation|current affairs|pdf)\b/i,
  /\b(?:international organi[sz]ations?|places?|species|reports?) in news for upsc(?: ias)?(?: exam(?:ination)?)?\b/i,
  /\b(?:prelims|mains) (?:focus group|strategy|mentorship|guidance programme|guidance program)\b/i,
  /\b(?:toppers?|rank\s*\d+)\b[\s\S]*\b(?:strategy|answer writing|interview|copies)\b/i,
  /^\s*(?:public|general studies|prelims|mains|gs[- ]?[1-4])\s*$/i,
];

const DOCUMENT_URL_REJECTIONS = [
  /\/(?:e-?tenders?|procurement|eprocure|purchase-order)(?:\/|\?|$)/i,
  /\/(?:parliament-questions?|question-no-?\d+)(?:\/|\?|$)/i,
  /\/(?:tag|author|category)(?:\/|\?|$)/i,
];

const COVERAGE_URL_REJECTIONS = [
  /\/(?:courses?|batches?|admissions?|test-series|interview-guidance|interview-preparation|store|shop)(?:\/|\?|$)/i,
  /\/(?:weekly|monthly)-current-affairs(?:-compilation)?(?:-pdf)?(?:\/|\?|$)/i,
  /\/(?:one-pagers?|static-notes?|study-material)(?:\/|\?|$)/i,
  /\/(?:guides?|topper-strategy|interview-transcripts?|answer-writing)(?:\/|\?|$)/i,
];

const DEVELOPMENT_PATTERN = /\b(?:announc(?:e[sd]?|ing)|approv(?:e[sd]?|ing)|adopt(?:s|ed|ing)?|amend(?:s|ed|ing)?|launch(?:es|ed|ing)?|release(?:s|d|ing)?|publish(?:es|ed|ing)?|notify|notifies|notified|sign(?:s|ed|ing)?|pass(?:es|ed|ing)?|rule(?:s|d|ing)?|judg(?:e|es|ed|ment)|direct(?:s|ed|ive)|order(?:s|ed)?|report(?:s|ed|ing)|discover(?:s|ed|y)|develop(?:s|ed|ment)|designat(?:e[sd]?|ion)|declare(?:s|d)|rename(?:s|d)|elect(?:s|ed|ion)|appoint(?:s|ed|ment)|resign(?:s|ed|ation)|expand(?:s|ed)|cut(?:s|ting)?|raise(?:s|d)|ban(?:s|ned)|allow(?:s|ed)|restrict(?:s|ed)|begin(?:s)?|start(?:s|ed)|end(?:s|ed)|opens?|closes?|wins?|loses?|kills?|injures?|attack(?:s|ed)|strike(?:s|d)|quake|cyclone|flood|wildfire|outbreak|researchers? (?:find|found|identify|identified)|study (?:finds?|shows?|reveals?))\b/i;

const EVENT_NOUN_PATTERN = /\b(?:summit|agreement|treaty|judgment|verdict|notification|ordinance|report|index|survey|election|appointment|resignation|discovery|trial|test flight|ceasefire)\b/i;

const CURRENT_CONTEXT_PATTERN = /\b(?:why in news|recently|this week|today|yesterday|newly|latest|current development|in a recent|has just|have just|was launched|were launched|has announced|have announced|has approved|have approved|has released|have released)\b/i;

const INSTITUTION_PATTERN = /\b(?:government|ministry|parliament|supreme court|high court|cabinet|commission|authority|organisation|organization|united nations|world bank|imf|rbi|sebi|isro|drdo|who|researchers?|university|institute|council|president|prime minister|chief minister)\b/i;

const ROUTINE_NEWS_PATTERNS = [
  /\btenders?\s+(?:for|notice|document|reference|invitation)\b/i,
  /\b(?:invites?|issues?|floats?|releases?)\s+(?:an?\s+)?(?:e-?)?tenders?\b/i,
  /\b(?:supply|procurement|purchase|hiring)\s+(?:and\s+installation\s+)?of\b/i,
  /\bprocurement\s+(?:tender|notice|portal|process|of)\b/i,
  /\be[- ]?procurement\b/i,
  /\brequest for proposal\b/i,
  /\bexpression of interest\b/i,
  /\bbid invitation\b/i,
  /\b(?:awards?|wins?|secures?|bags?)\b[\s\S]{0,100}\b(?:corporate |supply |procurement )?contract\b/i,
  /\bquarterly\s+(?:net\s+)?(?:profit|loss|results?|earnings|revenue)\b/i,
  /\b(?:net\s+)?profit\b[\s\S]{0,80}\bquarter\b/i,
  /\b(?:share price|stock)\s+(?:rises|falls|jumps|drops)\b/i,
  /\b(?:dividend announcement|board meeting|monthly sales|quarterly sales)\b/i,
  /\b(?:scheduled maintenance|maintenance downtime|portal downtime)\b/i,
  /\b(?:recruitment drive|recruitment notice|vacancy notification)\b/i,
  /\br\.?\s*madhavan\b[\s\S]{0,160}\b(?:post|tweet|instagram|social media|finland)\b/i,
];

const STRONG_PUBLIC_INTEREST_PATTERNS = [
  /\bcabinet approves?\b/i,
  /\bparliament (?:passes?|approves?)\b/i,
  /\bsupreme court\b/i,
  /\bconstitution bench\b/i,
  /\brbi monetary policy\b/i,
  /\bunion budget\b/i,
  /\beconomic survey\b/i,
  /\bnational policy\b/i,
  /\bnew (?:act|bill|rules?)\b/i,
  /\brules? notified\b/i,
  /\bisro (?:launch|mission)\b/i,
  /\bmissile (?:test|launch)\b/i,
  /\bmajor (?:cyber|security|data) breach\b/i,
  /\b(?:war|armed conflict|earthquake|cyclone|floods?|wildfire|outbreak)\b/i,
];

const PROMOTIONAL_TEXT_PATTERNS = [
  /\btoppers? wrote \d+ answers? between prelims (?:and|&) mains\b/i,
  /\b(?:join|enrol|enroll|register for)\b[\s\S]{0,100}\b(?:course|batch|academy|programme|program|test series|focus group)\b/i,
  /\b(?:buy now|add to cart|choose your pack|subscribe now)\b/i,
  /\b(?:admissions?|registrations?) (?:are )?(?:open|started|closing)\b/i,
  /\bdownload (?:the )?(?:weekly|monthly|complete)?\s*current affairs pdf\b/i,
];

const FORUM_DAILY_DIGEST_URL = /^https?:\/\/(?:www\.)?forumias\.com\/blog\/9-pm-upsc-current-affairs-articles-\d{1,2}-[a-z]+-20\d{2}\/?(?:[?#].*)?$/i;

function clean(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value, patterns) {
  return patterns.find((pattern) => pattern.test(value)) || null;
}

function sourceEntries(candidate = {}) {
  const nested = [
    ...(Array.isArray(candidate.article_sources) ? candidate.article_sources : []),
    ...(Array.isArray(candidate.sourceInputs) ? candidate.sourceInputs : []),
    ...(Array.isArray(candidate.coverage_sources) ? candidate.coverage_sources : []),
  ];
  const entries = nested.map((source) => ({
    name: clean(source?.source_name || source?.sourceName || source?.source),
    url: clean(source?.source_url || source?.sourceUrl || source?.url),
  }));

  const directName = clean(candidate.source || candidate.sourceName);
  const directUrl = clean(candidate.url || candidate.link || candidate.sourceUrl || candidate.source_url);
  if (directName || directUrl) entries.push({ name: directName, url: directUrl });
  return entries.filter((entry) => entry.name || entry.url);
}

function assessCoverageSourcePolicy(candidate = {}) {
  for (const source of sourceEntries(candidate)) {
    if (/forumias/i.test(source.name) && source.url && !FORUM_DAILY_DIGEST_URL.test(source.url)) {
      return {
        allowed: false,
        code: "unapproved_forumias_page",
        reason: "ForumIAS coverage is accepted only from dated 9 PM current-affairs digest sections.",
      };
    }
  }
  return { allowed: true, code: "approved_coverage_source", reason: "The source URL follows the configured current-affairs policy." };
}

export function sanitizeEditorialText(value = "") {
  const original = String(value || "").replace(/\r\n?/g, "\n");
  if (!original) return "";

  return original
    .split(/\n{2,}|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !firstMatch(clean(part), [...INTERNAL_PIPELINE_PATTERNS, ...PROMOTIONAL_TEXT_PATTERNS]))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function dateAgeDays(value, referenceDate = null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const reference = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(reference.getTime())) return null;
  return (reference.getTime() - date.getTime()) / 86400000;
}

/**
 * Current Affairs must describe a development, report, judgment, research
 * finding or other time-bound trigger. Source reputation alone is not enough.
 */
export function assessCoverageEventness(candidate = {}, options = {}) {
  const document = assessDocumentCandidate(candidate, { stream: "coverage" });
  if (!document.allowed) return { ...document, eventness: 0 };

  const sourcePolicy = assessCoverageSourcePolicy(candidate);
  if (!sourcePolicy.allowed) return { ...sourcePolicy, eventness: 0 };

  const title = clean(candidate.title);
  const summary = clean(sanitizeEditorialText(candidate.summary || candidate.description || candidate.why_news || candidate.content));
  const combined = `${title} ${summary}`;
  let eventness = summary.length >= 160 ? 2 : summary.length >= 80 ? 1 : 0;
  const titleDevelopment = DEVELOPMENT_PATTERN.test(title);
  const summaryDevelopment = DEVELOPMENT_PATTERN.test(summary);
  const currentContext = CURRENT_CONTEXT_PATTERN.test(combined);
  const eventNoun = EVENT_NOUN_PATTERN.test(combined);

  if (titleDevelopment) eventness += 4;
  else if (summaryDevelopment) eventness += 3;
  if (currentContext) eventness += 2;
  if (eventNoun && (currentContext || titleDevelopment || summaryDevelopment)) eventness += 1;
  if (INSTITUTION_PATTERN.test(combined)) eventness += 1;

  const currentYear = new Date().getUTCFullYear();
  const hasCurrentYear = new RegExp(`\\b(?:${currentYear}|${currentYear - 1})\\b`).test(combined);
  if (hasCurrentYear) eventness += 1;

  const ageDays = dateAgeDays(
    candidate.publishedAt || candidate.published_at || candidate.pubDate,
    options.referenceDate
  );
  let recentSource = false;
  if (ageDays !== null && ageDays >= -1 && ageDays <= 30) eventness += 2;
  else if (ageDays !== null && ageDays > 45) eventness -= 6;
  if (ageDays !== null && ageDays >= -1 && ageDays <= 30) recentSource = true;

  // A long article and a recent crawl date are not proof of a current event.
  // Require an explicit development/current marker before generation.
  const hasTimeBoundTrigger =
    titleDevelopment ||
    (summaryDevelopment && (currentContext || recentSource || hasCurrentYear)) ||
    (eventNoun && (currentContext || recentSource || hasCurrentYear));

  const allowed = hasTimeBoundTrigger && eventness >= 6;
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

  const combined = clean(`${candidate.title || ""} ${candidate.description || candidate.summary || candidate.content || ""}`);
  const routinePattern = firstMatch(combined, ROUTINE_NEWS_PATTERNS);
  const publicInterestOverride = firstMatch(combined, STRONG_PUBLIC_INTEREST_PATTERNS);
  if (routinePattern && !publicInterestOverride) {
    return {
      allowed: false,
      code: "routine_operational_news",
      reason: "Routine procurement, corporate-result, recruitment, maintenance or promotional social content is not a newsroom article.",
    };
  }

  const publishedAt = candidate.publishedAt || candidate.published_at || candidate.pubDate;
  const ageDays = dateAgeDays(publishedAt);
  if (ageDays !== null && (ageDays > 7 || ageDays < -1)) {
    return { allowed: false, code: "stale_or_invalid_news_date", reason: "The source timestamp is outside the fresh-news window." };
  }

  const currentYear = new Date().getUTCFullYear();
  const oldYears = [...combined.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year <= currentYear - 2);
  const hasCurrentYear = new RegExp(`\\b${currentYear}\\b`).test(combined);
  const historicalContext = /\b(?:since|anniversary|retrospective|review|legacy|years? after|impact of|revisits?)\b/i.test(combined);
  if (oldYears.length && !hasCurrentYear && !historicalContext && ageDays !== null && ageDays <= 7) {
    return { allowed: false, code: "stale_headline_year", reason: "The headline presents an old dated development as fresh news." };
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

  if (stream === "coverage") {
    const coachingSources = (article.article_sources || []).filter(
      (source) => source?.source_kind === "coaching"
    );
    const sourceDate = coachingSources
      .map((source) => source?.source_published_at)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    const eventness = assessCoverageEventness(
      {
        ...article,
        summary: article.why_news || article.content || "",
        source: coachingSources[0]?.source_name || "",
        url: coachingSources[0]?.source_url || "",
        publishedAt: sourceDate || article.created_at,
      },
      { referenceDate: article.created_at }
    );
    if (!eventness.allowed) return eventness;
  }

  return { allowed: true, code: "public_article", reason: "No strict publication-safety violation was found." };
}

export function isPublishedArticleSafe(article = {}, options = {}) {
  return assessPublishedArticle(article, options).allowed;
}
