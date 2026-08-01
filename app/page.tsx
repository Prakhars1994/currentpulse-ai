export const dynamic = "force-dynamic";
export const revalidate = 0;

import Navbar from "@/components/Navbar";
import BreakingNews from "@/components/BreakingNews";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import LatestNews from "@/components/LatestNews";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <BreakingNews />
      <Hero />
      <Features />
      <Categories />
      <LatestNews />
    </main>
  );
}
