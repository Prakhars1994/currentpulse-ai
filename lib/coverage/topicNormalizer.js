import { cleanText } from "@/lib/coverage/utils";

export function normalizeTopic(topic) {
  const title = cleanText(topic?.title);
  const summary = cleanText(topic?.summary || topic?.description);
  const url = cleanText(topic?.url);

  return {
    ...topic,
    title,
    summary,
    url,
    source: cleanText(topic?.source) || "Trusted UPSC Source",
    publishedAt: topic?.publishedAt || null,
    category: cleanText(topic?.category) || "Polity & Governance",
    paper: cleanText(topic?.paper) || "Prelims",
    keywords: Array.isArray(topic?.keywords)
      ? topic.keywords.map(cleanText).filter(Boolean)
      : [],
    imageUrl: cleanText(topic?.imageUrl || topic?.image_url) || null,
  };
}
