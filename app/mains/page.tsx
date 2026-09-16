import Link from "next/link";

export const metadata = {
  title: "UPSC Mains Hub - PYQs, Essay, GS Papers & Answer Writing",
  description: "CurrentPulse AI UPSC Mains hub for PYQs, Essay, GS1-GS4, answer writing tests and premium study books.",
  alternates: { canonical: "/mains" },
};

const papers = [
  ["Mains PYQs", "/pyq", "Verified General Studies papers for question-led pattern analysis."],
  ["Essay", "/mains/essay", "Essay strategy, model essays and the 200-essay premium textbook."],
  ["Answer Writing Tests", "/mains/answer-writing", "UPSC, PCS and subjective test formats with private member PDF submission."],
  ["GS Paper I", "#gs1", "History, society, geography and Indian heritage."],
  ["GS Paper II", "#gs2", "Polity, governance, social justice and international relations."],
  ["GS Paper III", "#gs3", "Economy, environment, science-tech, security and disaster management."],
  ["GS Paper IV", "#gs4", "Ethics, integrity, aptitude and case-study thinking."],
];

const gs = [
  {id:"gs1",paper:"GS Paper I",syllabus:"Indian Heritage & Culture • History • Geography • Society",method:"Build chronology and causation in history, spatial explanation in geography, and evidence-led social analysis.",examples:"Maps • timelines • census/NFHS-style social data • constitutional and cultural examples"},
  {id:"gs2",paper:"GS Paper II",syllabus:"Governance • Constitution • Polity • Social Justice • International Relations",method:"Start from the constitutional/institutional anchor, examine implementation and competing interests, then give a workable reform path.",examples:"Articles • judgments • committees • schemes • parliamentary/institutional data • India-centric IR examples"},
  {id:"gs3",paper:"GS Paper III",syllabus:"Economy • Agriculture • Science & Tech • Environment • Security • Disaster Management",method:"Connect concepts to measurable outcomes, implementation constraints, technology and risk; distinguish evidence from assumptions.",examples:"Economic indicators • official reports • diagrams • maps • case studies • disaster and security frameworks"},
  {id:"gs4",paper:"GS Paper IV",syllabus:"Ethics • Integrity • Aptitude • Public-service values • Case Studies",method:"Define the ethical conflict, identify stakeholders and values, compare options and justify a feasible, lawful and humane course of action.",examples:"Constitutional morality • civil-service values • thinkers • administrative examples • stakeholder matrices"},
];

export default function MainsPage() {
  return <main className="min-h-screen bg-[#07111f] text-slate-100">
    <section className="border-b border-amber-300/20 bg-[radial-gradient(circle_at_top_right,_#183b5b_0,_#07111f_48%,_#030712_100%)]"><div className="mx-auto max-w-7xl px-5 py-16 sm:py-24"><div className="mb-5 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[.22em] text-amber-200">CurrentPulse Mains Studio</div><h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Think deeper. Write sharper. <span className="text-amber-300">Prepare for UPSC Mains.</span></h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">A focused Mains workspace built around official-question-paper intelligence, multidimensional answer writing, Essay, GS papers, evidence and revision-ready resources.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/pyq" className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950">Explore Mains PYQs</Link><Link href="/mains/answer-writing" className="rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">Answer Writing</Link><Link href="/member/submit" className="rounded-xl border border-cyan-400/50 px-5 py-3 font-bold text-cyan-200">Submit Answer PDF</Link><Link href="/mains/essay" className="rounded-xl border border-slate-500 px-5 py-3 font-bold">Essay Studio</Link></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-12"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{papers.map(([title,href,copy]) => <Link key={title} href={href} className="group rounded-2xl border border-slate-700 bg-slate-900/70 p-6 transition hover:-translate-y-1 hover:border-amber-300/70"><div className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-amber-300">UPSC MAINS</div><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 leading-7 text-slate-400">{copy}</p><div className="mt-5 font-bold text-amber-200">Enter section →</div></Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 pb-12"><div className="mb-6"><div className="text-sm font-black uppercase tracking-[.18em] text-cyan-300">GS Paper Workspace</div><h2 className="mt-2 text-3xl font-black">Paper-wise demand, method and evidence</h2></div><div className="grid gap-5 lg:grid-cols-2">{gs.map(x=><article id={x.id} key={x.id} className="scroll-mt-24 rounded-3xl border border-slate-700 bg-slate-900/75 p-7"><div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">{x.paper}</div><h3 className="mt-2 text-xl font-black text-white">{x.syllabus}</h3><p className="mt-4 leading-7 text-slate-300">{x.method}</p><div className="mt-4 rounded-xl bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-100"><b>Evidence toolkit:</b> {x.examples}</div><div className="mt-5 flex flex-wrap gap-4"><Link href="/pyq" className="font-bold text-amber-200">Open PYQs →</Link><Link href="/member/submit" className="font-bold text-emerald-300">Submit practice answer →</Link></div></article>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 pb-16"><div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 p-7 sm:p-10"><div className="text-sm font-bold uppercase tracking-[.2em] text-cyan-300">Mains Method</div><h2 className="mt-2 text-3xl font-black">PYQ → Demand → Dimensions → Evidence → Balanced conclusion</h2><p className="mt-4 max-w-4xl leading-7 text-slate-300">UPSC states that Mains tests depth of understanding and the ability to analyse issues rather than mere memory. Practise relevant, meaningful and succinct answers: identify the directive, structure 150/250-word responses, add reliable evidence and finish with a realistic conclusion.</p></div></section>
  </main>;
}
