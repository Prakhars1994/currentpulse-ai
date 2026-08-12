export const revalidate = 120;
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadExamUpdateBySlug, loadRelatedExamUpdates } from "@/lib/exams/repository";
import { EXAM_TYPE_META } from "@/lib/exams/constants";
import ExamSubscriptionForm from "@/components/ExamSubscriptionForm";
import { SITE_URL } from "@/lib/siteUrl";

function formatDate(value) { if (!value) return ""; return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }); }
export async function generateMetadata({ params }) {
  const { slug } = await params; const { update } = await loadExamUpdateBySlug(slug);
  if (!update) return { title: "Exam Update Not Found | ResultPulse AI", robots: { index: false, follow: false } };
  const description = String(update.summary || `Official ${update.update_type} update from ${update.source_name || update.agency}.`).slice(0, 160);
  return { title: `${update.title} | ResultPulse AI`, description, alternates: { canonical: `${SITE_URL}/exams/${slug}` }, openGraph: { title: update.title, description, url: `${SITE_URL}/exams/${slug}`, type: "article" }, robots: { index: true, follow: true } };
}
export default async function ExamDetail({ params }) {
  const { slug } = await params; const { update } = await loadExamUpdateBySlug(slug); if (!update) notFound();
  const { updates: related } = await loadRelatedExamUpdates(update.exam_name, update.id, 8);
  const meta = EXAM_TYPE_META[update.update_type] || { label: "Exam Update", icon: "📢" };
  const structuredData = { "@context": "https://schema.org", "@type": "WebPage", name: update.title, description: update.summary || undefined, datePublished: update.source_published_at || update.created_at, dateModified: update.updated_at || update.created_at, mainEntityOfPage: `${SITE_URL}/exams/${slug}`, isBasedOn: update.official_url, publisher: { "@type": "Organization", name: "CurrentPulse AI", url: SITE_URL } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/><main className="min-h-screen bg-slate-950 py-10 text-white sm:py-14"><article className="mx-auto max-w-4xl px-4 sm:px-6">
    <nav className="text-sm font-bold text-slate-500"><Link href="/">Home</Link> / <Link href="/exams">Exams</Link> / {meta.label}</nav>
    <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-slate-900/85 p-7 shadow-2xl shadow-slate-950/30 sm:p-10"><span className="rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-black uppercase text-violet-300">{meta.icon} {meta.label}</span><h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{update.title}</h1><div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-400"><strong className="text-slate-200">{update.agency || update.source_name}</strong>{(update.source_published_at || update.created_at) && <span>Updated {formatDate(update.source_published_at || update.created_at)}</span>}</div>
      <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><h2 className="text-lg font-black text-violet-300">Current status</h2><p className="mt-2 leading-7 text-slate-300">{update.summary || "Official examination update detected from the authority website."}</p></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-800 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Exam / recruitment</p><p className="mt-2 font-black">{update.exam_name || update.title}</p></div><div className="rounded-2xl border border-slate-800 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Authority</p><p className="mt-2 font-black">{update.agency || update.source_name}</p></div></div>
      <a href={update.official_url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex rounded-xl bg-violet-400 px-6 py-3.5 font-black text-slate-950 hover:bg-violet-300">Open official source →</a>
      <p className="mt-4 text-xs leading-5 text-slate-500">ResultPulse links to the official authority for applications, admit cards, answer keys and results. Verify candidate-specific details only on the official site.</p>
    </div>
    {related.length > 0 && <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Exam timeline</p><h2 className="mt-2 text-2xl font-black">Other updates for {update.exam_name}</h2></div><Link href="/exams" className="text-sm font-black text-violet-300">All exams →</Link></div><div className="mt-5 grid gap-3">{related.map((item)=><Link key={item.id} href={`/exams/${item.slug}`} className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-violet-400/50 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs font-black uppercase text-violet-300">{EXAM_TYPE_META[item.update_type]?.label || "Update"}</span><p className="mt-1 font-bold text-slate-100">{item.title}</p></div><time className="shrink-0 text-xs font-bold text-slate-500">{formatDate(item.source_published_at || item.created_at)}</time></Link>)}</div></section>}
    <div className="mt-8"><ExamSubscriptionForm compact /></div>
  </article></main></>;
}
