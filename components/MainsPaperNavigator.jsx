"use client";

import { useMemo, useState } from "react";
import { Archive, Download, ExternalLink } from "lucide-react";

export default function MainsPaperNavigator({ papers }) {
  const [paper, setPaper] = useState("All papers");
  const [year, setYear] = useState("All years");
  const paperOptions = ["All papers", "GS-1", "GS-2", "GS-3", "GS-4"];
  const yearOptions = [
    "All years",
    ...new Set(papers.map((item) => String(item.year)).sort((left, right) => Number(right) - Number(left))),
  ];

  const filtered = useMemo(() => papers.filter((item) =>
    (paper === "All papers" || item.paper === paper) &&
    (year === "All years" || String(item.year) === year)
  ), [paper, papers, year]);

  const grouped = filtered.reduce((result, item) => {
    const key = String(item.year);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});

  return (
    <section className="rounded-3xl border border-cyan-500/25 bg-slate-900/80 p-5 sm:p-7" aria-labelledby="mains-paper-navigator-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-bold uppercase tracking-[0.18em] text-cyan-300">Verified paper coverage</p>
          <h2 id="mains-paper-navigator-title" className="mt-2 text-2xl font-black sm:text-3xl">15-year Mains paper navigator</h2>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            All <strong>{papers.length} General Studies papers</strong> across 2011–2025 are indexed. The 2011–2012 papers use the older two-paper GS pattern; GS‑1 to GS‑4 begins in 2013.
          </p>
        </div>
        <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">2011–2025</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-300">
          Paper
          <select value={paper} onChange={(event) => setPaper(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400">
            {paperOptions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-300">
          Year
          <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400">
            {yearOptions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-4">
        {Object.entries(grouped)
          .sort(([left], [right]) => Number(right) - Number(left))
          .map(([groupYear, items]) => (
            <article key={groupYear} className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-black text-white">{groupYear}</h3>
                <span className="text-xs font-bold text-slate-400">{items[0]?.pattern}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item) => (
                  <a
                    key={`${item.year}-${item.paper}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl border border-slate-700 bg-slate-900 p-3 hover:border-cyan-400"
                  >
                    <span className="flex items-center justify-between gap-2 font-black text-cyan-300">
                      {item.paper}
                      {item.direct ? <Download size={16} /> : <Archive size={16} />}
                    </span>
                    <small className="mt-2 block leading-5 text-slate-400">
                      {item.direct ? "Direct official PDF" : item.official ? "Find this year in UPSC archive" : `Verified via ${item.sourceName}`}
                    </small>
                  </a>
                ))}
              </div>
            </article>
          ))}
      </div>

      <a href="https://www.upsc.gov.in/examinations/previous-question-papers/archives" target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 font-bold text-cyan-300 hover:text-cyan-200">
        Open the complete official UPSC archive <ExternalLink size={16} />
      </a>
    </section>
  );
}
