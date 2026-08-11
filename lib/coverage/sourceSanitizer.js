function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const HARD_TITLE_PATTERNS = [
  /^source\s*\/?\s*reference\s*:?$/i,
  /^(?:art(?:\s*&\s*culture)?|culture|indian geography|geography|environment(?:\s*&\s*ecology)?|ecology|science(?:\s*&\s*technology)?|technology|health(?:\s*&\s*environment)?|government schemes?|polity(?:\s*&\s*governance)?|governance|economy|industry|energy|agriculture|international relations|international reports?|defence(?:\s*&\s*security)?|security|social justice|society|awards?(?:\s*&\s*honours)?|biodiversity|disaster management|biotechnology|astronomy)(?:\s*[\/,]\s*(?:art(?:\s*&\s*culture)?|culture|indian geography|geography|environment(?:\s*&\s*ecology)?|ecology|science(?:\s*&\s*technology)?|technology|health(?:\s*&\s*environment)?|government schemes?|polity(?:\s*&\s*governance)?|governance|economy|industry|energy|agriculture|international relations|international reports?|defence(?:\s*&\s*security)?|security|social justice|society|awards?(?:\s*&\s*honours)?|biodiversity|disaster management|biotechnology|astronomy))*$/i,
  /\b(?:upsc|ias)\s+(?:interview\s+)?(?:transcripts?|board members?|strategy|syllabus|timetable|booklist|preparation guide)\b/i,
  /\binterview\s+transcripts?\b/i,
  /\bknow your state\b/i,
  /\b(?:daily|weekly|monthly)\s+(?:current affairs\s+)?(?:editorials?|compilation|magazine|quiz|mcq)\b/i,
  /\bcurrent affairs editorials?\b/i,
  /\b(?:test series|course|batch|cohort|admission|enrol|enroll|registration)\b/i,
  /\b(?:mains marathon|prelims marathon|answer writing|current affairs quiz|mcq|magazine|compilation|topper|mock interview)\b/i,
  /\b(?:upsc|civil services)\s+(?:notification|admit card|result|results)\b/i,
  /\b(?:download|buy|subscribe)\s+(?:our\s+)?(?:app|course|magazine|pdf|test series)\b/i,
  /^guide\s*:/i,
  /^category\s*:/i,
  /^\s*\[?(?:residential|classroom|online)\]?\b/i,
  /\b(?:weekly|monthly)\s+current affairs\s+pdf\b/i,
  /\btoppers?\s+wrote\b/i,
  /^(?:constitution of india|indian economy|indian polity|world history|ancient history|medieval history|modern history)$/i,
  /^(?:©|copyright\b)/i,
  /\ball rights reserved\b/i,
  /\bskills? required to (?:excel|crack|clear|succeed) in (?:the )?(?:upsc|civil services|ias)\b/i,
  /\bachiev(?:e|ing) success with (?:visionias|vision ias|drishti|insightsias|insights ias|forumias|next ias|vajiram|iasbaba|gktoday)\b/i,
  /\bbecome (?:a )?part of (?:the )?(?:visionias|vision ias|drishti|insightsias|insights ias|forumias|next ias|vajiram|iasbaba|gktoday)(?: community)?\b/i,
  /\b(?:join|follow) (?:the |our )?(?:visionias|vision ias|drishti|insightsias|insights ias|forumias|next ias|vajiram|iasbaba|gktoday)(?: community)?\b/i,
];

const GENERIC_TITLE_PATTERNS = [
  /^(?:current affairs|daily current affairs|news analysis|editorial|prelims|mains|upsc|civil services)$/i,
  /^(?:gs|general studies)\s*(?:paper)?\s*[-:]?\s*[1-4ivx]*$/i,
  /^(?:contents?|headlines?|read more|previous|next|about|contact)$/i,
];

const URL_NOISE_PATTERNS = [
  /\/(?:tag|tags|category|author|authors|archive|archives)\//i,
  /\/(?:courses?|test-series|admissions?|interview|toppers?|store|shop)(?:\/|$)/i,
  /\/(?:privacy-policy|terms-and-conditions|contact-us|about-us)(?:\/|$)/i,
  /[?&](?:s|search|q|query)=/i,
];



