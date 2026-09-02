export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Fragment } from "react";
import { loadNewsArticles } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { rankNewsByPriority } from "@/lib/news/headlinePriority";
import { SITE_URL } from "@/lib/siteUrl";

export async function generateMetadata({ searchParams }) { const p=await searchParams; const page=Math.max(1,Number(p?.page)||1); const canonical=page<=1?`${SITE_URL}/news`:`${SITE_URL}/news/page/${page}`; const title=page<=1?"Latest News Today — India, World, Science & Analysis":`Latest News Archive - Page ${page}`; const description="CurrentPulse Newsroom: source-attributed India, states and world reporting with clear context and verified facts."; return {title,description,alternates:{canonical},openGraph:{title,description,url:canonical,type:"website"}}; }
function stripHtml(v=""){return String(v||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\*\*([^*]+)\*\*/g,"$1").replace(/__([^_]+)__/g,"$1").replace(/`([^`]+)`/g,"$1").replace(/(^|\s)[#>*_~-]+(?=\S)/g,"$1").replace(/\s+/g," ").trim();}
function formatDate(v){if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return"";return d.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric"});}
function pageHref(page){return page<=1?"/news":`/news/page/${page}`;}

export default async function NewsPage({searchParams}){
 const params=await searchParams; const currentPage=Math.max(1,Number(params?.page)||1); const pageSize=48; const {articles,total,hasMore,error}=await loadNewsArticles({limit:pageSize,offset:(currentPage-1)*pageSize}); if(error)console.error("News stream error:",error);
 const totalPages=Number.isFinite(total)?Math.max(1,Math.ceil(total/pageSize)):null; const ranked=currentPage===1?rankNewsByPriority(articles):articles; const lead=ranked[0]; const secondary=ranked.slice(1,5); const leadIds=new Set([lead?.id,...secondary.map(a=>a.id)].filter(Boolean)); const archive=articles.filter(a=>!leadIds.has(a.id));
 return <main className="newsroom-page min-h-screen"><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
   <header className="news-paper-head"><div className="news-paper-date">CURRENT PULSE · DIGITAL EDITION <span>{formatDate(new Date())}</span></div><div className="news-paper-brand"><span>THE</span><h1>CURRENTPULSE NEWS</h1><em>India · States · World</em></div><div className="news-paper-nav"><Link href="/current-affairs">Current Affairs</Link><Link href="/categories">Topics</Link><strong>{total??articles.length} STORIES</strong></div></header>
   {lead&&<section className="news-front-grid"><article className="news-front-lead">{resolveDisplayImage(lead)&&<Link href={`/news/${lead.slug}`} className="news-front-lead-image"><img src={resolveDisplayImage(lead)} alt={lead.title}/></Link>}<div className="news-front-label">TOP STORY · {lead.category||"NEWS"}</div><Link href={`/news/${lead.slug}`}><h2>{lead.title}</h2></Link><p>{stripHtml(lead.why_news).slice(0,360)||"Open the story for the latest verified details."}</p><div className="news-front-byline"><span>CurrentPulse Newsroom</span><time>{formatDate(lead.created_at)}</time><Link href={`/news/${lead.slug}`}>Continue reading →</Link></div></article>
     <aside className="news-front-rail">{secondary.map((a,i)=><article key={a.id}>{resolveDisplayImage(a)&&<Link href={`/news/${a.slug}`} className="news-rail-image"><img src={resolveDisplayImage(a)} alt={a.title}/></Link>}<div><small>{i===0?"BREAKING / LEAD":"TOP STORY"} · {a.category||"News"}</small><Link href={`/news/${a.slug}`}><h3>{a.title}</h3></Link><p>{stripHtml(a.why_news).slice(0,130)}</p><time>{formatDate(a.created_at)}</time></div></article>)}</aside>
   </section>}
   <div className="news-section-rule"><span>LATEST EDITION</span><p>Chronological archive · source-attributed reporting</p></div>
   {archive.length?<section className="news-paper-grid">{archive.map((article,index)=>{const image=resolveDisplayImage(article);const dateLabel=formatDate(article.created_at);const prev=index>0?formatDate(archive[index-1]?.created_at):"";return <Fragment key={article.id}>{(index===0||dateLabel!==prev)&&<div className="news-date-divider"><span>{dateLabel}</span></div>}<article className={`news-paper-card ${index%7===0?"news-paper-card--feature":""}`}>{image&&<Link href={`/news/${article.slug}`} className="news-paper-card-image"><img src={image} alt={article.title} loading="lazy"/></Link>}<div className="news-paper-card-copy"><div className="news-paper-meta"><Link href={`/category/${createCategorySlug(article.category)}`}>{article.category||"News"}</Link><time>{dateLabel}</time></div><Link href={`/news/${article.slug}`}><h2>{article.title}</h2></Link><p>{stripHtml(article.why_news).slice(0,220)||"Open the story for verified details and context."}</p><Link href={`/news/${article.slug}`} className="news-paper-read">Full story →</Link></div></article></Fragment>})}</section>:!lead&&<div className="newsroom-empty"><h2>No stories on this page</h2><p>Published News stories will appear here.</p></div>}
   {(currentPage>1||hasMore)&&<nav className="news-paper-pagination">{currentPage>1?<Link href={pageHref(currentPage-1)}>← Newer</Link>:<span/>}<strong>Page {currentPage}{totalPages?` / ${totalPages}`:""}</strong>{hasMore?<Link href={pageHref(currentPage+1)}>Older →</Link>:<span/>}</nav>}
 </div></main>;
}
