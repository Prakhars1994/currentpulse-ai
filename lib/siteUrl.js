// CurrentPulse has one public production origin. Deployment-host environment
// variables must not be allowed to leak a legacy Vercel hostname into SEO URLs.
export const SITE_URL = "https://cp.vliab.workers.dev";

export function absoluteSiteUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return SITE_URL;
  if (/^https?:\/\//i.test(text)) return text;
  return `${SITE_URL}${text.startsWith("/") ? text : `/${text}`}`;
}
