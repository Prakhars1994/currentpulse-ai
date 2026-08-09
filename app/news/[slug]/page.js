import { supabase } from "@/lib/supabase";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import ArticleContent from "@/components/ArticleContent";
import ArticleStudyVisuals from "@/components/ArticleStudyVisuals";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { SITE_URL, absoluteSiteUrl } from "@/lib/siteUrl";

function stripHtml(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

async function getArticle(slug) {
  const { data } = await supabase.from("articles").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data || null;
}

async function getSources(articleId) {
  const { data, error } = await supabase.from("article_sources")
    .select("id,source_kind,source_name,source_title,source_url,source_published_at")
    .eq("article_id", articleId).order("created_at", { ascending: true });
  if (error && error.code !== "42P01") console.error("News source fetch failed:", error.message);
  return data || [];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "News Not Found | CurrentPulse AI", robots: { index: false, follow: false } };
  const image = resolveDisplayImage(article);
  const description = stripHtml(article.seo_description || article.why_news).slice(0, 160);
  return {
    title: article.seo_title || article.title,
    description,
    alternates: { canonical: `${SITE_URL}/news/${slug}` },
    openGraph: {
      title: article.title, description, url: `${SITE_URL}/news/${slug}`, type: "article",
      publishedTime: article.created_at, modifiedTime: article.updated_at || article.created_at,
      ...(image ? { images: [{ url: absoluteSiteUrl(image), width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: article.title, description, ...(image ? { images: [absoluteSiteUrl(image)] } : {}) },
    robots: { index: true, follow: true },
  };
}

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const sources = await getSources(article.id);
  if (sources.some((source) => source.source_kind === "coaching")) permanentRedirect(`/current-affairs/${slug}`);

  const image = resolveDisplayImage(article);
  const canonical = `${SITE_URL}/news/${slug}`;
  const structuredData = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: article.title,
    description: stripHtml(article.why_news), datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at, mainEntityOfPage: canonical,
    ...(image ? { image: [absoluteSiteUrl(image)] } : {}),
    author: { "@type": "Organization", name: "CurrentPulse Newsroom", url: SITE_URL },
    publisher: { "@type": "Organization", name: "CurrentPulse AI", url: SITE_URL },
    citation: sources.map((source) => source.source_url).filter(Boolean),
  };

  return (
    <>
      <ArticleViewTracker slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="news-article-page min-h-screen">
        <article className="news-article-shell">
          <nav className="news-article-breadcrumb"><Link href="/">Home</Link> / <Link href="/news">News</Link> / <span>{article.category}</span></nav>
          <p className="news-article-category">{article.category || "Latest News"}</p>
          <h1>{article.title}</h1>
          <div className="news-article-byline"><span>CurrentPulse Newsroom</span><time>Published {formatDate(article.created_at)}</time>{article.updated_at !== article.created_at && <time>Updated {formatDate(article.updated_at)}</time>}</div>

          {image && <figure className="news-article-figure"><img src={image} alt={article.image_alt || article.title} />{article.image_caption && <figcaption>{article.image_caption}</figcaption>}</figure>}

          <section className="news-article-lead"><h2>What happened</h2><ArticleContent content={article.why_news} /></section>
          {article.data_examples && <section className="news-article-section news-article-facts"><h2>Key facts</h2><ArticleContent content={article.data_examples} /></section>}
          {article.static_foundation && <section className="news-article-section"><h2>Context</h2><ArticleContent content={article.static_foundation} /></section>}
          {article.india_relevance && <section className="news-article-section news-article-why"><h2>Why it matters</h2><ArticleContent content={article.india_relevance} /></section>}
          <ArticleStudyVisuals mapLocations={article.map_locations} />

          {sources.length > 0 && <section className="news-source-box"><h2>Sources</h2><ul>{sources.map((source) => <li key={source.id}><a href={source.source_url} target="_blank" rel="noopener noreferrer"><strong>{source.source_name}</strong>{source.source_title ? ` — ${source.source_title}` : ""}</a></li>)}</ul></section>}

          <div className="news-article-footer"><Link href="/news">← Back to latest news</Link></div>
        </article>
      </main>
    </>
  );
}
