export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabase } from "@/lib/supabase";
import { buildQuiz } from "@/lib/study/buildQuiz";
import QuizPlayer from "@/components/QuizPlayer";

export const metadata = {
  title: "Daily Current Affairs Quiz",
  description: "Automatically updated current-affairs quiz for UPSC and PCS preparation.",
};

export default async function QuizPage() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,paper,why_news,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(45);

  if (error) console.error("Quiz article fetch failed:", error.message);
  const questions = buildQuiz(data || [], 12);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">
          Updated from published articles
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Daily current-affairs quiz</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Test event recognition and UPSC syllabus mapping. Every answer includes an
          explanation and a link to the source analysis.
        </p>
        <div className="mt-10">
          <QuizPlayer questions={questions} />
        </div>
      </div>
    </main>
  );
}
