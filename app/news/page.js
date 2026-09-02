export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { loadNewsArticles } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveCardImage } from "@/lib/news/categoryImage";
import { rankNewsByPriority } from "@/lib/news/headlinePriority";
import { cleanPublicExcerpt, normalizedPublicCategory, repairedNewsTitle } from "@/lib/publicArticleRepair";
import { SITE_URL } from "@/lib/siteUrl";

export async function generateMetadata({ searchParams }) {
  const p = await searchParams;
  const page = Math.max(1, Number(p?.page) || 1);
  const canonical = page <= 1 ? `${SITE_URL}/news` : `${SITE_URL}/news/page/${page}`;
  const title = page <= 1 ? "Latest News Today — India, World, Science & Analysis" : `Latest News Archive - Page ${page}`;
  const description = "CurrentPulse Newsroom: administrator-published news with concise context, dates and categories.";
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website" } };
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}
function pageHref(page) { return page <= 1 ? "/news" : `/news/page/${page}`; }
function storyDek(article, title, limit = 190) { return cleanPublicExcerpt(article?.why_news || article?.seo_description || "", title, limit); }

export default async function NewsPage({ searchParams }) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params?.page) || 1);
  const pageSize = 48;
  const { articles, total, hasMore, error } = await loadNewsArticles({ limit: pageSize, offset: (currentPage - 1) * pageSize });
  if (error) console.error("News stream error:", error);
  const totalPages = Number.isFinite(total) ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const stories = currentPage === 1 ? rankNewsByPriority(articles) : articles;

  return <main className="min-h-screen bg-[#171713] text-[#f4f0e8]">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 border-y border-[#8d7765]/45 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#f09a7c]">CurrentPulse · Newsroom · {formatDate(new Date())}</p>
            <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">CurrentPulse News</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#bcb7ae]">India · States · World · concise reporting with article-specific visuals</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link className="text-[#6fe7ee] hover:underline" href="/current-affairs">Current Affairs</Link>
            <Link className="text-[#6fe7ee] hover:underline" href="/categories">Topics</Link>
            <strong className="rounded-full border border-[#f09a7c]/45 px-3 py-1 text-[#f09a7c]">{total ?? stories.length} stories</strong>
          </div>
        </div>
      </header>

      {stories.length ? <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {stories.map((article, index) => {
          const title = repairedNewsTitle(article);
          const category = normalizedPublicCategory(article.category, `${title} ${article.why_news || ""}`);
          const image = resolveCardImage({ ...article, title, category });
          const href = `/news/${article.slug}`;
          return <article key={article.id} className={`overflow-hidden rounded-xl border border-white/10 bg-[#211f1a] shadow-sm ${index === 0 ? "md:col-span-2 xl:col-span-2" : ""}`}>
            <Link href={href} className={`block overflow-hidden bg-[#101827] ${index === 0 ? "aspect-[16/7]" : "aspect-[16/9]"}`}>
              <img src={image} alt={title} loading={index < 3 ? "eager" : "lazy"} className="h-full w-full object-cover" />
            </Link>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.12em]">
                <Link href={`/category/${createCategorySlug(category)}`} className="text-[#f09a7c] hover:underline">{category || "News"}</Link>
                <time className="text-[#8e8a82]">{formatDate(article.created_at)}</time>
              </div>
              <Link href={href}><h2 className={`font-serif font-bold leading-tight text-[#f8f5ee] ${index === 0 ? "text-3xl sm:text-4xl" : "text-xl"}`}>{title}</h2></Link>
              <p className="mt-3 text-sm leading-6 text-[#c7c2b8]">{storyDek(article, title, index === 0 ? 280 : 180) || "Open the story for verified details and context."}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                <span className="text-[#8e8a82]">CurrentPulse Newsroom</span>
                <Link href={href} className="font-bold text-[#6fe7ee]">Read full story →</Link>
              </div>
            </div>
          </article>;
        })}
      </section> : <div className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-xl font-bold">No stories on this page</h2><p className="mt-2 text-[#aaa59c]">Published News stories will appear here.</p></div>}

      {(currentPage > 1 || hasMore) && <nav className="mt-10 flex items-center justify-between border-t border-white/10 pt-6 text-sm">
        {currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="text-[#6fe7ee]">← Newer</Link> : <span />}
        <strong>Page {currentPage}{totalPages ? ` / ${totalPages}` : ""}</strong>
        {hasMore ? <Link href={pageHref(currentPage + 1)} className="text-[#6fe7ee]">Older →</Link> : <span />}
      </nav>}
    </div>
  </main>;
}
