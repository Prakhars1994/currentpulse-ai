export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabase } from "@/lib/supabase-server";
import { mapStoredQuiz, UPSC_FOUNDATION_FALLBACK } from "@/lib/study/buildQuiz";
import { indiaDate } from "@/lib/study/digestDates";
import QuizPlayer from "@/components/QuizPlayer";

export const metadata = {
  title: "Daily Current Affairs Quiz",
  description: "Automatically updated current-affairs quiz for UPSC and PCS preparation.",
  alternates: { canonical: "/quiz" },
};

export default async function QuizPage() {
  const today = indiaDate();
  let data = [];
  let error = null;

  try {
    const supabase = createServerSupabase();
    const result = await supabase
      .from("quiz_questions")
      .select("id,quiz_date,prompt,options,correct_index,explanation,difficulty,category,paper,source_slug,source_title,generation_provider,created_at")
      .order("quiz_date", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(36);
    data = result.data || [];
    error = result.error || null;
  } catch (loadError) {
    error = loadError;
  }

  if (error) console.error("Stored quiz fetch failed:", error?.message || error);
  const approved = data.filter((question) => String(question.generation_provider || "").includes("upsc-v2"));
  const todayRows = approved.filter((question) => question.quiz_date === today);
  const storedQuestions = mapStoredQuiz(todayRows);
  const questions = storedQuestions.length >= 10 ? storedQuestions : UPSC_FOUNDATION_FALLBACK;
  const usingFallback = storedQuestions.length < 10;

  return (
    <main className="quiz-page-theme min-h-screen px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="font-bold uppercase tracking-[0.24em] text-violet-300">
          {usingFallback ? `UPSC foundation practice · ${today}` : `Daily set · ${today}`}
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Daily current-affairs quiz</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Practise authentic statement-based questions with plausible options,
          difficulty grading and complete explanations. Daily questions are grounded
          in CurrentPulse&apos;s verified current-affairs articles.
        </p>
        {usingFallback && (
          <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-100">
            Today&apos;s verified current-affairs set is not ready yet. A curated UPSC
            foundation set is shown instead. CurrentPulse never presents an older
            dated quiz as today&apos;s quiz.
          </div>
        )}
        <div className="mt-10">
          <QuizPlayer questions={questions} />
        </div>
      </div>
    </main>
  );
}
