export const revalidate = 60;

import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import ResultPulsePreview from "@/components/ResultPulsePreview";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";
import { loadHomepageSnapshot } from "@/lib/siteStats";

export const metadata = {
  alternates: { canonical: "/" },
};

const EMPTY_STREAMS = {
  currentAffairs: [],
  news: [],
  error: null,
};

const EMPTY_STATS = {
  todayCurrentAffairs: 0,
  todayNews: 0,
  totalCurrentAffairs: 0,
  totalNews: 0,
  totalCurrentAffairsTruncated: false,
  totalNewsTruncated: false,
  lastUpdated: null,
  date: null,
  error: null,
};

export default async function Home() {
  let streams = EMPTY_STREAMS;
  let stats = EMPTY_STATS;

  /*
   * Public homepage must never become HTTP 500 just because a database,
   * relationship count or external dependency is temporarily unavailable.
   */
  try {
    const snapshot = await loadHomepageSnapshot(18);

    streams = snapshot?.streams || EMPTY_STREAMS;
    stats = snapshot?.stats || EMPTY_STATS;
  } catch (error) {
    console.error(
      "[Homepage] snapshot unavailable:",
      error?.message || error
    );
  }

  const featured =
    [...streams.currentAffairs, ...streams.news]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )[0] || null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <BreakingNews
        newsStream={streams.news}
        error={streams.error}
      />

      <Hero
        featured={featured}
        stats={stats}
      />

      <Features />

      <Categories />

      <LatestNews streams={streams} />

      <ResultPulsePreview />
    </main>
  );
}