import { assessPublishedArticle } from "@/lib/editorial/publicationSafety";
import { assessNewsOutputQuality } from "@/lib/news/newsOutputQuality";

const LOW_VALUE_NEWS_PATTERNS = [
  /\btenders?\s+(?:for|notice|document|reference|invitation)\b/i,
  /\b(?:supply|procurement|purchase|hiring)\s+(?:and\s+installation\s+)?of\b/i,
  /\b(?:movable absorber|fiber optic power meter|relay|equipment)\b.*\b(?:tender|procurement|supply)\b/i,
  /\b(?:invites?|issues?|floats?|releases?)\s+(?:an?\s+)?(?:e-?)?tenders?\b/i,
  /\bprocurement\s+(?:tender|notice|portal|process|of)\b/i,
  /\be[- ]?procurement\b/i,
  /\brequest for proposal\b/i,
  /\bexpression of interest\b/i,
  /\bbid invitation\b/i,
  /\bsupply of\b/i,
  /\bpurchase of\b/i,
  /\brecruitment (?:drive|notice|notification)\b/i,
  /\b(?:scientist|engineer|officer|assistant)\s+recruitment\b/i,
  /\bscheduled maintenance\b/i,
  /\bmaintenance downtime\b/i,
  /\bportal downtime\b/i,
  /\bquarterly sales\b/i,
  /\bmonthly sales\b/i,
  /\bshare price (?:rises|falls|jumps|drops)\b/i,
  /\bdividend announcement\b/i,
  /\bboard meeting\b/i,
  /\bquarterly\s+(?:net\s+)?(?:profit|loss|results?|earnings|revenue)\b/i,
  /\b(?:net\s+)?profit\b[\s\S]{0,80}\bquarter\b/i,
  /\b(?:awards?|wins?|secures?|bags?)\b[\s\S]{0,100}\b(?:corporate |supply |procurement )?contract\b/i,
  /\br\.?\s*madhavan\b[\s\S]{0,160}\b(?:post|tweet|instagram|social media|finland)\b/i,
];

const STRONG_PUBLIC_INTEREST_OVERRIDES = [
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
  /\bwar\b/i,
  /\barmed conflict\b/i,
  /\bearthquake\b/i,
  /\bcyclone\b/i,
  /\bfloods?\b/i,
  /\bclimate report\b/i,
];

function text(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function articleText(article = {}) {
  return text(`${article.title || ""} ${article.why_news || article.description || ""}`);
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export function isObviousLowValueNews(article = {}) {
  const combined = articleText(article);
  if (!combined) return true;

  const hasLowValuePattern = LOW_VALUE_NEWS_PATTERNS.some((pattern) => pattern.test(combined));
  if (!hasLowValuePattern) return false;

  return !STRONG_PUBLIC_INTEREST_OVERRIDES.some((pattern) => pattern.test(combined));
}

/**
 * Prevent a stale source from being republished as "today's" news.
 * We only apply this when source timestamps are available; missing timestamps
 * are not treated as evidence of staleness.
 */
export function hasClearlyStaleSource(article = {}, maxAgeDays = 14) {
  const publishedAt = parseDate(article.created_at);
  if (!publishedAt) return false;

  const sourceDates = (article.article_sources || [])
    .map((source) => parseDate(source?.source_published_at))
    .filter(Boolean);

  if (!sourceDates.length) return false;
  const newestSource = new Date(Math.max(...sourceDates.map((date) => date.getTime())));
  const ageMs = publishedAt.getTime() - newestSource.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function hasMisleadingHistoricalDate(article = {}) {
  const publication = parseDate(article.created_at);
  if (!publication) return false;
  const publicationYear = publication.getUTCFullYear();
  const combined = articleText(article);
  const years = [...combined.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (!years.some((year) => year <= publicationYear - 2)) return false;
  if (years.includes(publicationYear)) return false;
  return !/\b(?:since|anniversary|retrospective|review|legacy|years? after|impact of|revisits?)\b/i.test(combined);
}

export function isDisplayWorthyNews(article = {}) {
  if (!assessPublishedArticle(article, { stream: "news" }).allowed) return false;
  if (isObviousLowValueNews(article)) return false;
  if (hasClearlyStaleSource(article)) return false;
  if (hasMisleadingHistoricalDate(article)) return false;
  if (!assessNewsOutputQuality(article).allowed) return false;
  return true;
}
