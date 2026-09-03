export const revalidate = 60;

import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import ResultPulsePreview from "@/components/ResultPulsePreview";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";
import { loadHomepageSnapshot } from "@/lib/siteStats";
import { SITE_URL } from "@/lib/siteUrl";

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
  image_url?: string | null; image_source_url?: string | null; created_at?: string | null;
  updated_at?: string | null; article_sources?: HomepageArticleSource[];
};
type HomepageStreamError = { message?: string } | null;
type HomepageStreams = { currentAffairs: HomepageArticle[]; news: HomepageArticle[]; error: HomepageStreamError };

const EMPTY_STREAMS: HomepageStreams = { currentAffairs: [], news: [], error: null };
const EMPTY_STATS = {
  todayCurrentAffairs: 0, todayNews: 0, totalCurrentAffairs: 0, totalNews: 0,
  totalCurrentAffairsTruncated: false, totalNewsTruncated: false,
  lastUpdated: null, date: null, error: null,
};

export default async function Home() {
  let streams = EMPTY_STREAMS;
  let stats = EMPTY_STATS;
  try {
    const snapshot = await loadHomepageSnapshot(18);
    streams = snapshot?.streams || EMPTY_STREAMS;
    stats = snapshot?.stats || EMPTY_STATS;
  } catch (error: unknown) {
    console.error("[Homepage] snapshot unavailable:", error instanceof Error ? error.message : String(error));
  }

  const featured = [...streams.currentAffairs, ...streams.news]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <BreakingNews newsStream={streams.news} error={streams.error} />
      <Hero featured={featured} stats={stats} />
      <Features />
      <Categories />
      <LatestNews streams={streams} />
      <ResultPulsePreview />
    </main>
  );
}
