import Link from "next/link";
import {
  coachingSourceLabel,
  loadArticleStreams,
} from "@/lib/articleStreams";
import { resolveDisplayImage } from "@/lib/news/categoryImage";

export const revalidate = 0;

type ArticleSource = {
  source_kind?: string | null;
  source_name?: string | null;
};

type StreamArticle = {
  id: number | string;
  title?: string | null;
  slug: string;
  category?: string | null;
  paper?: string | null;
  why_news?: string | null;
  image?: string | null;
  image_url?: string | null;
  image_source_url?: string | null;
  created_at?: string | null;
  article_sources?: ArticleSource[];
};

function stripHtml(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(date?: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ArticleCard({
  item,
  stream,
}: {
  item: StreamArticle;
  stream: "current-affairs" | "news";
}) {
  const isCurrentAffairs = stream === "current-affairs";
  const accentText = isCurrentAffairs ? "text-cyan-300" : "text-amber-300";
  const accentBorder = isCurrentAffairs
    ? "hover:border-cyan-400/60 hover:shadow-cyan-950/25"
    : "hover:border-amber-400/60 hover:shadow-amber-950/20";
  const titleHover = isCurrentAffairs
    ? "group-hover:text-cyan-300"
    : "group-hover:text-amber-300";
  const streamLabel = isCurrentAffairs ? coachingSourceLabel(item) : "CurrentPulse Newsroom";
  const articlePath = `/${stream}/${item.slug}`;
  const image = resolveDisplayImage(item);

  return (
    <article
      className={`group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/85 shadow-xl shadow-slate-950/20 transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${accentBorder}`}
    >
      <Link
        href={articlePath}
        className="block overflow-hidden"
      >
        <div className="relative">
          {image ? (
            <img src={image} alt={item.title || (isCurrentAffairs ? "UPSC current affairs article" : "News article")} className="h-52 w-full object-cover transition duration-700 group-hover:scale-[1.04]" loading="lazy" decoding="async" />
          ) : (
            <div className={`h-36 ${isCurrentAffairs ? "bg-gradient-to-br from-slate-900 to-cyan-950" : "bg-gradient-to-br from-stone-900 to-red-950"}`} />
          )}
          <span
            className={`absolute left-4 top-4 rounded-full border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs font-black uppercase tracking-wide backdrop-blur ${accentText}`}
          >
            {isCurrentAffairs ? "Coaching CA" : "News"}
          </span>
        </div>
      </Link>

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className={`rounded-full bg-white/5 px-3 py-1.5 ${accentText}`}>
            {item.category || "General Studies"}
          </span>
          <span className="rounded-full bg-blue-400/10 px-3 py-1.5 text-blue-300">
            {isCurrentAffairs ? (item.paper || "UPSC") : "News"}
          </span>
        </div>

        <Link href={articlePath}>
          <h3 className={`mt-4 line-clamp-3 text-xl font-black leading-snug text-white transition ${titleHover}`}>
            {item.title}
          </h3>
        </Link>

        <p className="mt-3 line-clamp-3 leading-7 text-slate-400">
          {stripHtml(item.why_news) ||
            (isCurrentAffairs
              ? "Read the coaching-synthesised UPSC analysis."
              : "Read the concise source-backed news story.")}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <div>
            <p className={`max-w-[12rem] truncate text-xs font-bold ${accentText}`}>
              {streamLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(item.created_at)}
            </p>
          </div>

          <Link
            href={articlePath}
            className={`shrink-0 text-sm font-black ${accentText}`}
          >
            Read →
          </Link>
        </div>
      </div>
    </article>
  );
}

function StreamSection({
  eyebrow,
  title,
  description,
  articles,
  stream,
  href,
}: {
  eyebrow: string;
  title: string;
  description: string;
  articles: StreamArticle[];
  stream: "current-affairs" | "news";
  href: string;
}) {
  const isCurrentAffairs = stream === "current-affairs";
  const accentText = isCurrentAffairs ? "text-cyan-400" : "text-amber-400";
  const buttonStyle = isCurrentAffairs
    ? "border-cyan-400/50 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950"
    : "border-amber-400/50 text-amber-300 hover:bg-amber-400 hover:text-slate-950";

  return (
    <section className={isCurrentAffairs ? "bg-slate-900 py-20" : "bg-slate-950 py-20"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className={`font-black uppercase tracking-[.2em] ${accentText}`}>
              {eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              {title}
            </h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
              {description}
            </p>
          </div>

          <Link
            href={href}
            className={`w-fit rounded-xl border px-5 py-3 font-black transition ${buttonStyle}`}
          >
            View all →
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} item={article} stream={stream} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center">
            <h3 className="text-2xl font-black text-white">
              {isCurrentAffairs
                ? "Coaching current affairs are being prepared"
                : "No new AI news analysis yet"}
            </h3>
            <p className="mt-3 text-slate-400">
              This section updates automatically after its publishing pipeline completes.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function LatestNews() {
  const { currentAffairs, news, error } = await loadArticleStreams(320);

  if (error) {
    return (
      <section className="bg-slate-950 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6 text-red-300">
            Unable to separate article streams: {error.message}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <StreamSection
        eyebrow="Coaching-synthesised"
        title="UPSC Current Affairs"
        description="Exam-focused briefs sourced from trusted coaching coverage, merged across publishers and enriched with static concepts, Prelims facts and Mains dimensions."
        articles={currentAffairs.slice(0, 6) as StreamArticle[]}
        stream="current-affairs"
        href="/current-affairs"
      />

      <StreamSection
        eyebrow="CurrentPulse newsroom"
        title="Latest News"
        description="Concise source-backed India and world news for everyone — separate from the UPSC Current Affairs format."
        articles={news.slice(0, 6) as StreamArticle[]}
        stream="news"
        href="/news"
      />
    </>
  );
}
