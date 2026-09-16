import PyqExplorer from "@/components/PyqExplorer";
import MainsPaperNavigator from "@/components/MainsPaperNavigator";
import { PYQ_ITEMS } from "@/lib/study/pyqs";
import { MAINS_GENERAL_STUDIES_LIBRARY, UPSC_PAPER_SOURCE } from "@/lib/upsc/questionPapers";
import Link from "next/link";

export const metadata = {
  title: "UPSC Mains PYQ Explorer — Latest 15 Years",
  description: "Browse the latest 15 examination years of UPSC Mains General Studies papers and practise with annotated PYQ themes.",
  alternates: { canonical: "/pyq" },
};

const papers2026 = ["GS-1","GS-2","GS-3","GS-4"].map((paper,index)=>({
  year:2026,
  paper,
  paperTitle:`General Studies Paper ${["I","II","III","IV"][index]}`,
  pattern:"GS-I to GS-IV pattern",
  url:UPSC_PAPER_SOURCE,
  direct:false,
  official:true,
  sourceName:"UPSC previous-question-paper page",
}));
const latestMainsPapers=[...papers2026,...MAINS_GENERAL_STUDIES_LIBRARY.filter(item=>item.year>=2012)];

export default function PyqPage() {
  return <main className="pyq-page-theme min-h-screen px-6 py-14 text-white"><div className="mx-auto max-w-5xl">
    <p className="font-bold uppercase tracking-[0.24em] text-amber-300">Question-led revision</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">UPSC Mains PYQ explorer</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">Open the latest 15 examination years of General Studies papers, then use the smaller annotated theme bank for answer-writing practice. The 2026 entries point to UPSC's official previous-question-paper page rather than guessing PDF filenames.</p>
    <div className="mt-10"><MainsPaperNavigator papers={latestMainsPapers}/></div>
    <div className="mt-12"><p className="font-bold uppercase tracking-[0.18em] text-amber-300">Annotated study aid</p><h2 className="mt-2 text-3xl font-black">Paraphrased theme sampler</h2><p className="mt-3 max-w-3xl leading-7 text-slate-400">These are concise revision themes and answer frameworks, not an exhaustive or verbatim question bank. Use the paper navigator above for official paper access.</p></div><div className="mt-6"><PyqExplorer items={PYQ_ITEMS}/></div>
    <section className="mt-12 rounded-3xl border border-cyan-500/25 bg-cyan-500/5 p-7 sm:p-9"><p className="font-bold uppercase tracking-[0.18em] text-cyan-300">Original papers</p><h2 className="mt-3 text-3xl font-black">Open the verified Prelims & Mains library</h2><p className="mt-3 max-w-3xl leading-7 text-slate-300">Direct UPSC PDFs, official archive entries and older trusted indexes are kept visibly separate so a mirror is never mistaken for an official host.</p><Link href="/question-papers" className="mt-6 inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-black text-slate-950">Open paper library →</Link></section>
  </div></main>;
}
