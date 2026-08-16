const configuredSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");

// Keep every canonical, sitemap and structured-data URL on the actual
// production host. When a custom domain is connected later, set
// NEXT_PUBLIC_SITE_URL and no code change is required.
export const SITE_URL = configuredSiteUrl || "https://cp.vliab.workers.dev";

export function absoluteSiteUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return SITE_URL;
  if (/^https?:\/\//i.test(text)) return text;
  return `${SITE_URL}${text.startsWith("/") ? text : `/${text}`}`;
}
