
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamVertical, isKnownExamVertical } from "@/lib/examPrep/sourceRegistry";

export default async function ExamMockList({ params }) {
  const { exam } = await params;
  if (!isKnownExamVertical(exam)) notFound();
  const vertical = getExamVertical(exam);
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/mock-tests" className="text-sm font-bold text-cyan-300">← All exam mocks</Link>
        <h1 className="mt-6 text-4xl font-black">10 free {vertical.label} mock tests</h1>
        <p className="mt-3 text-slate-400">No login required. The reusable question bank is stored once and reused by every student.</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Link key={n} href={`/mock-tests/${exam}/${n}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-400"><span className="text-sm font-black text-cyan-300">MOCK {n}</span><h2 className="mt-2 text-xl font-black">{vertical.label} Practice Test {n}</h2></Link>)}</div>
      </div>
    </main>
  );
}
