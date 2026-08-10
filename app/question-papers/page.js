import OfficialPapers from "@/components/OfficialPapers";
import { OFFICIAL_UPSC_PAPERS } from "@/lib/upsc/questionPapers";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "UPSC Previous Papers — 16 Prelims & 15 Mains Years",
  description: "Browse verified UPSC Civil Services papers with Prelims coverage from 2011–2026 and Mains coverage from 2011–2025.",
  alternates: { canonical: `${SITE_URL}/question-papers` },
};

export default function QuestionPapersPage() {
  return (
    <main className="paper-library-page min-h-screen px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <header className="paper-library-hero">
          <p>Verified UPSC paper library</p>
          <h1>Prelims & Mains Papers</h1>
          <span>Prelims 2011–2026 · 15 Mains years (2011–2025)</span>
          <p className="paper-library-description">A clean academic library for Civil Services question papers. Direct UPSC PDFs, the official UPSC archive and any trusted legacy index are labelled separately.</p>
        </header>
        <div className="mt-10"><OfficialPapers papers={OFFICIAL_UPSC_PAPERS} /></div>
      </div>
    </main>
  );
}
