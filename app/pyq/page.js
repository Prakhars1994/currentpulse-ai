import PyqExplorer from "@/components/PyqExplorer";
import { PYQ_ITEMS } from "@/lib/study/pyqs";

export const metadata = {
  title: "UPSC PYQ Explorer",
  description: "Filter previous-year question themes and build structured UPSC mains answers.",
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
      </div>
    </main>
  );
}
