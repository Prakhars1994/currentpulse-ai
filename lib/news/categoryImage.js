const IMAGE_BY_CATEGORY = {
  "polity & governance": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80",
  polity: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80",
  judiciary: "https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=1200&auto=format&fit=crop&q=80",
  economy: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80",
  "international relations": "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1200&auto=format&fit=crop&q=80",
  international: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1200&auto=format&fit=crop&q=80",
  "science & technology": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&auto=format&fit=crop&q=80",
  space: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
  environment: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop&q=80",
  "defence & security": "https://images.unsplash.com/photo-1569511166187-97eb6e387e19?w=1200&auto=format&fit=crop&q=80",
  "social issues": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&auto=format&fit=crop&q=80",
  geography: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80",
  "history & culture": "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=1200&auto=format&fit=crop&q=80",
  "government schemes": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&auto=format&fit=crop&q=80",
  sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop&q=80",
};

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
];

function stableIndex(value = "", length = 1) {
  const hash = [...String(value)].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7
  );
  return hash % Math.max(1, length);
}

export function getCategoryFallbackImage(category = "", seed = "") {
  const categoryImage = IMAGE_BY_CATEGORY[String(category).trim().toLowerCase()];
  if (categoryImage) return categoryImage;
  return DEFAULT_IMAGES[stableIndex(seed, DEFAULT_IMAGES.length)];
}

const GENERIC_IMAGE_URLS = new Set([
  ...Object.values(IMAGE_BY_CATEGORY),
  ...DEFAULT_IMAGES,
].map((url) => url.split("?")[0]));

export function isGenericFallbackImage(value = "") {
  const normalized = String(value || "").split("?")[0];
  return GENERIC_IMAGE_URLS.has(normalized);
}

export function getArticleVisualUrl(article = {}) {
  const params = new URLSearchParams({
    title: article.title || "UPSC Current Affairs",
    category: article.category || "Current Affairs",
  });
  return `/api/article-visual?${params.toString()}`;
}

function hostname(value = "") {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isVerifiedReusableArticleImage(article = {}) {
  const storedImage = article.image || article.image_url || "";
  if (!storedImage || isGenericFallbackImage(storedImage)) return false;
  if (String(storedImage).startsWith("/api/article-visual")) return true;

  const imageHost = hostname(storedImage);
  const sourceHost = hostname(article.image_source_url || "");
  return (
    imageHost === "upload.wikimedia.org" ||
    imageHost === "commons.wikimedia.org" ||
    sourceHost === "commons.wikimedia.org" ||
    sourceHost.endsWith(".commons.wikimedia.org")
  );
}

export function resolveDisplayImage(article = {}) {
  const storedImage = article.image || article.image_url || "";
  if (isVerifiedReusableArticleImage(article)) return storedImage;
  return getArticleVisualUrl(article);
}
