import {
  absoluteUrl,
  cleanText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const BASE_URL = "https://iasbaba.com";
const LIST_URL = `${BASE_URL}/current-affairs-for-ias-upsc-exams-2016-2017/`;
const LINK_PATTERN = /iasbaba\.com\/20\d{2}\/\d{2}\/daily-current-affairs-ias-upsc-prelims-and-mains-exam-/i;

const CATEGORY_ONLY = /^(?:science(?:\s*&\s*technology)?|technology|geography|environment|international relations|polity|governance|economy|agriculture|history|art(?:\s*&\s*culture)?|culture|society|social issues|security|internal security|ethics)(?:\s*[\/&,-]\s*(?:science|technology|geography|environment|international relations|polity|governance|economy|agriculture|history|art|culture|society|social issues|security|internal security|ethics))*$/i;

function collectRecentDigestLinks(html) {
  const $ = loadHtml(html);
  const links = [];
  $("a[href]").each((_, anchor) => {
    const url = absoluteUrl(BASE_URL, $(anchor).attr("href"));
    const title = cleanText($(anchor).text());
    if (!url || !LINK_PATTERN.test(url)) return;
    if (/quiz/i.test(title)) return;
    links.push({ url, title });
  });
  return uniqueByUrl(links).slice(0, 5);
}

function pageDate($) {
  return (
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) ||
    parseDate($("time").first().text()) ||
    null
  );
}

function rootNode($) {
  for (const selector of [".entry-content", ".post-content", "article", "main"]) {
    const node = $(selector).first();
    if (node.length && cleanText(node.text()).length > 600) return node;
  }
  return $("body");
}

function toBlocks($, root) {
  const nodes = root.find("h2,h3,h4,h5,h6,p,li,blockquote").toArray();
  const blocks = [];
  for (const node of nodes) {
    // Prevent duplicate list text by ignoring li if parent text was already represented as a paragraph-like block.
    const text = cleanText($(node).text());
    if (!text || text.length < 2) continue;
    const previous = blocks[blocks.length - 1];
    if (previous?.text === text) continue;
    blocks.push({ node, tag: node.tagName || "", text });
  }
  return blocks;
}

function isNoiseTitle(text = "") {
  const value = cleanText(text);
  return (
    value.length < 8 ||
    value.length > 190 ||
    CATEGORY_ONLY.test(value) ||
    /^(?:prelims|mains)\s*focus/i.test(value) ||
    /^(?:why in news|archives?|sources?\/references?|practice question|upsc prelims analysis)$/i.test(value) ||
    /iasbaba'?s daily current affairs/i.test(value)
  );
}

function locateTopicTitle(blocks, whyIndex) {
  for (let index = whyIndex - 1; index >= Math.max(0, whyIndex - 8); index -= 1) {
    const candidate = blocks[index]?.text || "";
    if (isNoiseTitle(candidate)) continue;
    if (/^(?:prelims|mains|gs\s*\d|paper\s*\d)/i.test(candidate)) continue;
    return { index, title: candidate };
  }
  return null;
}

function extractTopicsFromDigest(html, pageUrl) {
  const $ = loadHtml(html);
  const root = rootNode($);
  const blocks = toBlocks($, root);
  const publishedAt = pageDate($);
  const markers = [];

  blocks.forEach((block, index) => {
    if (/^why in news\??$/i.test(block.text)) {
      const title = locateTopicTitle(blocks, index);
      if (title) markers.push({ whyIndex: index, titleIndex: title.index, title: title.title });
    }
  });

  const topics = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const nextTitleIndex = markers[index + 1]?.titleIndex ?? blocks.length;
    const body = [];
    const seen = new Set();

    for (let cursor = marker.whyIndex; cursor < nextTitleIndex; cursor += 1) {
      const block = blocks[cursor];
      if (!block?.text) continue;
      if (/^(?:related posts|recent posts|subscribe|important links)$/i.test(block.text)) break;
      const key = block.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (cursor === marker.whyIndex) {
        body.push("### Why in News");
        continue;
      }
      body.push(block.tag === "li" ? `- ${block.text}` : block.text);
    }

    const summary = body.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 28000);
    if (summary.length < 120 || isNoiseTitle(marker.title)) continue;

    const category = guessCategory(`${marker.title} ${summary.slice(0, 1600)}`);
    const slug = marker.title
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    topics.push({
      source: "IASbaba",
      title: marker.title,
      summary,
      url: `${pageUrl.split("#")[0]}#${slug}`,
      publishedAt,
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    });
  }

  return uniqueByUrl(topics);
}

async function fetchDigest(item) {
  try {
    return extractTopicsFromDigest(await fetchHtml(item.url), item.url);
  } catch (error) {
    console.error(`[IASbaba adapter] ${item.url} failed:`, error?.message || error);
    return [];
  }
}

export async function fetchIasBabaTopics() {
  const listHtml = await fetchHtml(LIST_URL);
  const links = collectRecentDigestLinks(listHtml);
  if (!links.length) {
    throw new Error("IASbaba recent daily current-affairs links were not found.");
  }

  const pages = await Promise.all(links.map(fetchDigest));
  const topics = uniqueByUrl(pages.flat()).slice(0, 220);
  if (!topics.length) {
    throw new Error("IASbaba recent daily current-affairs pages contained no usable topics.");
  }
  return topics;
}
