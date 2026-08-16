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

export default async function Home() {
  // A single cached canonical snapshot now powers the ticker, hero counters and
  // both article sections. This keeps the homepage internally consistent while
  // avoiding duplicate Supabase scans for high traffic.
  const { streams, stats } = await loadHomepageSnapshot(24);
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
