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
  const [provider, setProvider] = useState("");
  const [zeroAi, setZeroAi] = useState(false);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (!topic) return undefined;
    const timer = window.setTimeout(() => setQuestion(`Explain ${topic} for UPSC preparation.`), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function askAI() {
    if (!question.trim()) return;
    setLoading(true); setAnswer(""); setSources([]); setProvider(""); setZeroAi(false);
    try {
      const res = await fetch("/api/ask-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, mode }) });
      const data = await res.json();
      if (!res.ok && !data.answer) throw new Error("Request failed.");
      setAnswer(data.answer || "No answer was generated.");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setProvider(data.provider || "");
      setZeroAi(Boolean(data.zeroAi));
    } catch (err) {
      setAnswer(err?.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <main className="ai-lab-page min-h-screen">
      <div className="ai-lab-shell">
        <header className="ai-lab-hero">
          <div className="ai-lab-badge">Quota-first evidence assistant</div>
          <h1>Ask CurrentPulse <span>AI</span></h1>
          <p>Static questions use Wikipedia first. Recent and current-event questions add GDELT discovery. CurrentPulse material is consulted only when needed, and AI reasoning is reserved for analytical tasks such as Mains answers and MCQs.</p>
        </header>

        <section className="ai-lab-console">
          <div className="ai-mode-grid">
            {MODES.map(([value, icon, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={mode === value ? "is-active" : ""}><span>{icon}</span>{label}</button>)}
          </div>
          <label className="ai-question-label" htmlFor="ai-question">Your question</label>
          <textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Example: What changed in RBI monetary policy and what should I remember for Prelims?" rows={5} />
          <div className="ai-console-footer">
            <p>Wikipedia → GDELT for current queries → bounded CurrentPulse lookup → AI only when reasoning is needed.</p>
            <button onClick={askAI} disabled={loading}>{loading ? "Retrieving evidence…" : "Ask CurrentPulse AI →"}</button>
          </div>
        </section>

        {loading && <div className="ai-thinking-card"><span></span><div><strong>Checking free sources first</strong><p>Using cached Wikipedia/GDELT evidence before any model call.</p></div></div>}

        {answer && !loading && (
          <section className="ai-answer-card">
            <div className="ai-answer-head"><div><small>{zeroAi ? "Zero-AI source response" : "Evidence-backed reasoning"}</small><h2>Answer</h2></div>{provider && <span>{provider}</span>}</div>
            <div className="article-rich-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div>
            {sources.length > 0 && <div className="ai-source-chips"><strong>Retrieved sources</strong>{sources.slice(0,6).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>}
          </section>
        )}
      </div>
    </main>
  );
}
