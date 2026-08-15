import { notFound } from "next/navigation";
import Link from "next/link";
import MockTestPlayer from "@/components/MockTestPlayer";
import { buildExamMock } from "@/lib/examPrep/mockBank";
import { getExamVertical, isKnownExamVertical } from "@/lib/examPrep/sourceRegistry";

export default async function ExamMockPage({ params, searchParams }) {
  const { exam, test } = await params;
  const query = await searchParams;
  if (!isKnownExamVertical(exam)) notFound();
  const n = Number(test);
  if (!Number.isInteger(n) || n < 1 || n > 10) notFound();
  const hi = query?.lang === "hi";
  const language = hi ? "hi" : "en";
  const suffix = hi ? "?lang=hi" : "";
  const vertical = getExamVertical(exam);
  const questions = buildExamMock(exam, n, 20);
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-4xl"><Link href={`/mock-tests/${exam}${suffix}`} className="text-sm font-bold text-cyan-300">← {hi ? `${vertical.label} मॉक सूची` : `${vertical.label} mock list`}</Link><h1 className="mt-6 text-4xl font-black">{vertical.label} Mock {n}</h1><p className="mt-3 text-sm text-slate-400">{hi ? `अभ्यास स्कोरिंग: +${vertical.mockMarks}, −${vertical.mockNegative}. आधिकारिक अंक-योजना अधिसूचना के अनुसार बदल सकती है।` : `Practice scoring: +${vertical.mockMarks}, −${vertical.mockNegative}. Exact official marking can vary by notification.`}</p><div className="mt-8"><MockTestPlayer exam={exam} testNumber={n} questions={questions} marksPerCorrect={vertical.mockMarks} negativeMarks={vertical.mockNegative} language={language} /></div></div></main>
  );
}
