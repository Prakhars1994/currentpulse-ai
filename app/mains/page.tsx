import Link from "next/link";

export const metadata = {
  title: "UPSC Mains Hub - PYQs, Essay, GS Papers & Answer Writing",
  description: "CurrentPulse AI UPSC Mains hub for PYQs, Essay, GS1-GS4, answer writing tests and premium study books.",
};

const papers = [
  ["Mains PYQs", "/pyq", "Official previous-year questions organised for pattern analysis."],
  ["Essay", "/mains/essay", "Essay strategy, model essays and the 200-essay premium textbook."],
  ["Answer Writing Tests", "/mains/answer-writing", "Five paid UPSC, PCS and subjective test formats with member PDF submission."],
  ["GS Paper I", "/mains#gs1", "History, society, geography and Indian heritage."],
  ["GS Paper II", "/mains#gs2", "Polity, governance, social justice and international relations."],
  ["GS Paper III", "/mains#gs3", "Economy, environment, science-tech, security and disaster management."],
  ["GS Paper IV", "/mains#gs4", "Ethics, integrity, aptitude and case-study thinking."],
];

export default function MainsPage() {
  return <main className="min-h-screen bg-[#07111f] text-slate-100">
    <section className="border-b border-amber-300/20 bg-[radial-gradient(circle_at_top_right,_#183b5b_0,_#07111f_48%,_#030712_100%)]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:py-24">
        <div className="mb-5 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[.22em] text-amber-200">CurrentPulse Mains Studio</div>
        <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Think deeper. Write sharper. <span className="text-amber-300">Score in UPSC Mains.</span></h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">A focused Mains workspace built around PYQ intelligence, multidimensional answer writing, Essay, GS papers, evidence and revision-ready resources.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/pyq" className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950">Explore Mains PYQs</Link><Link href="/mains/answer-writing" className="rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">Take Answer Writing Test</Link><Link href="/mains/essay" className="rounded-xl border border-slate-500 px-5 py-3 font-bold">Open Essay Studio</Link></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-12">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{papers.map(([title,href,copy]) => <Link key={title} href={href} className="group rounded-2xl border border-slate-700 bg-slate-900/70 p-6 transition hover:-translate-y-1 hover:border-amber-300/70"><div className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-amber-300">UPSC MAINS</div><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 leading-7 text-slate-400">{copy}</p><div className="mt-5 font-bold text-amber-200">Enter section →</div></Link>)}</div>
    </section>
    <section className="mx-auto max-w-7xl px-5 pb-16"><div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 p-7 sm:p-10"><div className="text-sm font-bold uppercase tracking-[.2em] text-cyan-300">Mains Method</div><h2 className="mt-2 text-3xl font-black">PYQ → Demand → Dimensions → Evidence → Balanced conclusion</h2><p className="mt-4 max-w-4xl leading-7 text-slate-300">Use previous-year questions to understand examiner demand, build 150/250-word structures, add constitutional anchors, data and current examples, then finish with a realistic way forward.</p></div></section>
  </main>;
}
