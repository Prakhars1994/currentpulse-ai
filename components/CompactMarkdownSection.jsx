"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";

function compactItems(content = "", limit = 6) {
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
    .filter((item) => item.length > 20)
    .slice(0, limit);
}

export default function CompactMarkdownSection({ content, limit = 6, fallback = "" }) {
  const items = compactItems(content, limit);
  if (!items.length && !fallback) return null;

  if (!items.length) {
    return <p className="compact-fallback">{fallback}</p>;
  }

  return (
    <ul className="compact-fact-list">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 28)}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{highlightMarkdownFacts(item)}</ReactMarkdown>
        </li>
      ))}
    </ul>
  );
}
