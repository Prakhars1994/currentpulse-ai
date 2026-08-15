function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function rotatingSlice(items, count, slot) {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
  if (count >= items.length) return [...items];

  const offset = ((Number(slot) || 0) * count) % items.length;
  return Array.from({ length: count }, (_, index) => items[(offset + index) % items.length]);
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function indiaHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  return Number(parts.find((part) => part.type === "hour")?.value || 0);
}

function indiaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function dailyWindowIndex(now, hours) {
  const hour = indiaHour(now);
  const exact = hours.indexOf(hour);
  if (exact >= 0) return exact;
  // Manual/off-window calls still rotate deterministically by the current hour.
  return Math.floor(hour / Math.max(1, Math.floor(24 / hours.length)));
}

function dayOrdinal(now = new Date()) {
  return Math.floor(Date.parse(`${indiaDate(now)}T00:00:00Z`) / 86_400_000);
}

export function selectScheduledNewsSources(sources = [], now = new Date()) {
  const activeGroups = new Set(["indian-news", "state-news", "global-news", "official"]);
  const active = sources.filter((source) => activeGroups.has(source.group));
  const persistent = active.filter((source) => source.id === "pib-direct");
  const agenda = active.filter(
    (source) => source.newsAgenda && source.id !== "pib-direct"
  );
  const agendaIds = new Set(agenda.map((source) => source.id));
  const persistentIds = new Set(persistent.map((source) => source.id));
  const supplemental = active.filter(
    (source) => !agendaIds.has(source.id) && !persistentIds.has(source.id)
  );
  const corePerRun = boundedInteger(
    process.env.NEWS_CORE_SOURCES_PER_RUN,
    4,
    2,
    8
  );
  const supplementalPerRun = boundedInteger(
    process.env.NEWS_SUPPLEMENTAL_SOURCES_PER_RUN,
    2,
    0,
    8
  );
  const slot = Math.floor(new Date(now).getTime() / 3_600_000);
  const rotatingAgenda = rotatingSlice(agenda, corePerRun, slot);
  const rotatingSupplemental = rotatingSlice(
    supplemental,
    supplementalPerRun,
    slot
  );
  const selected = uniqueById([
    ...persistent,
    ...rotatingAgenda,
    ...rotatingSupplemental,
  ]);

  return {
    sources: selected,
    configuredCount: active.length,
    coreCount: persistent.length + rotatingAgenda.length,
    supplementalCount: rotatingSupplemental.length,
    selectedIds: selected.map((source) => source.id),
  };
}

/**
 * Coverage runs in four known IST windows (06, 12, 19, 22).  The previous
 * hourly-slot arithmetic could repeatedly hit the same 4-source block after
 * the source catalog expanded from 8 to 12 entries.  This window-aware
 * rotation guarantees every configured source is visited each day when the
 * normal four windows run, while rotating which group gets the extra visit.
 */
export function selectScheduledCoverageSourceIds(sourceIds = [], now = new Date()) {
  const ids = [...new Set(sourceIds.map((value) => String(value || "").trim()).filter(Boolean))];
  const perRun = boundedInteger(process.env.COVERAGE_SOURCES_PER_RUN, 4, 1, 6);
  if (ids.length <= perRun) return ids;

  const groups = Math.ceil(ids.length / perRun);
  const window = dailyWindowIndex(now, [6, 12, 19, 22]);
  const slot = (dayOrdinal(now) + window) % groups;
  return rotatingSlice(ids, perRun, slot);
}

/**
 * Keep UPSC/SSC plus one Railway and one Banking authority hot every ResultPulse
 * run.  Two additional slots rotate through NTA, SBI, regional RRBs, Defence
 * and State PSC sources so NTA can no longer crowd out the core job exams.
 */
export function selectScheduledExamSources(sources = [], now = new Date()) {
  const coreIds = new Set(["upsc", "ssc", "rrcb", "ibps"]);
  const core = sources.filter((source) => coreIds.has(String(source?.id || "")));
  const coreSet = new Set(core.map((source) => source.id));
  const supplemental = sources.filter((source) => !coreSet.has(source.id));
  const totalPerRun = boundedInteger(process.env.EXAM_SOURCES_PER_RUN, 6, 4, 9);
  const rotatingCount = Math.max(0, totalPerRun - core.length);
  const window = dailyWindowIndex(now, [6, 12, 19, 22]);
  const slot = rotatingCount > 0 ? Math.floor(window * rotatingCount) : 0;
  return uniqueById([
    ...core,
    ...rotatingSlice(supplemental, rotatingCount, slot),
  ]).slice(0, totalPerRun);
}

export function shouldAttemptDailyQuiz(now = new Date()) {
  return [6, 18].includes(indiaHour(now));
}

export function shouldRecoverFailedQueue(now = new Date()) {
  return new Date(now).getUTCHours() % 6 === 0;
}
