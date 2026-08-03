"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileCheck2 } from "lucide-react";

import { UPSC_PAPER_ARCHIVE, UPSC_PAPER_SOURCE } from "@/lib/upsc/questionPapers";

export default function OfficialPapers({ papers }) {
  const [stage, setStage] = useState("All");
  const [year, setYear] = useState("All");
  const years = [...new Set(papers.map((paper) => String(paper.year)))];
  const filtered = useMemo(
    () =>
      papers.filter(
        (paper) =>
          (stage === "All" || paper.stage === stage) &&
          (year === "All" || String(paper.year) === year)
      ),
    [papers, stage, year]
  );

  return (
    <div>
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-300">
          Exam stage
          <select value={stage} onChange={(event) => setStage(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
            <option>All</option><option>Prelims</option><option>Mains</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-300">
          Year
          <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
            <option>All</option>{years.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filtered.map((paper) => (
          <article key={`${paper.year}-${paper.stage}-${paper.paper}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">{paper.year}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{paper.stage}</span>
              </div>
              <FileCheck2 className="text-emerald-400" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-bold leading-7 text-white">{paper.paper}</h2>
            <p className="mt-2 text-sm text-slate-400">Original PDF hosted by the Union Public Service Commission.</p>
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-400">
              <Download size={17} /> Download official PDF
            </a>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={UPSC_PAPER_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-400"><ExternalLink size={17} /> UPSC current listing</a>
        <a href={UPSC_PAPER_ARCHIVE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-400"><ExternalLink size={17} /> UPSC archives</a>
      </div>
    </div>
  );
}
