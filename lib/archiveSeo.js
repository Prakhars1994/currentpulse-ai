// Keep archive navigation and canonical URLs in agreement.
export function archivePage(value) {
  if (value === undefined) return 1;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function validArchiveDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function archiveHref({ date, page = 1, exam = "upsc", lang = "" } = {}) {
  const query = new URLSearchParams();
  if (validArchiveDate(date)) query.set("date", date);
  if (page > 1) query.set("page", String(page));
  if (exam !== "upsc") query.set("exam", exam);
  if (lang === "hi") query.set("lang", lang);
  return `/current-affairs${query.size ? `?${query}` : ""}`;
}

export function hindiArchiveHref(page = 1) {
  return `/current-affairs/hindi${page > 1 ? `?page=${page}` : ""}`;
}
