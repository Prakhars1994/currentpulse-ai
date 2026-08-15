const IST_OFFSET = "+05:30";

export function indiaDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function indiaDayRange(value = new Date()) {
  const date = indiaDate(value);
  const start = new Date(`${date}T00:00:00${IST_OFFSET}`);
  const end = new Date(start.getTime() + 86_400_000);
  return { date, start: start.toISOString(), end: end.toISOString() };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : indiaDate();
}

function validMonth(value) {
  return /^\d{4}-\d{2}$/.test(value || "") ? value : indiaDate().slice(0, 7);
}

function formatLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function resolveDigestRange(period, rawDate) {
  if (period === "monthly") {
    const month = validMonth(rawDate);
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(`${month}-01T00:00:00${IST_OFFSET}`);
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const end = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00${IST_OFFSET}`
    );
    return {
      period,
      value: month,
      start,
      end,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(start),
    };
  }

  const date = validDate(rawDate);
  const selectedStart = new Date(`${date}T00:00:00${IST_OFFSET}`);
  const end = new Date(selectedStart.getTime() + 86_400_000);

  if (period === "weekly") {
    const start = new Date(end.getTime() - 7 * 86_400_000);
    return {
      period,
      value: date,
      start,
      end,
      label: `${formatLabel(start)} – ${formatLabel(selectedStart)}`,
    };
  }

  return {
    period: "daily",
    value: date,
    start: selectedStart,
    end,
    label: formatLabel(selectedStart),
  };
}
