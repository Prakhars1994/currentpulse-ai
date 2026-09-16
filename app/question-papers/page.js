import OfficialPapers from "@/components/OfficialPapers";
import { OFFICIAL_UPSC_PAPERS } from "@/lib/upsc/questionPapers";
import { SITE_URL } from "@/lib/siteUrl";

const title = "UPSC Previous Year Question Papers (PYQ) 2011–2026 | Prelims & Mains";
const description = "Browse UPSC Civil Services previous year question papers (PYQs): Prelims 2011–2026 and verified Mains papers through 2025, with official UPSC PDFs and clearly labelled archive links.";
const canonical = `${SITE_URL}/question-papers`;

export const metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function QuestionPapersPage() {
  return (
    <main className="paper-library-page min-h-screen px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <header className="paper-library-hero">
          <p>Verified UPSC paper library</p>
          <h1>UPSC Previous Year Question Papers (PYQ)</h1>
          <span>Prelims 2011–2026 · verified Mains papers through 2025</span>
          <p className="paper-library-description">Revise Civil Services Prelims and Mains with a clean year-wise PYQ library. Direct UPSC PDFs, official UPSC archive entries and trusted legacy indexes are labelled separately so students can distinguish original papers from index links.</p>
        </header>
        <div className="mt-10"><OfficialPapers papers={OFFICIAL_UPSC_PAPERS} /></div>
      </div>
    </main>
  );
}
