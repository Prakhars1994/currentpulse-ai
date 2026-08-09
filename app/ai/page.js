"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MODES = [
  ["Explain Topic", "📖", "Explain"],
  ["Mains Answer", "✍️", "Mains"],
  ["Prelims Facts", "🎯", "Prelims"],
  ["MCQs", "❓", "MCQs"],
];

export default function AIPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("Explain Topic");
  const [loading, setLoading] = useState(false);
  const [groundedFallback, setGroundedFallback] = useState(false);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (!topic) return undefined;
    const timer = window.setTimeout(() => setQuestion(`Explain ${topic} for UPSC preparation.`), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function askAI() {
    if (!question.trim()) return;
    setLoading(true); setAnswer(""); setSources([]); setGroundedFallback(false);
    try {
      const res = await fetch("/api/ask-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, mode }) });
      const data = await res.json();
      if (!res.ok && !data.answer) throw new Error("AI request failed.");
      setAnswer(data.answer || "No answer was generated.");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setGroundedFallback(Boolean(data.groundedFallback));
    } catch (err) {
      setAnswer(err?.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <main className="ai-lab-page min-h-screen">
      <div className="ai-lab-shell">
        <header className="ai-lab-hero">
          <div className="ai-lab-badge">Evidence-first study assistant</div>
          <h1>Ask CurrentPulse <span>AI</span></h1>
          <p>Answers now retrieve matching CurrentPulse articles first, so current facts, data and office-holders are grounded in your own source-backed knowledge base.</p>
        </header>

        <section className="ai-lab-console">
          <div className="ai-mode-grid">
            {MODES.map(([value, icon, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={mode === value ? "is-active" : ""}><span>{icon}</span>{label}</button>)}
          </div>
          <label className="ai-question-label" htmlFor="ai-question">Your question</label>
          <textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Example: What changed in RBI monetary policy and what should I remember for Prelims?" rows={5} />
          <div className="ai-console-footer">
            <p>Current facts are restricted to retrieved CurrentPulse material.</p>
            <button onClick={askAI} disabled={loading}>{loading ? "Retrieving & reasoning…" : "Ask CurrentPulse AI →"}</button>
          </div>
        </section>

        {loading && <div className="ai-thinking-card"><span></span><div><strong>Searching CurrentPulse first</strong><p>Retrieving relevant articles before generating the answer.</p></div></div>}

        {answer && !loading && (
          <section className="ai-answer-card">
            <div className="ai-answer-head"><div><small>{groundedFallback ? "Source fallback" : "AI + CurrentPulse retrieval"}</small><h2>Answer</h2></div>{groundedFallback && <span>Provider unavailable · no invented response</span>}</div>
            <div className="article-rich-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div>
            {sources.length > 0 && <div className="ai-source-chips"><strong>Retrieved sources</strong>{sources.slice(0,5).map((source) => <a key={source.url} href={source.url}>{source.title}</a>)}</div>}
          </section>
        )}
      </div>
    </main>
  );
}
