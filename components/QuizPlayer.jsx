"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Trophy, XCircle } from "lucide-react";

const STORAGE_KEY = "currentpulse-quiz-best";

export default function QuizPlayer({ questions }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
    const timer = window.setTimeout(() => setBest(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const score = useMemo(
    () =>
      questions.reduce(
        (total, question) => total + (answers[question.id] === question.answer ? 1 : 0),
        0
      ),
    [answers, questions]
  );

  if (!questions.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
        <h2 className="text-2xl font-bold">Quiz is waiting for published articles</h2>
        <p className="mt-3 text-slate-400">
          Questions are generated automatically from the latest published current affairs.
        </p>
      </div>
    );
  }

  function choose(question, option) {
    if (answers[question.id]) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: option }));
  }

  function completeQuiz() {
    setFinished(true);
    if (score > best) {
      setBest(score);
      window.localStorage.setItem(STORAGE_KEY, String(score));
    }
  }

  function restart() {
    setCurrent(0);
    setAnswers({});
    setFinished(false);
  }

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-3xl border border-cyan-500/30 bg-slate-900 p-7 sm:p-10">
        <Trophy className="h-12 w-12 text-amber-300" />
        <h2 className="mt-5 text-3xl font-black">Quiz completed</h2>
        <p className="mt-3 text-lg text-slate-300">
          You scored <strong className="text-cyan-300">{score}/{questions.length}</strong> ({percentage}%).
        </p>
        <p className="mt-1 text-sm text-slate-500">Best score on this browser: {Math.max(best, score)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950"
          >
            <RotateCcw size={18} /> Try again
          </button>
          <Link
            href="/current-affairs"
            className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white"
          >
            Revise current affairs
          </Link>
        </div>

        <div className="mt-10 space-y-4">
          <h3 className="text-xl font-bold">Answer review</h3>
          {questions.map((question, index) => {
            const correct = answers[question.id] === question.answer;
            return (
              <div key={question.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex gap-3">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 shrink-0 text-rose-400" />
                  )}
                  <div>
                    <p className="font-bold">{index + 1}. {question.prompt.split("\n")[0]}</p>
                    {!correct && (
                      <p className="mt-2 text-sm text-rose-300">Your answer: {answers[question.id] || "Not answered"}</p>
                    )}
                    <p className="mt-1 text-sm text-emerald-300">Correct answer: {question.answer}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{question.explanation}</p>
                    <Link href={question.articleUrl} className="mt-3 inline-block text-sm font-bold text-cyan-400">
                      Read source analysis →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const question = questions[current];
  const selected = answers[question.id];
  const isLast = current === questions.length - 1;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-10">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-cyan-300">{question.type}</span>
        <span className="text-slate-400">Question {current + 1} of {questions.length}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
      </div>

      <h2 className="mt-8 whitespace-pre-line text-xl font-bold leading-8 sm:text-2xl">
        {question.prompt}
      </h2>

      <div className="mt-7 grid gap-3">
        {question.options.map((option, index) => {
          const picked = selected === option;
          const correct = selected && option === question.answer;
          const wrong = picked && option !== question.answer;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(question, option)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                correct
                  ? "border-emerald-400 bg-emerald-500/10"
                  : wrong
                    ? "border-rose-400 bg-rose-500/10"
                    : picked
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-700 bg-slate-950 hover:border-cyan-500"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-black">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="pt-0.5 font-medium">{option}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={`mt-6 rounded-xl border p-5 ${selected === question.answer ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
          <p className="font-bold">
            {selected === question.answer ? "Correct" : `Correct answer: ${question.answer}`}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
          <Link href={question.articleUrl} className="mt-3 inline-block text-sm font-bold text-cyan-300">
            Read the complete article →
          </Link>
        </div>
      )}

      <div className="mt-7 flex justify-end">
        <button
          type="button"
          disabled={!selected}
          onClick={() => (isLast ? completeQuiz() : setCurrent((value) => value + 1))}
          className="rounded-xl bg-cyan-500 px-6 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast ? "Finish quiz" : "Next question"}
        </button>
      </div>
    </div>
  );
}
