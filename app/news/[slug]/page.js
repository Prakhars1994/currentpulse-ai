export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabase } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import ArticleContent from "@/components/ArticleContent";
import ArticleStudyVisuals from "@/components/ArticleStudyVisuals";
import EvidenceHighlights from "@/components/EvidenceHighlights";
import LicensedNewsArticle from "@/components/LicensedNewsArticle";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import { resolveDisplayImage, isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { SITE_URL, absoluteSiteUrl } from "@/lib/siteUrl";
import { isPublicNewsArticle } from "@/lib/articleStreams";
import { parseNewsPresentation } from "@/lib/news/newsPresentation";

function stripHtml(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanNewsSection(value = "", labels = []) {
  let text = String(value || "").trim();
  if (!text) return "";

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const label of labels) {
      const safe = escapeRegExp(label);
      const patterns = [
        new RegExp(`^#{1,6}\\s+${safe}\\s*:?[\\t ]*(?:\\r?\\n)+`, "i"),
        new RegExp(`^\\*\\*${safe}\\*\\*\\s*:?[\\t ]*(?:\\r?\\n)+`, "i"),
        new RegExp(`^${safe}\\s*:?[\\t ]*(?:\\r?\\n)+`, "i"),
      ];
      for (const pattern of patterns) {
        const next = text.replace(pattern, "").trim();
        if (next !== text) {
          text = next;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return text;
}

const getArticle = unstable_cache(
  async (slug) => {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("articles")
      .select("*,article_sources(id,source_kind,source_name,source_title,source_url,source_published_at)")
      .eq("slug", slug).eq("status", "published").maybeSingle();
    return data && isPublicNewsArticle(data) ? data : null;
  },
  ["currentpulse-news-detail-v2"],
  { revalidate: 120, tags: ["currentpulse-articles", "currentpulse-news"] }
);

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "News Not Found | CurrentPulse AI", robots: { index: false, follow: false } };
  const image = resolveDisplayImage(article);
  const newsPresentation = parseNewsPresentation(article.content);
  const licensedConversation =
    Array.isArray(article.quality_flags) &&
    article.quality_flags.includes("licensed_republish_the_conversation");
  const originalConversationUrl = licensedConversation
    ? article.article_sources?.find(
        (source) =>
          source.source_kind === "news" &&
          source.source_name === "The Conversation"
      )?.source_url
    : "";
  const description = stripHtml(newsPresentation?.lead || article.seo_description || article.why_news).slice(0, 160);
  return {
    title: newsPresentation?.title || article.seo_title || article.title,
    description,
    alternates: {
      canonical:
        licensedConversation && originalConversationUrl
          ? originalConversationUrl
          : `${SITE_URL}/news/${slug}`,
    },
    openGraph: {
      title: newsPresentation?.title || article.title, description, url: `${SITE_URL}/news/${slug}`, type: "article",
      publishedTime: article.created_at, modifiedTime: article.updated_at || article.created_at,
      ...(image ? { images: [{ url: absoluteSiteUrl(image), width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: newsPresentation?.title || article.title, description, ...(image ? { images: [absoluteSiteUrl(image)] } : {}) },
    robots: { index: true, follow: true },
  };
}

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const sources = article.article_sources || [];
  const newsSources = sources.filter((source) => source.source_kind === "news");
  const hasCoachingSource = sources.some((source) => source.source_kind === "coaching");
  if (!newsSources.length && hasCoachingSource) permanentRedirect(`/current-affairs/${slug}`);

  const newsPresentation = parseNewsPresentation(article.content);
  const newsLead = cleanNewsSection(newsPresentation?.lead || article.why_news, [
    "What happened", "Why in News", "The development"
  ]);
  const newsFacts = cleanNewsSection(newsPresentation?.keyFacts || article.data_examples, [
    "Key facts", "At a glance", "Data, Reports, Cases & Examples"
  ]);
  const newsContext = cleanNewsSection(newsPresentation?.context || article.static_foundation, [
    "Context", "Background", "Static Foundation"
  ]);
  const newsWhyItMatters = cleanNewsSection(newsPresentation?.whyItMatters || article.india_relevance, [
    "Why it matters", "Significance", "India relevance"
  ]);
  const hasCurrentAffairsView = hasCoachingSource;
  const image = resolveDisplayImage(article);
  const verifiedReusableImage = isVerifiedReusableArticleImage(article);
  const canonical = `${SITE_URL}/news/${slug}`;
  const licensedConversation =
    Array.isArray(article.quality_flags) &&
    article.quality_flags.includes("licensed_republish_the_conversation");

  if (licensedConversation) {
    return <LicensedNewsArticle article={article} sources={sources} />;
  }

  const structuredData = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: newsPresentation?.title || article.title,
    description: stripHtml(newsLead), datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at, mainEntityOfPage: canonical,
    ...(image ? { image: [absoluteSiteUrl(image)] } : {}),
    author: { "@type": "Organization", name: "CurrentPulse Newsroom", url: SITE_URL },
    publisher: { "@type": "Organization", name: "CurrentPulse AI", url: SITE_URL },
    citation: newsSources.map((source) => source.source_url).filter(Boolean),
  };

  return (
    <>
      <ArticleViewTracker slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="news-article-page min-h-screen">
        <article className="news-article-shell">
          <nav className="news-article-breadcrumb"><Link href="/">Home</Link> / <Link href="/news">News</Link> / <span>{article.category}</span></nav>
          <p className="news-article-category">{article.category || "Latest News"}</p>
          <h1>{newsPresentation?.title || article.title}</h1>
          <div className="news-article-byline"><span>CurrentPulse Newsroom</span><time>Published {formatDate(article.created_at)}</time>{article.updated_at !== article.created_at && <time>Updated {formatDate(article.updated_at)}</time>}</div>
          {hasCurrentAffairsView && (
            <div className="news-upsc-bridge">
              <span>Preparing for UPSC?</span>
              <Link href={`/current-affairs/${slug}`}>Open the Current Affairs analysis →</Link>
            </div>
          )}

          {image && <figure className="news-article-figure"><img src={image} alt={article.image_alt || newsPresentation?.title || article.title} />{verifiedReusableImage && article.image_caption && <figcaption>{article.image_caption}</figcaption>}</figure>}

          <section className="news-article-lead">
            <div className="news-section-kicker">The development</div>
            <h2>What happened</h2>
            <ArticleContent content={newsLead} />
          </section>

          <ArticleStudyVisuals
            mapLocations={article.map_locations}
            title={newsPresentation?.title || article.title}
            articleText={`${newsLead || ""} ${newsFacts || ""} ${newsContext || ""}`}
            category={article.category}
          />

          {newsFacts && (
            <section className="news-article-section news-article-facts">
              <div className="news-section-kicker">At a glance</div>
              <h2>Key facts</h2>
              <EvidenceHighlights content={newsFacts} limit={5} />
            </section>
          )}

          {newsContext && (
            <section className="news-article-section">
              <div className="news-section-kicker">Background</div>
              <h2>Context</h2>
              <ArticleContent content={newsContext} />
            </section>
          )}

          {newsWhyItMatters && (
            <section className="news-article-section news-article-why">
              <div className="news-section-kicker">Significance</div>
              <h2>Why it matters</h2>
              <ArticleContent content={newsWhyItMatters} />
            </section>
          )}

          {sources.length > 0 && <section className="news-source-box"><h2>Sources</h2><ul>{sources.map((source) => <li key={source.id}><a href={source.source_url} target="_blank" rel="noopener noreferrer"><strong>{source.source_name}</strong>{source.source_title ? ` — ${source.source_title}` : ""}</a></li>)}</ul></section>}

          <div className="news-article-footer"><Link href="/news">← Back to latest news</Link></div>
        </article>
      </main>
    </>
  );
}
