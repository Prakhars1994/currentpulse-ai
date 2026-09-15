import Link from "next/link";
export const metadata={title:"Student Member Dashboard | CurrentPulse"};

const stats=[
 ["Test credits","—","Credits appear after verified package purchase"],
 ["Submitted","—","Your uploaded answer PDFs"],
 ["Evaluated","—","Completed evaluation reports"],
 ["Average score","—","Calculated after evaluated attempts"],
];

export default function MemberPage(){return <main className="min-h-screen bg-[#07111f] px-5 py-14 text-white"><div className="mx-auto max-w-7xl">
 <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">CurrentPulse Student Workspace</div><h1 className="mt-3 text-4xl font-black sm:text-5xl">My Mains Dashboard</h1><p className="mt-4 max-w-3xl leading-7 text-slate-300">One account for paid books, answer-writing test credits, private PDF submissions, evaluations and performance history.</p>
 <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([a,b,c])=><div key={a} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5"><div className="text-sm font-bold text-slate-400">{a}</div><div className="mt-2 text-3xl font-black text-emerald-300">{b}</div><div className="mt-2 text-xs leading-5 text-slate-500">{c}</div></div>)}</div>
 <div className="mt-8 grid gap-5 lg:grid-cols-3">
  <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><h2 className="text-2xl font-black">Student Account</h2><p className="mt-3 leading-7 text-slate-400">Secure sign up/login, profile and purchase history use the site's Supabase-backed account layer.</p><div className="mt-5 rounded-xl bg-amber-300/10 p-4 text-sm text-amber-200">Production authentication UI is being connected. No paid entitlement is granted without server verification.</div></section>
  <section className="rounded-2xl border border-emerald-400/25 bg-slate-900 p-6"><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Answer Writing</div><h2 className="mt-2 text-2xl font-black">My Tests</h2><p className="mt-3 leading-7 text-slate-400">Buy individual tests or packages, then use available credits to create attempts and submit handwritten answers as one PDF.</p><Link href="/mains/answer-writing" className="mt-5 inline-block rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950">Choose Tests & Packages →</Link></section>
  <section className="rounded-2xl border border-amber-300/25 bg-slate-900 p-6"><div className="text-xs font-black uppercase tracking-[.16em] text-amber-300">Paid Resources</div><h2 className="mt-2 text-2xl font-black">My Library</h2><p className="mt-3 leading-7 text-slate-400">The ₹200 CurrentPulse 200-Essay Textbook and future paid Mains resources appear here after verified purchase.</p><Link href="/mains/essay" className="mt-5 inline-block font-bold text-amber-300">View Essay Book →</Link></section>
 </div>
 <section className="mt-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-cyan-950/40 p-7"><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Evaluation Centre</div><h2 className="mt-2 text-3xl font-black">Submission & Evaluation History</h2><p className="mt-3 max-w-4xl leading-7 text-slate-400">Each attempt will show exam/test, submission date, private PDF status, evaluation status, marks, strengths, weaknesses and evaluator feedback. Evaluated reports remain attached to the student's account.</p><div className="mt-5 rounded-xl border border-dashed border-slate-600 p-5 text-sm text-slate-500">No attempt data is shown until the authenticated backend is active. This prevents placeholder scores or purchases from being mistaken for real student records.</div></section>
 </div></main>}
