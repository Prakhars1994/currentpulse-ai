"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AIPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("Explain Topic");
  const [loading, setLoading] = useState(false);

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

      setAnswer(data.answer);
    } catch (err) {
      setAnswer("Something went wrong. Please try again.");
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
          className="w-full rounded-xl bg-slate-900 border border-slate-700 p-5 text-lg"
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
          <div className="mt-8 rounded-xl bg-slate-900 p-8 border border-slate-700">

            <h2 className="text-2xl font-bold text-cyan-400 mb-6">
              AI Response
            </h2>

            <div className="prose prose-invert max-w-none prose-headings:text-cyan-400 prose-strong:text-white prose-li:marker:text-cyan-400 overflow-x-auto">
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