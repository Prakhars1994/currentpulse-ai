import OfficialPapers from "@/components/OfficialPapers";
import { OFFICIAL_UPSC_PAPERS } from "@/lib/upsc/questionPapers";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "UPSC Previous Papers — 12 Prelims & 15 Mains Years",
  description: "Browse verified official UPSC Civil Services papers with Prelims coverage from 2015–2026 and Mains coverage from 2011–2025.",
  alternates: { canonical: `${SITE_URL}/question-papers` },
};

export default function QuestionPapersPage() {
  return (
    <main className="paper-library-page min-h-screen px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <header className="paper-library-hero">
          <p>Official UPSC archive</p>
          <h1>Official Prelims & Mains Papers</h1>
          <span>Prelims 2015–2026 · Mains 2011–2025</span>
          <p className="paper-library-description">A clean academic library for original Civil Services question papers. Prelims and Mains stay separate so you can revise year-wise without mixing stages.</p>
        </header>
        <div className="mt-10"><OfficialPapers papers={OFFICIAL_UPSC_PAPERS} /></div>
      </div>
    </main>
  );
}
