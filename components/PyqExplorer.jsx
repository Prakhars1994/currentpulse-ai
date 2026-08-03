"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

export default function PyqExplorer({ items }) {
  const [paper, setPaper] = useState("All papers");
  const [year, setYear] = useState("All years");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState("");

  const papers = ["All papers", ...new Set(items.map((item) => item.paper))];
  const years = ["All years", ...new Set(items.map((item) => String(item.year)))];

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      if (paper !== "All papers" && item.paper !== paper) return false;
      if (year !== "All years" && String(item.year) !== year) return false;
      if (!search) return true;
      return `${item.topic} ${item.question}`.toLowerCase().includes(search);
    });
  }, [items, paper, query, year]);

  return (
    <div>
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topic or question"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 outline-none focus:border-cyan-500"
          />
        </div>
        <select value={paper} onChange={(event) => setPaper(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none">
          {papers.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none">
          {years.map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>

      <div className="mt-6 space-y-4">
        {results.map((item, index) => {
          const id = `${item.year}-${item.paper}-${index}`;
          const isOpen = expanded === id;
          return (
            <article key={id} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">{item.year}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{item.paper}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{item.topic}</span>
              </div>
              <h2 className="mt-4 text-xl font-bold leading-8">{item.question}</h2>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? "" : id)}
                className="mt-5 font-bold text-cyan-400"
              >
                {isOpen ? "Hide answer framework" : "Show answer framework"} →
              </button>
              {isOpen && (
                <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <h3 className="font-bold text-cyan-300">Suggested structure</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
                    {item.approach.map((point) => <li key={point}>{point}</li>)}
                  </ol>
                </div>
              )}
            </article>
          );
        })}
        {!results.length && (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400">No matching PYQ themes.</div>
        )}
      </div>

      <a
        href="https://upsc.gov.in/examinations/previous-question-papers"
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:border-cyan-400"
      >
        Verify exact wording in official UPSC papers <ExternalLink size={17} />
      </a>
    </div>
  );
}
