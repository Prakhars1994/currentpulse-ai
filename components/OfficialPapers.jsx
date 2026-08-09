"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileCheck2, Archive } from "lucide-react";
import { UPSC_PAPER_ARCHIVE, UPSC_PAPER_SOURCE } from "@/lib/upsc/questionPapers";

export default function OfficialPapers({ papers }) {
  const [stage, setStage] = useState("Prelims");
  const [year, setYear] = useState("All");
  const years = [...new Set(papers.map((paper) => String(paper.year)))].sort((a,b) => Number(b)-Number(a));
  const filtered = useMemo(() => papers.filter((paper) => (stage === "All" || paper.stage === stage) && (year === "All" || String(paper.year) === year)), [papers, stage, year]);

  return (
    <div>
      <div className="paper-filter-panel">
        <div className="paper-stage-tabs" aria-label="Question paper stage">
          {["Prelims", "Mains", "All"].map((value) => <button key={value} type="button" className={stage === value ? "is-active" : ""} onClick={() => setStage(value)}>{value}</button>)}
        </div>
        <label>Year<select value={year} onChange={(event) => setYear(event.target.value)}><option>All</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>

      <p className="paper-coverage-note"><strong>12-year coverage:</strong> 2015–2026. Recent verified direct PDFs open immediately; older years open the official UPSC archive so CurrentPulse never guesses a legacy PDF URL.</p>

      <div className="paper-card-grid">
        {filtered.map((paper, index) => (
          <article key={`${paper.year}-${paper.stage}-${paper.paper}-${index}`} className="paper-card">
            <div className="paper-card-top"><div><span>{paper.year}</span><span>{paper.stage}</span></div>{paper.direct === false ? <Archive size={20} /> : <FileCheck2 size={20} />}</div>
            <h2>{paper.paper}</h2>
            <p>{paper.direct === false ? "Locate the original paper in the official UPSC archive for this year." : "Original PDF hosted by the Union Public Service Commission."}</p>
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="paper-download-action">
              {paper.direct === false ? <><ExternalLink size={17} /> Open official archive</> : <><Download size={17} /> Open official PDF</>}
            </a>
          </article>
        ))}
      </div>

      <div className="paper-official-links">
        <a href={UPSC_PAPER_SOURCE} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> UPSC current listing</a>
        <a href={UPSC_PAPER_ARCHIVE} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> UPSC archives</a>
      </div>
    </div>
  );
}
