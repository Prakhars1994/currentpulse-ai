"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AIPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("Explain Topic");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (!topic) return undefined;

    const timer = window.setTimeout(() => {
      setQuestion(`Explain ${topic} for UPSC preparation.`);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function askAI() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          mode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.answer || "AI request failed.");
      }

      setAnswer(data.answer || "No answer was generated.");
    } catch (err) {
      setAnswer(err?.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">

      <h1 className="text-5xl font-bold text-cyan-400">
        CurrentPulse AI Assistant
      </h1>

      <p className="mt-6 text-xl text-gray-400">
        Ask anything about current affairs, UPSC,
        government schemes, economy, science and international relations.
      </p>

      <div className="mt-10 max-w-4xl">

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Example: Explain Article 370 for UPSC mains"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 p-5 text-lg text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          rows={5}
        />

        <div className="mt-5 flex flex-wrap gap-3">

          <button
            onClick={() => setMode("Explain Topic")}
            className={`rounded-lg px-4 py-2 ${
              mode === "Explain Topic"
                ? "bg-cyan-500 text-black font-bold"
                : "bg-slate-800"
            }`}
          >
            📖 Explain Topic
          </button>

          <button
            onClick={() => setMode("Mains Answer")}
            className={`rounded-lg px-4 py-2 ${
              mode === "Mains Answer"
                ? "bg-cyan-500 text-black font-bold"
                : "bg-slate-800"
            }`}
          >
            ✍️ Mains Answer
          </button>

          <button
            onClick={() => setMode("Prelims Facts")}
            className={`rounded-lg px-4 py-2 ${
              mode === "Prelims Facts"
                ? "bg-cyan-500 text-black font-bold"
                : "bg-slate-800"
            }`}
          >
            🎯 Prelims Facts
          </button>

          <button
            onClick={() => setMode("MCQs")}
            className={`rounded-lg px-4 py-2 ${
              mode === "MCQs"
                ? "bg-cyan-500 text-black font-bold"
                : "bg-slate-800"
            }`}
          >
            ❓ MCQs
          </button>

        </div>

        <button
          onClick={askAI}
          disabled={loading}
          className="mt-6 rounded-xl bg-cyan-500 px-8 py-3 font-bold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading ? "Generating Answer..." : "Ask CurrentPulse AI"}
        </button>

        {loading && (
          <div className="mt-6 rounded-xl bg-slate-900 p-6 border border-slate-700">
            <p className="text-cyan-400 text-lg animate-pulse">
              ⏳ CurrentPulse AI is thinking...
            </p>
          </div>
        )}

        {answer && !loading && (
          <div className="mt-8 rounded-xl border border-cyan-500/30 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/20">

            <h2 className="text-2xl font-bold text-cyan-400 mb-6">
              AI Response
            </h2>

            <div className="article-rich-content overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {answer}
              </ReactMarkdown>
            </div>

          </div>
        )}

      </div>

    </main>
  );
}
