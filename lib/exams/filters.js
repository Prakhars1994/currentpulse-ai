import { EXAM_UPDATE_TYPES } from "./constants.js";
import { EXAM_OFFICIAL_SOURCES } from "./sourceCatalog.js";

export const EXAM_FILTER_GROUPS = [
  "UPSC",
  "SSC",
  "Railways",
  "Banking",
  "Entrance Exams",
  "Defence",
  "State PSC",
];

export const EXAM_FILTER_SOURCES = EXAM_OFFICIAL_SOURCES.map((source) => ({
  id: source.id,
  label: source.name,
  agency: source.agency,
  group: source.group,
}));

const SOURCE_BY_ID = new Map(EXAM_FILTER_SOURCES.map((source) => [source.id, source]));

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value, maxLength = 80) {
  return String(first(value) || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeExamSearch(value) {
  return clean(value, 60)
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeExamFilters(input = {}) {
  const type = clean(input.type, 30);
  const group = clean(input.group, 40);
  const source = clean(input.source, 40);

  return {
    type: EXAM_UPDATE_TYPES.includes(type) ? type : "",
    group: EXAM_FILTER_GROUPS.includes(group) ? group : "",
    source: SOURCE_BY_ID.has(source) ? source : "",
    q: normalizeExamSearch(input.q),
  };
}

export function normalizeExamPage(value) {
  const raw = Number(first(value));
  return Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 10000) : 1;
}

export function getExamSourceFilter(sourceId = "") {
  return SOURCE_BY_ID.get(String(sourceId || "")) || null;
}
