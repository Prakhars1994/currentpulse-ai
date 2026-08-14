export const dynamic = "force-dynamic";
export const revalidate = 0;

import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import ResultPulsePreview from "@/components/ResultPulsePreview";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";
import { loadArticleStreams } from "@/lib/articleStreams";
import { loadHomepageStats } from "@/lib/siteStats";

export const metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  // One shared stream query prevents the homepage from scanning the article
  // archive separately for the ticker and both content sections.
  const [streams, stats] = await Promise.all([
    loadArticleStreams(12),
    loadHomepageStats(),
  ]);
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
