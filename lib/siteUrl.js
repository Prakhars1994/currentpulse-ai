function normaliseSiteUrl(value = "") {
  const cleaned = String(value || "").trim().replace(/\/$/, "");
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

export const SITE_URL =
  normaliseSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL
  ) || "https://currentpulse-ai-kl7x.vercel.app";

export function absoluteSiteUrl(path = "") {
  const value = String(path || "").trim();
  if (!value) return SITE_URL;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
