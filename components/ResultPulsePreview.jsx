import Link from "next/link";
import { loadExamUpdates } from "@/lib/exams/repository";
import { EXAM_TYPE_META } from "@/lib/exams/constants";
export default async function ResultPulsePreview() {
  const { updates } = await loadExamUpdates({ limit: 6 });
  return <section className="border-y border-violet-400/10 bg-slate-950 py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-black uppercase tracking-[.2em] text-violet-400">New · ResultPulse AI</p><h2 className="mt-2 text-4xl font-black text-white">Results, admit cards & exam alerts</h2><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-400">Official-source exam updates without storing candidate marks. Open the authority link when action is required.</p></div><Link href="/exams" className="w-fit rounded-xl bg-violet-400 px-5 py-3 font-black text-slate-950">Open ResultPulse →</Link></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3">{updates.length ? updates.map((item)=><Link key={item.id} href={`/exams/${item.slug}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-violet-400/50"><span className="text-xs font-black uppercase text-violet-300">{EXAM_TYPE_META[item.update_type]?.label || "Exam update"}</span><h3 className="mt-3 line-clamp-3 text-lg font-black leading-snug text-white">{item.title}</h3><p className="mt-3 text-xs font-bold text-slate-500">{item.source_name || item.agency}</p></Link>) : <div className="md:col-span-3 rounded-2xl border border-dashed border-slate-700 p-7 text-slate-400">ResultPulse is ready. Run the official-source collector after the database migration.</div>}</div>
  </div></section>;
}
