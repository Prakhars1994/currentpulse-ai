import OfficialPapers from "@/components/OfficialPapers";
import { OFFICIAL_UPSC_PAPERS } from "@/lib/upsc/questionPapers";

export const metadata = {
  title: "Official UPSC Previous Question Papers",
  description: "Download original UPSC Civil Services Prelims and Mains question papers from upsc.gov.in.",
};

export default function QuestionPapersPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">Original UPSC PDFs</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Previous question papers</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
          Download Civil Services Prelims GS/CSAT and Mains Essay/General Studies papers directly from the official UPSC website. CurrentPulse does not alter these papers.
        </p>
        <div className="mt-10"><OfficialPapers papers={OFFICIAL_UPSC_PAPERS} /></div>
      </div>
    </main>
  );
}
