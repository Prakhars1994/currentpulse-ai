export const revalidate = 60;

import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import ResultPulsePreview from "@/components/ResultPulsePreview";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";
import Link from "next/link";
import { loadHomepageSnapshot } from "@/lib/siteStats";
import { SITE_URL } from "@/lib/siteUrl";
import { cleanPublicExcerpt, repairedCaTitle, repairedNewsTitle } from "@/lib/publicArticleRepair";

export const metadata = {
  title: "CurrentPulse AI - UPSC Current Affairs, PYQs, Quiz & News",
  description:
    "CurrentPulse AI provides administrator-published UPSC current affairs, Prelims facts, Mains analysis, PYQs, quizzes, revision PDFs and source-attributed news.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "CurrentPulse AI - UPSC Current Affairs, PYQs, Quiz & News",
    description:
      "UPSC current affairs, Prelims facts, Mains analysis, PYQs, quizzes and revision tools from CurrentPulse AI.",
    url: SITE_URL,
    type: "website",
  },
};

type HomepageArticleSource = { source_kind?: string | null; source_name?: string | null };
type HomepageArticle = {
  id: number | string; slug: string; title?: string | null; category?: string | null;
  paper?: string | null; why_news?: string | null; image?: string | null;
  image_url?: string | null; image_source_url?: string | null; published_at?: string | null; created_at?: string | null;
  updated_at?: string | null; article_sources?: HomepageArticleSource[];
};
type HomepageStreamError = { message?: string } | null;
type HomepageStreams = { currentAffairs: HomepageArticle[]; news: HomepageArticle[]; error: HomepageStreamError };

const EMPTY_STREAMS: HomepageStreams = { currentAffairs: [], news: [], error: null };

function cleanHomepageArticle(article: HomepageArticle, stream: "ca" | "news") {
  const title = stream === "ca" ? repairedCaTitle(article) : repairedNewsTitle(article);
  return {
    ...article,
    title,
    why_news: cleanPublicExcerpt(article.why_news || "", title, 520),
  };
}

export default async function Home() {
  let streams = EMPTY_STREAMS;
  try {
    const snapshot = await loadHomepageSnapshot(18);
    const raw = snapshot?.streams || EMPTY_STREAMS;
    streams = {
      currentAffairs: (raw.currentAffairs || []).map((item: HomepageArticle) => cleanHomepageArticle(item, "ca")),
      news: (raw.news || []).map((item: HomepageArticle) => cleanHomepageArticle(item, "news")),
      error: raw.error || null,
    };
  } catch (error: unknown) {
    console.error("[Homepage] snapshot unavailable:", error instanceof Error ? error.message : String(error));
  }

  const featured = [...streams.currentAffairs, ...streams.news]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <BreakingNews newsStream={streams.news} error={streams.error} />
      <Hero featured={featured} latestCurrentAffairs={streams.currentAffairs[0] || null} />
      <section className="border-y border-cyan-400/15 bg-slate-900/60 py-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-2">
          <Link href="/upsc-current-affairs-2026" className="group rounded-2xl border border-cyan-400/20 bg-slate-950 p-6 transition hover:border-cyan-300 hover:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Evergreen revision hub</p>
            <h2 className="mt-3 text-2xl font-black group-hover:text-cyan-200">UPSC Current Affairs 2026</h2>
            <p className="mt-3 leading-7 text-slate-300">Use a clear daily-to-subject revision route for Prelims facts, Mains context, PYQs and syllabus-linked study.</p>
            <span className="mt-5 inline-block font-bold text-cyan-300">Open UPSC Current Affairs hub →</span>
          </Link>
          <Link href="/upsc-prelims-current-affairs-2026" className="group rounded-2xl border border-violet-400/20 bg-slate-950 p-6 transition hover:border-violet-300 hover:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Prelims practice hub</p>
            <h2 className="mt-3 text-2xl font-black group-hover:text-violet-200">UPSC Prelims Current Affairs 2026</h2>
            <p className="mt-3 leading-7 text-slate-300">Turn current issues into recall: concepts, official sources, common traps, quizzes and previous-year questions.</p>
            <span className="mt-5 inline-block font-bold text-violet-300">Open Prelims revision hub →</span>
          </Link>
        </div>
      </section>
      <Features />
      <Categories />
      <LatestNews streams={streams} />
      <ResultPulsePreview />
    </main>
  );
}
