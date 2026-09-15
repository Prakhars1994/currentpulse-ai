import Link from "next/link";

export const metadata = {
  title: "Answer Writing Test Studio | UPSC, PCS & Subjective Exams",
  description: "Five paid answer-writing test formats with member PDF submission, evaluation workflow and performance tracking.",
};

const tests = [
  {name:"Daily Mains Sprint", tag:"UPSC / PCS", price:"₹29", meta:"3 questions • 45 min", copy:"A low-cost daily practice test for disciplined answer writing. Upload one handwritten PDF after completion."},
  {name:"GS Sectional Test", tag:"UPSC GS1–GS4 / PCS", price:"₹79", meta:"10 questions • 90 min", copy:"Focused syllabus-wise test with 10/15-marker questions, demand analysis and structured evaluation."},
  {name:"Full-Length Mains Test", tag:"UPSC / State PCS", price:"₹149", meta:"20 questions • 3 hours", copy:"Exam-condition full paper with balanced question mix, time discipline and paper-level performance review."},
  {name:"Essay Writing Test", tag:"UPSC / PCS Essay", price:"₹99", meta:"2 essays • 3 hours", copy:"Essay simulation evaluated for structure, multidimensionality, examples, coherence, language and conclusion."},
  {name:"Custom Subjective Test", tag:"PCS / University / Other", price:"₹59", meta:"Choose subject • Flexible", copy:"For History, Political Science, Geography and other descriptive exams. Select the subject and upload answers as PDF."},
];

export default function AnswerWritingPage(){
 return <main className="min-h-screen bg-[#07111f] text-slate-100">
  <section className="border-b border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_#123c3a_0,_#07111f_48%,_#030712_100%)]">
   <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20">
    <div className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-emerald-200">Members • Answer Writing Lab</div>
    <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Write under pressure. <span className="text-emerald-300">Improve with every test.</span></h1>
    <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">Choose a test, attempt it like the real examination, scan your handwritten answer booklet into one PDF and submit it from your member account for evaluation.</p>
    <div className="mt-8 flex flex-wrap gap-3"><a href="#tests" className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">Choose a Test</a><Link href="/member" className="rounded-xl border border-slate-500 px-5 py-3 font-bold">Member Dashboard</Link></div>
   </div>
  </section>

  <section id="tests" className="mx-auto max-w-7xl px-5 py-12">
   <div className="mb-7"><div className="text-sm font-bold uppercase tracking-[.18em] text-emerald-300">5 Test Formats</div><h2 className="mt-2 text-3xl font-black">Practice from a daily sprint to a full 3-hour paper</h2></div>
   <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{tests.map((t,i)=><article key={t.name} className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900/75 p-6 shadow-xl">
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.15em] text-emerald-300">Test {i+1} • {t.tag}</div><h3 className="mt-2 text-2xl font-black">{t.name}</h3></div><div className="rounded-xl bg-emerald-300 px-3 py-2 text-xl font-black text-slate-950">{t.price}</div></div>
    <div className="mt-4 font-bold text-slate-200">{t.meta}</div><p className="mt-3 flex-1 leading-7 text-slate-400">{t.copy}</p>
    <Link href="/member" className="mt-6 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-center font-black text-emerald-200">Sign in to Buy & Attempt →</Link>
   </article>)}</div>
  </section>

  <section className="mx-auto max-w-7xl px-5 pb-16"><div className="rounded-3xl border border-amber-300/20 bg-slate-900 p-7 sm:p-10">
   <div className="text-sm font-bold uppercase tracking-[.2em] text-amber-300">Student Workflow</div><h2 className="mt-2 text-3xl font-black">Buy → Attempt → Scan → Upload PDF → Evaluation</h2>
   <div className="mt-6 grid gap-4 md:grid-cols-5">{["1. Become a member","2. Purchase a test","3. Write answers by hand","4. Upload one PDF","5. View evaluation & score"].map(x=><div key={x} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-bold text-slate-200">{x}</div>)}</div>
   <p className="mt-6 text-sm leading-6 text-slate-400">PDF submission and paid evaluation access will be tied to the signed-in student's purchase entitlement. Payment must be verified server-side before an attempt is unlocked.</p>
  </div></section>
 </main>
}
