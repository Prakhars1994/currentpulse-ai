"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const WORDS = {
  en: {
    noLogin: "No login required", evaluation: "evaluation runs in your browser",
    noAI: "no AI request per attempt", finish: "Finish & evaluate", correct: "correct",
    wrong: "wrong", unanswered: "unanswered", retake: "Retake", all: "All 10 mocks",
    your: "Your answer", right: "Correct", attempted: "attempted",
  },
  hi: {
    noLogin: "लॉगिन आवश्यक नहीं", evaluation: "मूल्यांकन आपके ब्राउज़र में होता है",
    noAI: "हर प्रयास पर कोई AI कॉल नहीं", finish: "टेस्ट समाप्त करें और मूल्यांकन देखें",
    correct: "सही", wrong: "गलत", unanswered: "अनुत्तरित", retake: "फिर से दें",
    all: "सभी 10 मॉक", your: "आपका उत्तर", right: "सही उत्तर", attempted: "प्रयास",
  },
};

export default function MockTestPlayer({ exam, testNumber, questions, marksPerCorrect = 1, negativeMarks = 0.25, language = "en" }) {
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const w = WORDS[language] || WORDS.en;

  const result = useMemo(() => {
    let correct = 0, wrong = 0;
    const subjects = new Map();
    for (const q of questions) {
      const selected = answers[q.id];
      const key = q.subject || "General";
      if (!subjects.has(key)) subjects.set(key, { total: 0, correct: 0, attempted: 0 });
      const s = subjects.get(key); s.total += 1;
      if (!selected) continue;
      s.attempted += 1;
      if (selected === q.answer) { correct += 1; s.correct += 1; } else wrong += 1;
    }
    const score = Math.round((correct * marksPerCorrect - wrong * negativeMarks) * 100) / 100;
    return { correct, wrong, unanswered: questions.length - correct - wrong, score, max: questions.length * marksPerCorrect, subjects: [...subjects.entries()] };
  }, [answers, questions, marksPerCorrect, negativeMarks]);

  function finish() {
    setFinished(true);
    try { localStorage.setItem(`currentpulse-mock-${exam}-${testNumber}`, JSON.stringify({ ...result, at: new Date().toISOString() })); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const languageQuery = language === "hi" ? "?lang=hi" : "";

  if (finished) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-7">
          <p className="font-black uppercase tracking-[.16em] text-cyan-300">{exam.toUpperCase()} · Mock {testNumber}</p>
          <h2 className="mt-2 text-4xl font-black">{result.score}/{result.max}</h2>
          <p className="mt-2 text-slate-300">{result.correct} {w.correct} · {result.wrong} {w.wrong} · {result.unanswered} {w.unanswered}</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => { setAnswers({}); setFinished(false); }} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">{w.retake}</button>
            <Link href={`/mock-tests/${exam}${languageQuery}`} className="rounded-xl border border-slate-700 px-5 py-3 font-bold">{w.all}</Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.subjects.map(([name, s]) => <div key={name} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><b>{name}</b><p className="mt-1 text-sm text-slate-400">{s.correct}/{s.total} {w.correct} · {s.attempted} {w.attempted}</p></div>)}
        </div>
        <div className="space-y-4">
          {questions.map((q, i) => <div key={q.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><b>{i+1}. {q.prompt}</b><p className="mt-2 text-sm text-slate-400">{w.your}: {answers[q.id] || "—"}</p><p className="text-sm text-emerald-300">{w.right}: {q.answer}</p><p className="mt-2 text-sm leading-6 text-slate-400">{q.explanation}</p>{q.sourceUrl && <a className="mt-2 inline-block text-xs font-bold text-cyan-300" href={q.sourceUrl} target="_blank" rel="noopener noreferrer">{q.source || "Source"} · {q.license || "source"} ↗</a>}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">{w.noLogin} · {w.evaluation} · +{marksPerCorrect} {w.correct} · −{negativeMarks} {w.wrong} · {w.noAI}.</div>
      <div className="space-y-5">
        {questions.map((q, i) => <article key={q.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex justify-between text-xs font-black uppercase tracking-[.12em] text-cyan-300"><span>{q.subject}</span><span>Q{i+1}</span></div><h2 className="mt-3 font-black leading-7">{q.prompt}</h2><div className="mt-4 grid gap-2">{q.options.map((option) => <button key={option} onClick={() => setAnswers((a) => ({ ...a, [q.id]: option }))} className={`rounded-xl border p-3 text-left text-sm ${answers[q.id] === option ? "border-cyan-300 bg-cyan-400/10" : "border-slate-700 bg-slate-950"}`}>{option}</button>)}</div></article>)}
      </div>
      <button onClick={finish} className="mt-7 w-full rounded-xl bg-cyan-400 px-6 py-4 text-lg font-black text-slate-950">{w.finish}</button>
    </div>
  );
}
