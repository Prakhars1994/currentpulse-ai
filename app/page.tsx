export const dynamic = "force-dynamic";
export const revalidate = 0;

import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";
import { loadArticleStreams } from "@/lib/articleStreams";

export const metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  // One shared stream query prevents the homepage from scanning the article
  // archive separately for the ticker and both content sections.
  const streams = await loadArticleStreams(320);
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <BreakingNews newsStream={streams.news} error={streams.error} />
      <Hero />
      <Features />
      <Categories />
      <LatestNews streams={streams} />
    </main>
  );
}
