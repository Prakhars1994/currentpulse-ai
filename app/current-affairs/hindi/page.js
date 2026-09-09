export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { archivePage, hindiArchiveHref } from "@/lib/archiveSeo";
import { loadCurrentAffairsArticles } from "@/lib/articleStreams";
import { SITE_URL } from "@/lib/siteUrl";

export async function generateMetadata({ searchParams }) {
  const page = archivePage((await searchParams)?.page);
  if (!page) notFound();
  return {
    title: "हिंदी करेंट अफेयर्स" + (page > 1 ? " — Page " + page : ""),
    description: "प्रतियोगी परीक्षाओं की तैयारी के लिए हिंदी करेंट अफेयर्स, प्रमुख तथ्य और विषयवार लेख पढ़ें।",
    alternates: { canonical: SITE_URL + hindiArchiveHref(page) },
  };
}

export default async function HindiCurrentAffairsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const page = archivePage(params.page);
  if (!page) notFound();
  const { articles, hasMore, error } = await loadCurrentAffairsArticles({ limit: 24, offset: (page - 1) * 24, language: "hi" });
  if (error) console.error("Hindi current affairs error:", error);
  if (page > 1 && !articles.length && !error) notFound();
  const href = hindiArchiveHref;
  return <main className="min-h-screen bg-slate-950 py-10 text-white"><div className="mx-auto max-w-7xl px-4 sm:px-6"><header className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-8"><p className="font-black uppercase tracking-[.2em] text-cyan-300">Hindi Current Affairs</p><h1 className="mt-3 text-4xl font-black">हिंदी करेंट अफेयर्स</h1><p className="mt-3 text-slate-300">प्रतियोगी परीक्षाओं की तैयारी के लिए प्रमुख घटनाएँ, विषयवार लेख और उपयोगी तथ्य हिंदी में पढ़ें।</p><Link href="/current-affairs" className="mt-5 inline-block font-bold text-cyan-300">English Current Affairs →</Link></header><section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{articles.map((article) => <article key={article.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm font-bold text-cyan-300">{article.category || "Current Affairs"}</p><Link href={`/current-affairs/${article.slug}`}><h2 className="mt-3 text-xl font-black leading-snug">{article.title}</h2></Link><p className="mt-3 line-clamp-4 text-slate-400">{article.why_news}</p></article>)}</section>{!articles.length && <p className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-300">अभी कोई हिंदी Current Affairs PDF प्रकाशित नहीं है।</p>}{(page > 1 || hasMore) && <nav className="mt-8 flex gap-4"><>{page > 1 && <Link href={href(page - 1)}>← नए लेख</Link>}</>{hasMore && <Link href={href(page + 1)}>पुराने लेख →</Link>}</nav>}</div></main>;
}
