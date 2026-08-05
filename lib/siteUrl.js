export const SITE_URL = "https://currentpulse-ai.vercel.app";

export function absoluteSiteUrl(value = "") {
  const text = String(value || "").trim();

  if (!text) return SITE_URL;

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `${SITE_URL}${text.startsWith("/") ? text : `/${text}`}`;
}