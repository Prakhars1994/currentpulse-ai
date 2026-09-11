import Link from "next/link";
import { loadExamUpdates } from "@/lib/exams/repository";
import { getExamUpdateDisplayType } from "@/lib/exams/displayType";

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function leadingDateTimestamp(title = "") {
  const match = String(title).trim().match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i
  );
  if (!match) return 0;
  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  const year = Number(match[3]);
  if (!Number.isInteger(month) || day < 1 || day > 31) return 0;
  return Date.UTC(year, month, day);
}

function indiaTodayTimestamp() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
}

function cleanPreviewTitle(title = "") {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (leadingDateTimestamp(text)) return text;
  return text.replace(/^\d{1,3}\s+(?=[A-Za-z(])/, "").trim();
}

export default async function ResultPulsePreview() {
  let updates = [];

  try {
    // Twelve keeps the same bounded per-source read size as six while giving
    // the preview room to skip malformed future-dated source rows.
    const result = await loadExamUpdates({ limit: 12 });
    const today = indiaTodayTimestamp();
    updates = (result?.updates || [])
      .filter((item) => {
        const titleDate = leadingDateTimestamp(item?.title || "");
        return !titleDate || titleDate <= today;
      })
      .slice(0, 6)
      .map((item) => ({ ...item, title: cleanPreviewTitle(item.title) }));
  } catch (error) {
    console.error(
      "[ResultPulsePreview] updates unavailable:",
      error instanceof Error ? error.message : String(error)
    );
  }

  return <section className="border-y border-violet-400/10 bg-slate-950 py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-black uppercase tracking-[.2em] text-violet-400">New · ResultPulse AI</p><h2 className="mt-2 text-4xl font-black text-white">Results, admit cards & exam alerts</h2><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-400">Official-source exam updates without storing candidate marks. Open the authority link when action is required.</p></div><Link href="/exams" className="w-fit rounded-xl bg-violet-400 px-5 py-3 font-black text-slate-950">Open ResultPulse →</Link></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3">{updates.length ? updates.map((item)=><Link key={item.id} href={`/exams/${item.slug}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-violet-400/50"><span className="text-xs font-black uppercase text-violet-300">{getExamUpdateDisplayType(item)}</span><h3 className="mt-3 line-clamp-3 text-lg font-black leading-snug text-white">{item.title}</h3><p className="mt-3 text-xs font-bold text-slate-500">{item.source_name || item.agency}</p></Link>) : <div className="md:col-span-3 rounded-2xl border border-dashed border-slate-700 p-7 text-slate-400">ResultPulse updates are temporarily unavailable. Browse the official exam archive for the latest notices.</div>}</div>
  </div></section>;
}
