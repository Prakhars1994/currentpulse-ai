const DEFAULT_SITE_URL = "https://currentpulse-ai.vercel.app";

function normalizeSiteUrl(value) {
  const candidate = String(value || DEFAULT_SITE_URL).trim();

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  const normalized = withProtocol.replace(/\/+$/, "");

  if (
    process.env.NODE_ENV === "production" &&
    normalized.includes("localhost")
  ) {
    return DEFAULT_SITE_URL;
  }

  return normalized;
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL
);

export function absoluteSiteUrl(value = "") {
  if (!value) return SITE_URL;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}