import { Type } from "@google/genai";

import { generateWithRouter } from "@/lib/ai/router";

const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

const schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          articleId: { type: Type.INTEGER },
          imageSearchQuery: { type: Type.STRING },
          visualSummary: { type: Type.STRING },
          memoryTrick: { type: Type.STRING },
          mapLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "articleId",
          "imageSearchQuery",
          "visualSummary",
          "memoryTrick",
          "mapLocations",
        ],
      },
    },
  },
  required: ["items"],
};

function plain(value = "", maximum = 2600) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function parse(response) {
  const text = response?.text?.trim();
  if (!text) throw new Error("Study-aid AI returned an empty response.");
  const value = JSON.parse(
    text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
  );
  if (!Array.isArray(value?.items)) throw new Error("Study-aid AI returned invalid JSON.");
  return value.items;
}

function validate(items, articles) {
  const ids = new Set(articles.map((article) => Number(article.id)));
  return items
    .map((item) => ({
      articleId: Number(item?.articleId),
      imageSearchQuery: plain(item?.imageSearchQuery, 220),
      visualSummary: String(item?.visualSummary || "").trim().slice(0, 900),
      memoryTrick: String(item?.memoryTrick || "").trim().slice(0, 900),
      mapLocations: Array.isArray(item?.mapLocations)
        ? item.mapLocations.map((location) => plain(location, 100)).filter(Boolean).slice(0, 4)
        : [],
    }))
    .filter(
      (item) =>
        ids.has(item.articleId) &&
        item.imageSearchQuery.length >= 8 &&
        item.visualSummary.length >= 35 &&
        item.memoryTrick.length >= 18
    );
}

export async function generateStudyAids(articles) {
  const sources = articles.map((article) => ({
    id: article.id,
    title: plain(article.title, 240),
    category: plain(article.category, 80),
    whyInNews: plain(article.why_news, 900),
    prelims: plain(article.prelims, 2300),
    mains: plain(article.mains, 900),
  }));
  const prompt = `You create visual-revision aids for UPSC current-affairs articles.

For EVERY ARTICLE below return:
- imageSearchQuery: a very specific Wikimedia Commons search phrase naming the exact visible event, agreement, institution, court, mission, person, species, technology or geography. Include the correct event year and principal actors when the article supplies them, so an older look-alike event is not selected. Never return a broad category such as economy, polity, parliament or stock market.
- visualSummary: exactly this Markdown learning chain: **Trigger:** ... → **Core idea:** ... → **UPSC link:** ...
- memoryTrick: a short respectful mnemonic or mental association based only on facts in that article. It must improve retention, not merely repeat the title.
- mapLocations: up to four important countries/cities/seas/rivers/regions explicitly present; [] if a map adds no learning value.

Never add an unsupported fact. Never confuse facts between articles. Return JSON only.

ARTICLES:
${JSON.stringify(sources)}`;

  let lastError;
  for (const model of MODELS) {
    try {
      const response = await generateWithRouter({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 10000,
          temperature: 0.15,
        },
      });
      const items = validate(parse(response), articles);
      if (items.length < Math.max(1, Math.floor(articles.length * 0.75))) {
        throw new Error(`Only ${items.length}/${articles.length} study aids passed validation.`);
      }
      return items;
    } catch (error) {
      lastError = error;
      console.error(`[Study aids] ${model} failed:`, error?.message || error);
    }
  }
  throw lastError || new Error("Study-aid generation failed.");
}
