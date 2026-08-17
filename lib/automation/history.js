export function normalizeHistoryDate(value = "") {
  const input = String(value || "").trim();
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(input)) return "";
  const parsed = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10) === input ? input : "";
}

export function historyDateWindow(value = "") {
  const date = normalizeHistoryDate(value);
  if (!date) return null;
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86_400_000);
  const calendarNext = new Date(`${date}T00:00:00Z`);
  calendarNext.setUTCDate(calendarNext.getUTCDate() + 1);
  return {
    date,
    start: start.toISOString(),
    end: end.toISOString(),
    nextDate: calendarNext.toISOString().slice(0, 10),
  };
}

export function historyDateParts(value = "") {
  const date = normalizeHistoryDate(value);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  const dayNumber = parsed.getUTCDate();
  const lastTwo = dayNumber % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : dayNumber % 10 === 1
        ? "st"
        : dayNumber % 10 === 2
          ? "nd"
          : dayNumber % 10 === 3
            ? "rd"
            : "th";
  return {
    date,
    year: parsed.getUTCFullYear(),
    month: String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    monthName: parsed.toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    }),
    day: String(dayNumber).padStart(2, "0"),
    dayNumber,
    ordinalDay: `${dayNumber}${suffix}`,
  };
}

export function isOnHistoryDate(value, historyDate) {
  const window = historyDateWindow(historyDate);
  if (!window) return true;
  const timestamp = new Date(value || 0).getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp >= new Date(window.start).getTime() &&
    timestamp < new Date(window.end).getTime()
  );
}

export function enumerateHistoryDates(fromValue = "", toValue = "", maximumDays = 62) {
  const from = normalizeHistoryDate(fromValue);
  const to = normalizeHistoryDate(toValue || fromValue);
  if (!from || !to) return [];
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (end < start) return [];
  const dates = [];
  for (let value = start; value <= end && dates.length < maximumDays; value += 86_400_000) {
    dates.push(new Date(value).toISOString().slice(0, 10));
  }
  return dates;
}
