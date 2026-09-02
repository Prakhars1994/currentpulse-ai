export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabase } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import ArticleContent from "@/components/ArticleContent";
import EvidenceHighlights from "@/components/EvidenceHighlights";
import LicensedNewsArticle from "@/components/LicensedNewsArticle";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import { resolveDisplayImage, isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { SITE_URL, absoluteSiteUrl } from "@/lib/siteUrl";
import { isPublicNewsArticle } from "@/lib/articleStreams";
import { parseNewsPresentation } from "@/lib/news/newsPresentation";
import { normalizedPublicCategory, repairedNewsTitle } from "@/lib/publicArticleRepair";

function stripHtml(value = "") { return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function formatDate(value) { if (!value) return ""; return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }); }
function escapeRegExp(value = "") { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function cleanNewsSection(value = "", labels = []) { let text=String(value||"").trim();if(!text)return"";for(let pass=0;pass<3;pass+=1){let changed=false;for(const label of labels){const safe=escapeRegExp(label);const patterns=[new RegExp(`^#{1,6}\\s+${safe}\\s*:?[\\t ]*(?:\\r?\\n)+`,"i"),new RegExp(`^\\*\\*${safe}\\*\\*\\s*:?[\\t ]*(?:\\r?\\n)+`,"i"),new RegExp(`^${safe}\\s*:?[\\t ]*(?:\\r?\\n)+`,"i")];for(const pattern of patterns){const next=text.replace(pattern,"").trim();if(next!==text){text=next;changed=true;}}}if(!changed)break;}return text; }
function cleanManualNewsBody(value="",title=""){let text=String(value||"").replace(/\[\[NEWS_(?:START|END)\]\]/gi,"").replace(/^\s*NEWS_(?:TITLE|SCOPE|SECTION|DATE|STYLE|IMAGE)\s*:\s*.*$/gim,"").replace(/^\s*PART\s+\d+\s*\|\s*NEWS\s+\d+\s*[-–]\s*\d+.*$/gim,"").replace(/^\s*CURRENTPULSE\s+NEWS\s*$/gim,"").trim();if(title&&text.toLowerCase().startsWith(title.toLowerCase()))text=text.slice(title.length).replace(/^\s*[-:|–—]+\s*/,"").trim();return text;}

const NEWS_LOCATIONS=[
  ["BISHKEK","Bishkek, Kyrgyzstan",42.8746,74.5698],["KATHMANDU","Kathmandu, Nepal",27.7172,85.3240],["KYIV","Kyiv, Ukraine",50.4501,30.5234],["MOSCOW","Moscow, Russia",55.7558,37.6173],["PATNA","Patna, Bihar",25.5941,85.1376],["RANCHI","Ranchi, Jharkhand",23.3441,85.3096],["NEW DELHI","New Delhi",28.6139,77.2090],["DELHI","Delhi",28.7041,77.1025],["MUMBAI","Mumbai, Maharashtra",19.0760,72.8777],["MAHARASHTRA","Maharashtra",19.7515,75.7139],["BEIJING","Beijing, China",39.9042,116.4074],["WASHINGTON","Washington, D.C.",38.9072,-77.0369],["BRUSSELS","Brussels, Belgium",50.8503,4.3517]
];
function primaryNewsLocation(text=""){const upper=String(text||"").toUpperCase();for(const [token,label,lat,lon] of NEWS_LOCATIONS){if(upper.includes(token))return{label,lat,lon};}return null;}
function osmEmbed(location){if(!location)return"";const span=.9;const left=location.lon-span,right=location.lon+span,bottom=location.lat-span*.65,top=location.lat+span*.65;return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${location.lat}%2C${location.lon}`;}

const getArticle = unstable_cache(async (slug) => {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("articles")
    .select("*,article_sources(id,source_kind,source_name,source_title,source_url,source_published_at,source_key)")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  return data && isPublicNewsArticle(data) ? data : null;
}, ["currentpulse-news-detail-v4"], { revalidate: 60, tags: ["currentpulse-articles", "currentpulse-news"] });

export async function generateMetadata({ params }) {
  const { slug } = await params; const article = await getArticle(slug);
  if (!article) return { title: "News Not Found | CurrentPulse AI", robots: { index: false, follow: false } };
  const image=resolveDisplayImage(article);const newsPresentation=parseNewsPresentation(article.content);const title=newsPresentation?.title||repairedNewsTitle(article);const licensedConversation=Array.isArray(article.quality_flags)&&article.quality_flags.includes("licensed_republish_the_conversation");const originalConversationUrl=licensedConversation?article.article_sources?.find((source)=>source.source_kind==="news"&&source.source_name==="The Conversation")?.source_url:"";const description=stripHtml(newsPresentation?.lead||article.seo_description||article.why_news||article.content).slice(0,160);
  return { title, description, alternates:{canonical:licensedConversation&&originalConversationUrl?originalConversationUrl:`${SITE_URL}/news/${slug}`}, openGraph:{title,description,url:`${SITE_URL}/news/${slug}`,type:"article",publishedTime:article.created_at,modifiedTime:article.updated_at||article.created_at,...(image?{images:[{url:absoluteSiteUrl(image),width:1200,height:630}]}:{})}, twitter:{card:image?"summary_large_image":"summary",title,description,...(image?{images:[absoluteSiteUrl(image)]}:{})}, robots:licensedConversation?{index:false,follow:true}:{index:true,follow:true} };
}

export default async function NewsArticlePage({ params }) {
  const { slug }=await params;const article=await getArticle(slug);if(!article)notFound();const sources=article.article_sources||[];const newsSources=sources.filter((source)=>source.source_kind==="news");const hasCoachingSource=sources.some((source)=>source.source_kind==="coaching");if(!newsSources.length&&hasCoachingSource)permanentRedirect(`/current-affairs/${slug}`);
  const newsPresentation=parseNewsPresentation(article.content);const title=newsPresentation?.title||repairedNewsTitle(article);const newsLead=cleanNewsSection(newsPresentation?.lead||article.why_news,["What happened","Why in News","The development"]);const category=normalizedPublicCategory(article.category,`${title} ${newsLead||article.why_news||article.content||""}`);const newsFacts=cleanNewsSection(newsPresentation?.keyFacts||article.data_examples,["Key facts","At a glance","Data, Reports, Cases & Examples"]);const newsContext=cleanNewsSection(newsPresentation?.context||article.static_foundation,["Context","Background","Static Foundation"]);const newsWhyItMatters=cleanNewsSection(newsPresentation?.whyItMatters||article.india_relevance,["Why it matters","Significance","India relevance"]);const fullManualBody=!newsPresentation?cleanManualNewsBody(article.content||article.why_news,title):"";const mapLocation=primaryNewsLocation(`${fullManualBody} ${newsLead} ${newsContext} ${title}`);const image=resolveDisplayImage(article);const verifiedReusableImage=isVerifiedReusableArticleImage(article);const canonical=`${SITE_URL}/news/${slug}`;const licensedConversation=Array.isArray(article.quality_flags)&&article.quality_flags.includes("licensed_republish_the_conversation");if(licensedConversation)return <LicensedNewsArticle article={article} sources={sources}/>;
  const structuredData={"@context":"https://schema.org","@type":"NewsArticle",headline:title,description:stripHtml(newsLead||fullManualBody).slice(0,300),datePublished:article.created_at,dateModified:article.updated_at||article.created_at,mainEntityOfPage:canonical,...(image?{image:[absoluteSiteUrl(image)]}:{}),author:{"@type":"Organization",name:"CurrentPulse Newsroom",url:SITE_URL},publisher:{"@type":"Organization",name:"CurrentPulse AI",url:SITE_URL},citation:newsSources.map((source)=>source.source_url).filter(Boolean)};
  return <><ArticleViewTracker slug={slug}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/><main className="news-article-page min-h-screen"><article className="news-article-shell"><nav className="news-article-breadcrumb"><Link href="/">Home</Link> / <Link href="/news">News</Link> / <span>{category}</span></nav><p className="news-article-category">{category||"Latest News"}</p><h1>{title}</h1><div className="news-article-byline"><span>CurrentPulse Newsroom</span><time>Published {formatDate(article.created_at)}</time>{article.updated_at!==article.created_at&&<time>Updated {formatDate(article.updated_at)}</time>}</div>
  {image&&<figure className="news-article-figure news-article-figure--compact"><img src={image} alt={article.image_alt||title}/>{verifiedReusableImage&&article.image_caption&&<figcaption>{article.image_caption}</figcaption>}</figure>}
  {fullManualBody?<section className="news-article-section news-full-story"><ArticleContent content={fullManualBody}/></section>:<><section className="news-article-lead"><div className="news-section-kicker">The development</div><h2>What happened</h2><ArticleContent content={newsLead}/></section>{newsFacts&&<section className="news-article-section news-article-facts"><div className="news-section-kicker">At a glance</div><h2>Key facts</h2><EvidenceHighlights content={newsFacts} limit={5}/></section>}{newsContext&&<section className="news-article-section"><div className="news-section-kicker">Background</div><h2>Context</h2><ArticleContent content={newsContext}/></section>}{newsWhyItMatters&&<section className="news-article-section news-article-why"><div className="news-section-kicker">Significance</div><h2>Why it matters</h2><ArticleContent content={newsWhyItMatters}/></section>}</>}
  {mapLocation&&<aside className="news-location-map"><div><strong>Location in News</strong><span>{mapLocation.label}</span></div><iframe title={`Map of ${mapLocation.label}`} src={osmEmbed(mapLocation)} loading="lazy" referrerPolicy="no-referrer"/></aside>}
  {sources.length>0&&<section className="news-source-box"><h2>Sources</h2><ul>{sources.map((source)=><li key={source.id}><a href={source.source_url} target="_blank" rel="noopener noreferrer"><strong>{source.source_name}</strong>{source.source_title?` — ${source.source_title}`:""}</a></li>)}</ul></section>}
  <div className="news-article-footer"><Link href="/news">← Back to latest news</Link></div></article></main><style>{`.news-article-figure--compact{max-width:360px;margin:24px 0}.news-article-figure--compact img{width:100%;max-height:220px;object-fit:cover;border-radius:14px}.news-full-story{font-size:1.02rem;line-height:1.8}.news-location-map{margin:28px 0;max-width:360px;border:1px solid rgba(148,163,184,.22);border-radius:14px;overflow:hidden;background:rgba(15,23,42,.6)}.news-location-map>div{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;font-size:.8rem}.news-location-map>div span{color:#a5f3fc}.news-location-map iframe{display:block;width:100%;height:190px;border:0}`}</style></>;
}
