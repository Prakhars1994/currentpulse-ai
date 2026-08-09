import OfficialPapers from "@/components/OfficialPapers";
import { OFFICIAL_UPSC_PAPERS } from "@/lib/upsc/questionPapers";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "12 Years UPSC Previous Question Papers (2015–2026)",
  description: "Browse 12 years of official UPSC Civil Services Prelims and Mains papers, organised separately by stage and year.",
  alternates: { canonical: `${SITE_URL}/question-papers` },
};

export default function QuestionPapersPage() {
  return (
    <main className="paper-library-page min-h-screen px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <header className="paper-library-hero">
          <p>Official UPSC archive</p>
          <h1>12 Years of Prelims & Mains Papers</h1>
          <span>2015 → 2026</span>
          <p className="paper-library-description">A clean academic library for original Civil Services question papers. Prelims and Mains stay separate so you can revise year-wise without mixing stages.</p>
        </header>
        <div className="mt-10"><OfficialPapers papers={OFFICIAL_UPSC_PAPERS} /></div>
      </div>
    </main>
  );
}
