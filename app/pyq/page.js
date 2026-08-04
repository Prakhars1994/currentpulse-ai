import PyqExplorer from "@/components/PyqExplorer";
import { PYQ_ITEMS } from "@/lib/study/pyqs";
import Link from "next/link";

export const metadata = {
  title: "UPSC PYQ Explorer",
  description: "Filter previous-year question themes and build structured UPSC mains answers.",
  alternates: { canonical: "/pyq" },
};

export default function PyqPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">Question-led revision</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">UPSC PYQ explorer</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
          Filter paraphrased PYQ themes by year and paper, then expand a concise
          answer framework. Use the official paper link for exact question wording.
        </p>
        <div className="mt-10">
          <PyqExplorer items={PYQ_ITEMS} />
        </div>
        <section className="mt-12 rounded-3xl border border-cyan-500/25 bg-cyan-500/5 p-7 sm:p-9">
          <p className="font-bold uppercase tracking-[0.18em] text-cyan-300">Original papers</p>
          <h2 className="mt-3 text-3xl font-black">Download official UPSC Prelims & Mains PDFs</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">Use the exact, unmodified question papers hosted on upsc.gov.in, organised by year and examination stage.</p>
          <Link href="/question-papers" className="mt-6 inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-black text-slate-950">Open official paper library →</Link>
        </section>
      </div>
    </main>
  );
}
