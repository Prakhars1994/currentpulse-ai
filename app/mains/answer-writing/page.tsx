import Link from "next/link";

export const metadata = {
  title: "Answer Writing Test Studio | UPSC, PCS & Subjective Exams",
  description: "Paid answer-writing tests and discounted multi-test packages with member PDF submission and evaluation workflow.",
};

const tests = [
  {name:"Daily Mains Sprint", tag:"UPSC / PCS", price:"₹29", meta:"3 questions • 45 min", copy:"A low-cost daily practice test for disciplined answer writing. Upload one handwritten PDF after completion."},
  {name:"GS Sectional Test", tag:"UPSC GS1–GS4 / PCS", price:"₹79", meta:"10 questions • 90 min", copy:"Focused syllabus-wise test with 10/15-marker questions, demand analysis and structured evaluation."},
  {name:"Full-Length Mains Test", tag:"UPSC / State PCS", price:"₹149", meta:"20 questions • 3 hours", copy:"Exam-condition full paper with balanced question mix, time discipline and paper-level performance review."},
  {name:"Essay Writing Test", tag:"UPSC / PCS Essay", price:"₹99", meta:"2 essays • 3 hours", copy:"Essay simulation evaluated for structure, multidimensionality, examples, coherence, language and conclusion."},
  {name:"Custom Subjective Test", tag:"PCS / University / Other", price:"₹59", meta:"Choose subject • Flexible", copy:"For History, Political Science, Geography and other descriptive exams. Select the subject and upload answers as PDF."},
];

const packages = [
 {name:"Starter Pack", tests:"5 tests", price:"₹299", old:"₹395", saving:"Save ₹96", copy:"Best for trying structured evaluation. Use credits on eligible sectional/subjective tests."},
 {name:"Practice Pack", tests:"10 tests", price:"₹549", old:"₹790", saving:"Save ₹241", copy:"A balanced package for regular answer-writing practice over several weeks.", popular:true},
 {name:"Serious Mains Pack", tests:"20 tests", price:"₹999", old:"₹1,580", saving:"Save ₹581", copy:"For sustained UPSC/PCS Mains preparation with enough attempts to track improvement."},
 {name:"Mains Marathon", tests:"30 tests", price:"₹1,399", old:"₹2,370", saving:"Save ₹971", copy:"High-volume practice for students preparing through a complete Mains answer-writing cycle."},
 {name:"Complete 50-Test Pack", tests:"50 tests", price:"₹1,999", old:"₹3,950", saving:"Save ₹1,951", copy:"Maximum-value package for long-term practice, revision tests and repeated performance tracking."},
];

export default function AnswerWritingPage(){
 return <main className="min-h-screen bg-[#07111f] text-slate-100">
  <section className="border-b border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_#123c3a_0,_#07111f_48%,_#030712_100%)]">
   <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20">
    <div className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-emerald-200">Members • Answer Writing Lab</div>
    <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Write under pressure. <span className="text-emerald-300">Improve with every test.</span></h1>
    <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">Buy a single test or save with a multi-test package. Attempt under exam conditions, scan your handwritten booklet into one PDF and submit it from your member account for evaluation.</p>
    <div className="mt-8 flex flex-wrap gap-3"><a href="#packages" className="rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950">View Test Packages</a><a href="#tests" className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">Single Tests</a><Link href="/member" className="rounded-xl border border-slate-500 px-5 py-3 font-bold">Member Dashboard</Link></div>
   </div>
  </section>

  <section id="packages" className="mx-auto max-w-7xl px-5 py-12">
   <div className="mb-7"><div className="text-sm font-black uppercase tracking-[.18em] text-amber-300">Save More • Practice More</div><h2 className="mt-2 text-3xl font-black">Answer Writing Test Packages</h2><p className="mt-3 max-w-3xl leading-7 text-slate-400">Purchase test credits once and use them from your member dashboard. Every used credit is linked to one submitted answer PDF and its evaluation record.</p></div>
   <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">{packages.map(p=><article key={p.name} className={`relative flex flex-col rounded-2xl border p-6 ${p.popular?"border-amber-300 bg-amber-300/10":"border-slate-700 bg-slate-900/75"}`}>
    {p.popular&&<div className="absolute -top-3 left-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">Most Popular</div>}
    <div className="text-xs font-black uppercase tracking-[.15em] text-amber-300">{p.tests}</div><h3 className="mt-2 text-xl font-black">{p.name}</h3>
    <div className="mt-5 flex items-end gap-2"><span className="text-3xl font-black text-white">{p.price}</span><span className="pb-1 text-sm text-slate-500 line-through">{p.old}</span></div><div className="mt-1 text-sm font-black text-emerald-300">{p.saving}</div>
    <p className="mt-4 flex-1 text-sm leading-6 text-slate-400">{p.copy}</p><Link href="/member" className="mt-5 rounded-xl bg-amber-300 px-4 py-3 text-center font-black text-slate-950">Sign in to Buy →</Link>
   </article>)}</div>
   <p className="mt-4 text-xs leading-5 text-slate-500">Package pricing shown is the launch catalogue. Final checkout entitlement, eligible test types, validity and payment confirmation will be enforced server-side before credits are issued.</p>
  </section>

  <section id="tests" className="mx-auto max-w-7xl px-5 py-12">
   <div className="mb-7"><div className="text-sm font-bold uppercase tracking-[.18em] text-emerald-300">5 Single-Test Formats</div><h2 className="mt-2 text-3xl font-black">Practice from a daily sprint to a full 3-hour paper</h2></div>
   <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{tests.map((t,i)=><article key={t.name} className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900/75 p-6 shadow-xl">
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.15em] text-emerald-300">Test {i+1} • {t.tag}</div><h3 className="mt-2 text-2xl font-black">{t.name}</h3></div><div className="rounded-xl bg-emerald-300 px-3 py-2 text-xl font-black text-slate-950">{t.price}</div></div>
    <div className="mt-4 font-bold text-slate-200">{t.meta}</div><p className="mt-3 flex-1 leading-7 text-slate-400">{t.copy}</p>
    <Link href="/member" className="mt-6 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-center font-black text-emerald-200">Sign in to Buy & Attempt →</Link>
   </article>)}</div>
  </section>

  <section className="mx-auto max-w-7xl px-5 pb-16"><div className="rounded-3xl border border-amber-300/20 bg-slate-900 p-7 sm:p-10">
   <div className="text-sm font-bold uppercase tracking-[.2em] text-amber-300">Student Workflow</div><h2 className="mt-2 text-3xl font-black">Buy Test/Credits → Attempt → Scan → Upload PDF → Evaluation</h2>
   <div className="mt-6 grid gap-4 md:grid-cols-5">{["1. Become a member","2. Buy test or package","3. Write answers by hand","4. Upload one PDF","5. View evaluation & score"].map(x=><div key={x} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-bold text-slate-200">{x}</div>)}</div>
   <p className="mt-6 text-sm leading-6 text-slate-400">PDF submission and evaluation access are tied to the signed-in student's verified purchase entitlement. Package credits should be deducted only when an attempt is created successfully.</p>
  </div></section>
 </main>
}
