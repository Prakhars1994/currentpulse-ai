/**
 * Adds restrained Markdown emphasis to high-value exam facts. This is a display
 * helper for older articles that predate the stricter authoring prompt; it does
 * not change the underlying factual content.
 */
export function highlightMarkdownFacts(value = "") {
  return String(value || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(/\b((?:20(?:1[5-9]|2[0-6])))\b/g, "**$1**")
        .replace(/\b(\d+(?:\.\d+)?\s*(?:%|per\s+cent|crore|lakh|million|billion|trillion|GW|MW|km|km²|tonnes?|years?|days?))\b/gi, "**$1**")
        .replace(/(₹\s*\d+(?:\.\d+)?\s*(?:crore|lakh|million|billion)?)/gi, "**$1**")
        .replace(/\b(Article\s+\d+[A-Z]?(?:\(\d+\))?|Schedule\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|\d+))\b/gi, "**$1**")
        .replace(/\b([A-Z][A-Za-z &'-]+ Act,?\s+(?:19|20)\d{2})\b/g, "**$1**")
        .replace(/\b(RBI|SEBI|ISRO|DRDO|NITI Aayog|Supreme Court|Election Commission|CAG|Finance Commission|GST Council|World Bank|IMF|WHO|UNSC|UNESCO|IPCC)\b/g, "**$1**");
    })
    .join("");
}
