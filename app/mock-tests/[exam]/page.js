import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamVertical, isKnownExamVertical } from "@/lib/examPrep/sourceRegistry";
import { examMockBankSize } from "@/lib/examPrep/mockBank";

export default async function ExamMockList({ params, searchParams }) {
  const { exam } = await params;
  const query = await searchParams;
  if (!isKnownExamVertical(exam)) notFound();
  const hi = query?.lang === "hi";
  const vertical = getExamVertical(exam);
  const suffix = hi ? "?lang=hi" : "";
  const bankSize = examMockBankSize(exam);
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href={`/mock-tests${suffix}`} className="text-sm font-bold text-cyan-300">← {hi ? "सभी परीक्षा मॉक" : "All exam mocks"}</Link>
        <h1 className="mt-6 text-4xl font-black">{hi ? `10 मुफ़्त ${vertical.label} मॉक टेस्ट` : `10 free ${vertical.label} mock tests`}</h1>
        <p className="mt-3 text-slate-400">{hi ? `लॉगिन आवश्यक नहीं। ${bankSize} वैध पुन: उपयोग योग्य/निर्धारित प्रश्नों के बैंक से 10 अलग सेट बनाए जाते हैं।` : `No login required. Ten non-overlapping sets are drawn from a ${bankSize}-question reusable/deterministic bank.`}</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Link key={n} href={`/mock-tests/${exam}/${n}${suffix}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-400"><span className="text-sm font-black text-cyan-300">MOCK {n}</span><h2 className="mt-2 text-xl font-black">{vertical.label} {hi ? `अभ्यास टेस्ट ${n}` : `Practice Test ${n}`}</h2></Link>)}</div>
      </div>
    </main>
  );
}
