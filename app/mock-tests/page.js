import Link from "next/link";
import { EXAM_VERTICALS } from "@/lib/examPrep/sourceRegistry";

export const metadata = {
  title: "Free Mock Tests - UPSC, SSC, Railway, Banking & State PCS",
  description: "Ten free guest mock tests per major exam with instant deterministic evaluation and no login requirement.",
  alternates: { canonical: "/mock-tests" },
};

export default async function MockTestsPage({ searchParams }) {
  const params = await searchParams;
  const hi = params?.lang === "hi";
  const q = hi ? "?lang=hi" : "";
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.22em] text-cyan-300">{hi ? "मुफ़्त · बिना लॉगिन · प्रति छात्र ₹0 AI" : "Free · guest attempt · ₹0 AI per student"}</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">{hi ? "परीक्षा के अनुसार मॉक टेस्ट" : "Mock tests by exam"}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">{hi ? "UPSC, SSC, रेलवे, बैंकिंग और राज्य PCS के लिए 10 अलग-अलग मॉक। स्कोरिंग, नेगेटिव मार्किंग और उत्तर समीक्षा ब्राउज़र में होती है। प्रश्नों के लिए AI कॉल नहीं होती।" : "UPSC, SSC, Railway, Banking and State PCS each get 10 distinct free tests. Scoring, negative marking and answer review happen deterministically in the browser."}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Object.values(EXAM_VERTICALS).map((exam) => <article key={exam.slug} className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><p className="text-sm font-black uppercase tracking-[.16em] text-cyan-300">{exam.label}</p><h2 className="mt-2 text-2xl font-black">{hi ? "10 मुफ़्त मॉक" : "10 free mocks"}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{exam.subjects.join(" · ")}</p><Link href={`/mock-tests/${exam.slug}${q}`} className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">{hi ? `${exam.label} मॉक खोलें →` : `Open ${exam.label} mocks →`}</Link></article>)}
        </div>
      </div>
    </main>
  );
}
