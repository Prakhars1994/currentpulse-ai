export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { currentAffairsSourceLabel, loadCurrentAffairsArticles } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { SITE_URL } from "@/lib/siteUrl";
import { EXAM_VERTICALS, getExamVertical } from "@/lib/examPrep/sourceRegistry";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page) || 1);
  const todayOnly = params?.view === "today";
  const hi = params?.lang === "hi";
  const exam = getExamVertical(params?.exam || "upsc");
  const query = new URLSearchParams();
  if (exam.slug !== "upsc") query.set("exam", exam.slug);
  if (page > 1) query.set("page", String(page));
  if (hi) query.set("lang", "hi");
  const canonical = `${SITE_URL}/current-affairs${query.toString() ? `?${query.toString()}` : ""}`;
  const baseTitle = hi ? exam.hiTitle : exam.title;
  const title = page <= 1 ? baseTitle : `${baseTitle} - Page ${page}`;
  const description = hi ? exam.hiDescription : exam.description;
  return { title, description, alternates: { canonical }, robots: todayOnly ? { index: false, follow: true } : { index: true, follow: true }, openGraph: { title, description, url: canonical, type: "website" } };
}

function stripHtml(content = "") {
  return String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCaExcerpt(content = "", title = "") {
  let text = stripHtml(content)
    .replace(/\[\[CA_(?:START|END)\]\]/gi, " ")
    .replace(/\bCA_TITLE:\s*.*?(?=\bCA_CATEGORY:|\bCA_GS:|\bCA_DATE:|\bCA_IMAGE:|\bWhy\s+in\s+News\b|$)/gi, " ")
    .replace(/\bCA_CATEGORY:\s*.*?(?=\bCA_GS:|\bCA_DATE:|\bCA_IMAGE:|\bWhy\s+in\s+News\b|$)/gi, " ")
    .replace(/\bCA_GS:\s*.*?(?=\bCA_DATE:|\bCA_IMAGE:|\bWhy\s+in\s+News\b|$)/gi, " ")
    .replace(/\bCA_DATE:\s*.*?(?=\bCA_IMAGE:|\bWhy\s+in\s+News\b|$)/gi, " ")
    .replace(/\bCA_IMAGE:\s*(?:YES|NO|https?:\/\/\S+)/gi, " ")
    .replace(/^\s*Why\s+in\s+News\??\s*[:\-–—]?\s*/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (title && text.toLowerCase().startsWith(title.toLowerCase())) {
    text = text.slice(title.length).replace(/^\s*[:\-–—]?\s*/, "").trim();
  }
  return text;
}

function pageHref(page, todayOnly, exam = "upsc", hi = false) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (todayOnly) p.set("view", "today");
  if (exam !== "upsc") p.set("exam", exam);
  if (hi) p.set("lang", "hi");
  return p.toString() ? `/current-affairs?${p}` : "/current-affairs";
}

function dateLabel(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default async function CurrentAffairsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number(params?.page) || 1);
  const todayOnly = params?.view === "today";
  const hi = params?.lang === "hi";
  const exam = getExamVertical(params?.exam || "upsc");
  const pageSize = 24;
  const offset = (requestedPage - 1) * pageSize;
  const { articles, total, hasMore, date, error } = await loadCurrentAffairsArticles({ limit: pageSize, offset, todayOnly, exam: exam.slug, language: hi ? "hi" : "en" });
  if (error) console.error("Current affairs error:", error);

  const totalPages = Number.isFinite(total) ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const articleSuffix = hi ? "?lang=hi" : "";
  const lead = articles?.[0];
  const rest = articles?.slice(1) || [];
  const leadImage = lead ? resolveDisplayImage(lead) : "";

  return <main className="ca-edition min-h-screen">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="ca-edition-head">
        <div><p className="ca-edition-kicker">CURRENT PULSE · EXAM INTELLIGENCE</p><h1>{hi ? exam.hiTitle : exam.title}</h1><p className="ca-edition-deck">{hi ? exam.hiDescription : exam.description}</p></div>
        <div className="ca-edition-stamp"><strong>{date}</strong><span>{Number.isFinite(total) ? total : "CURATED"} BRIEFS</span></div>
      </header>

      <div className="ca-exam-strip">{Object.values(EXAM_VERTICALS).map(item => <Link key={item.slug} href={pageHref(1, false, item.slug, hi)} className={exam.slug === item.slug ? "is-active" : ""}>{item.label}</Link>)}</div>
      <div className="ca-toolbar"><div><Link href={pageHref(1, false, exam.slug, hi)} className={!todayOnly ? "is-active" : ""}>Archive</Link><Link href={pageHref(1, true, exam.slug, hi)} className={todayOnly ? "is-active" : ""}>Today</Link><Link href={hi ? "/categories?lang=hi" : "/categories"}>Syllabus Index</Link></div><span>Page {requestedPage}{totalPages ? ` / ${totalPages}` : ""}</span></div>

      {lead ? <>
        <section className="ca-lead-story" style={!leadImage ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          <div className="ca-lead-copy">
            <div className="ca-story-meta"><span>{lead.category || "Current Affairs"}</span><b>{lead.paper || "General Studies"}</b><time>{dateLabel(lead.created_at)}</time></div>
            <Link href={`/current-affairs/${lead.slug}${articleSuffix}`}><h2 style={{ maxWidth: leadImage ? "19ch" : "27ch", fontSize: "clamp(2rem,3.25vw,3.2rem)", lineHeight: 1.04 }}>{lead.title}</h2></Link>
            <p style={{ maxWidth: leadImage ? "70ch" : "88ch" }}>{cleanCaExcerpt(lead.why_news || lead.content, lead.title).slice(0, 620) || "Open the brief for complete exam-oriented analysis."}</p>
            <div className="ca-lead-footer"><small>{currentAffairsSourceLabel(lead)}</small><Link href={`/current-affairs/${lead.slug}${articleSuffix}`}>Study this brief →</Link></div>
          </div>
          {leadImage && <Link className="ca-lead-image" href={`/current-affairs/${lead.slug}${articleSuffix}`}><img src={leadImage} alt={lead.title} /></Link>}
        </section>
        <div className="ca-section-rule"><span>MORE CURRENT AFFAIRS</span></div>
        <section className="ca-editorial-grid">{rest.map((article, index) => {
          const image = resolveDisplayImage(article);
          const href = `/current-affairs/${article.slug}${articleSuffix}`;
          return <article key={article.id} className={`ca-editorial-card ${index < 2 ? "ca-editorial-card--wide" : ""}`}>
            {image && <Link href={href} className="ca-editorial-image"><img src={image} alt={article.title} loading="lazy" /></Link>}
            <div className="ca-editorial-body"><div className="ca-story-meta"><Link href={`/category/${createCategorySlug(article.category)}${articleSuffix}`}>{article.category || "Current Affairs"}</Link><b>{article.paper || "GS"}</b><time>{dateLabel(article.created_at)}</time></div><Link href={href}><h2>{article.title}</h2></Link><p>{cleanCaExcerpt(article.why_news || article.content, article.title).slice(0, 360) || "Read the complete current affairs analysis."}</p><div className="ca-card-foot"><small>{currentAffairsSourceLabel(article)}</small><Link href={href}>Open brief →</Link></div></div>
          </article>;
        })}</section>
      </> : <div className="ca-empty"><h2>No current affairs briefs found</h2><p>Published administrator briefs will appear here.</p></div>}

      {(requestedPage > 1 || hasMore) && <nav className="ca-pagination">{requestedPage > 1 && <Link href={pageHref(requestedPage - 1, todayOnly, exam.slug, hi)}>← Newer briefs</Link>}<strong>Page {requestedPage}{totalPages ? ` of ${totalPages}` : ""}</strong>{hasMore && <Link href={pageHref(requestedPage + 1, todayOnly, exam.slug, hi)}>Older briefs →</Link>}</nav>}
    </div>
  </main>;
}