const BUNDLE_SIGNAL_GROUPS = [
  /\b(?:missile|defen[cs]e|military|air force|navy|army|weapon|security)\b/i,
  /\b(?:energy|bioenergy|economy|economic|bank|finance|gdp|inflation|trade|labou?r market)\b/i,
  /\b(?:labou?r|employment|worker|welfare|social|health|education)\b/i,
  /\b(?:technology|smart materials?|artificial intelligence|ai\b|space|satellite|semiconductor|quantum|digital)\b/i,
  /\b(?:geographical indications?|\bgi\b|heritage|culture|archaeolog|history)\b/i,
  /\b(?:khelo|sport|olympic|athlete|championship|tournament)\b/i,
  /\b(?:climate|environment|wildlife|biodiversity|forest|wetland|pollution)\b/i,
  /\b(?:court|parliament|constitution|governance|election|bill|act\b)\b/i,
  /\b(?:bilateral|diplomatic|foreign policy|strategic partnership|ambassador)\b/i,
];

function looksLikeMultiTopicBundle(title = "") {
  const value = clean(title);
  if (value.length < 50 || !/(?:,|;|\band\b|\bupdates?\b)/i.test(value)) return false;
  const groups = BUNDLE_SIGNAL_GROUPS.reduce(
    (count, pattern) => count + (pattern.test(value) ? 1 : 0),
    0
  );
  return groups >= 3;
}

const PROMO_TERMS = [
  "enroll now", "enrol now", "buy now", "join our course", "test series",
  "limited seats", "admission open", "download our app", "subscribe now",
  "classroom programme", "classroom program", "our batch", "fee structure",
];

function promoHits(text) {
  const value = clean(text).toLowerCase();
  return PROMO_TERMS.reduce((count, term) => count + (value.includes(term) ? 1 : 0), 0);
}

function looksLikeWrapper(title, summary) {
  const body = clean(summary);
  const headingLike = (body.match(/(?:^|\s)(?:prelims|mains|gs[- ]?[1-4]|source|contents?)\s*:/gi) || []).length;
  const linkish = (body.match(/\b(?:click here|read more|download|previous|next)\b/gi) || []).length;
  return title.length < 28 && body.length < 700 && headingLike + linkish >= 4;
}

export function inspectCoverageCandidate(topic = {}) {
  const title = clean(topic.title);
  const summary = clean(topic.summary || topic.description || topic.content);
  const url = clean(topic.url || topic.sourceUrl);
  const flags = [];

  if (!title) flags.push("missing_title");
  if (title.length < 8) flags.push("title_too_short");
  if (title.length > 210) flags.push("title_too_long");
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title))) flags.push("generic_wrapper_title");
  if (HARD_TITLE_PATTERNS.some((pattern) => pattern.test(title))) flags.push("non_article_title");
  if (URL_NOISE_PATTERNS.some((pattern) => pattern.test(url))) flags.push("non_article_url");
  if (summary && summary.length < 100) flags.push("thin_source_extract");
  if (promoHits(`${title} ${summary}`) >= 2) flags.push("promotional_content");
  if (looksLikeWrapper(title, summary)) flags.push("digest_or_navigation_wrapper");
  if (looksLikeMultiTopicBundle(title)) flags.push("multi_topic_bundle");

  const hardReject = flags.some((flag) => [
    "missing_title", "title_too_short", "generic_wrapper_title", "non_article_title",
    "non_article_url", "promotional_content", "digest_or_navigation_wrapper", "multi_topic_bundle",
  ].includes(flag));

  return {
    accepted: !hardReject,
    flags,
    reason: hardReject
      ? `Rejected by source sanitation: ${flags.join(", ")}.`
      : flags.length
        ? `Accepted with warnings: ${flags.join(", ")}.`
        : "Accepted as an article-like source candidate.",
  };
}

export function isCoverageSourceNoise(topic = {}) {
  return !inspectCoverageCandidate(topic).accepted;
}
