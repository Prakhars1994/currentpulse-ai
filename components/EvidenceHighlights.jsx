"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";

function extractItems(content = "", limit = 6) {
  const text = String(content || "").trim();
  if (!text) return [];
  const bullets = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
  if (bullets.length) return bullets.slice(0, limit);
  return text
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 25)
    .slice(0, limit);
}

export default function EvidenceHighlights({ content, limit = 6 }) {
  const items = extractItems(content, limit);
  if (!items.length) return null;

  return (
    <div className="evidence-highlight-grid">
      {items.map((item, index) => (
        <article key={`${index}-${item.slice(0, 24)}`} className="evidence-highlight-card">
          <span className="evidence-highlight-number">{String(index + 1).padStart(2, "0")}</span>
          <div className="evidence-highlight-copy">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{highlightMarkdownFacts(item)}</ReactMarkdown>
          </div>
        </article>
      ))}
    </div>
  );
}
