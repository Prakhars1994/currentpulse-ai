"use client";

import { useMemo, useState } from "react";
import ArticleContent from "@/components/ArticleContent";

function parseQuestion(value = "") {
  const text = String(value || "").trim();
  if (!text) return null;
  const answerMatch = text.match(/(?:^|\n)\s*(?:correct\s+)?answer\s*[:\-]\s*([A-D])(?:[.)\s]|$)([^\n]*)/i);
  const explanationMatch = text.match(/(?:^|\n)\s*(?:explanation|solution)\s*[:\-]\s*([\s\S]*)$/i);
  const optionPattern = /(?:^|\n)\s*([A-D])[.)]\s+([^\n]+)/g;
  const options = [...text.matchAll(optionPattern)].map((match) => ({ key: match[1].toUpperCase(), text: match[2].trim() }));
  const firstOption = text.search(/(?:^|\n)\s*A[.)]\s+/i);
  const question = text.slice(0, firstOption >= 0 ? firstOption : text.length).replace(/^(?:prelims\s+)?(?:practice\s+)?question\s*[:\-]?\s*/i, "").trim();
  return {
    question,
    options,
    answer: answerMatch?.[1]?.toUpperCase() || "",
    explanation: explanationMatch?.[1]?.trim() || answerMatch?.[2]?.trim() || "",
  };
}

export default function PrelimsPracticeCard({ value }) {
  const parsed = useMemo(() => parseQuestion(value), [value]);
  const [showAnswer, setShowAnswer] = useState(false);
  if (!parsed?.question) return null;

  return (
    <details id="prelims-practice" className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 scroll-mt-28">
      <summary className="cursor-pointer font-black text-amber-200">🧠 Prelims Practice Question</summary>
      <div className="mt-4 text-slate-200">
        <ArticleContent content={parsed.question} />
        {parsed.options.length > 0 && <ol className="mt-4 space-y-2">{parsed.options.map((option) => <li key={option.key}><strong>{option.key}.</strong> {option.text}</li>)}</ol>}
        {(parsed.answer || parsed.explanation) && <button type="button" onClick={() => setShowAnswer((shown) => !shown)} className="mt-5 rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-black text-amber-200">{showAnswer ? "Hide answer & explanation" : "Show answer & explanation"}</button>}
        {showAnswer && <div className="mt-4 rounded-xl bg-slate-950/70 p-4">{parsed.answer && <p className="font-black text-emerald-300">Answer: {parsed.answer}</p>}{parsed.explanation && <div className="mt-2"><ArticleContent content={parsed.explanation} /></div>}</div>}
      </div>
    </details>
  );
}
