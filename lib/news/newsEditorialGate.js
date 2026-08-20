function clean(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value, patterns) {
  return patterns.find((pattern) => pattern.test(value)) || null;
}

const UTILITY_TITLE_PATTERNS = [
  /^\s*(?:home|homepage|latest news|news|digital edition)\s*$/i,
  /\be-?paper\b/i,
  /\b(?:photo gallery|photo story|web stor(?:y|ies))\b/i,
  /^\s*(?:upsc|civil services)\s+(?:key|essentials|quiz|practice)\b/i,
];

const UTILITY_URL_PATTERNS = [
  /\/(?:e-?paper|epaper)(?:\/|\?|$)/i,
  /\/(?:web-stories?|photo-gallery|photo-story)(?:\/|\?|$)/i,
  /\/(?:horoscope|astrology)(?:\/|\?|$)/i,
];

const STRONG_PUBLIC_INTEREST_PATTERNS = [
  /\b(?:government|ministry|cabinet|parliament|lok sabha|rajya sabha|supreme court|high court|constitution|election commission|election|governor|president|prime minister|chief minister)\b/i,
  /\b(?:bill|act|rules?|notification|ordinance|policy|scheme|mission|census|commission|committee|regulator|judgment|verdict|order)\b/i,
  /\b(?:rbi|sebi|niti aayog|cag|gst|budget|economic survey|gdp|inflation|unemployment|fiscal|monetary policy|repo rate|trade|export|import|tariff|fdi|manufacturing)\b/i,
  /\b(?:defence|defense|army|navy|air force|missile|drdo|border|terror|insurgency|cyberattack|security breach)\b/i,
  /\b(?:isro|satellite|space mission|semiconductor|quantum|artificial intelligence|ai regulation|data protection|biotechnology|vaccine|outbreak|public health)\b/i,
  /\b(?:climate|pollution|biodiversity|forest|wildlife|cyclone|flood|earthquake|drought|landslide|heatwave|glacier|river|dam)\b/i,
  /\b(?:summit|treaty|agreement|ceasefire|sanction|diplomacy|foreign policy|united nations|world bank|imf|brics|g20|sco|asean|quad|nato|war|conflict)\b/i,
  /\b(?:railway|train|bridge|road|airport|port|power grid|hospital|school|university|municipal|district administration)\b/i,
];

const LOW_VALUE_PATTERNS = [
  /\b(?:horoscope|astrology|zodiac|tarot)\b/i,
  /\b(?:recipe|fashion|beauty tips?|skin care|skincare|relationship tips?|dating tips?)\b/i,
  /\b(?:celebrity gossip|box office|movie review|film review|ott release|web series|viral celebrity|who wore what)\b/i,
  /\b(?:fitness tips?|weight loss|diet plan|healthy heart habits?|workout routine)\b/i,
  /\b(?:stock to buy|stocks to buy|stocks to watch|share price target|brokerage call|market live|ipo subscription|mutual fund picks?|personal finance tips?)\b/i,
  /\b(?:coupon|shopping deal|discount code|best gadgets? to buy|product review)\b/i,
  /\b(?:dream11|fantasy cricket|live cricket score|match prediction)\b/i,
];

const MARKET_TICKER_PATTERN = /\b(?:share|stock)\b[\s\S]{0,90}\b(?:rises?|falls?|jumps?|drops?|gains?|loses?|target|buy|sell|brokerage)\b/i;

export function assessNewsEditorialValue(candidate = {}) {
  const title = clean(candidate.title);
  const summary = clean(
    candidate.description || candidate.summary || candidate.content
  );
  const url = clean(
    candidate.url || candidate.link || candidate.sourceUrl || candidate.source_url
  );
  const combined = `${title} ${summary}`.trim();

  if (!title || title.length < 8) {
    return {
      allowed: false,
      code: "invalid_editorial_title",
      reason: "The item has no usable newsroom headline.",
    };
  }

  const utilityTitle = firstMatch(title, UTILITY_TITLE_PATTERNS);
  if (utilityTitle) {
    return {
      allowed: false,
      code: "news_utility_or_digest_page",
      reason: "The item is an e-paper, utility, gallery or exam-digest page rather than a standalone news story.",
    };
  }

  const utilityUrl = firstMatch(url, UTILITY_URL_PATTERNS);
  if (utilityUrl) {
    return {
      allowed: false,
      code: "news_utility_url",
      reason: "The source URL points to a utility, e-paper or non-story vertical.",
    };
  }

  if (firstMatch(combined, STRONG_PUBLIC_INTEREST_PATTERNS)) {
    return {
      allowed: true,
      code: "public_interest_news",
      reason: "The story contains a clear governance, economy, security, science, environment, infrastructure or international-affairs signal.",
    };
  }

  const lowValue = firstMatch(combined, LOW_VALUE_PATTERNS);
  if (lowValue || MARKET_TICKER_PATTERN.test(combined)) {
    return {
      allowed: false,
      code: "low_value_news_vertical",
      reason: "Lifestyle, entertainment, personal-finance, market-ticker or fantasy-sports content is outside the CurrentPulse public-news stream.",
    };
  }

  return {
    allowed: true,
    code: "general_public_news",
    reason: "The story is a standalone general-news item and does not match a low-value vertical.",
  };
}