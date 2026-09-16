import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";
import "./ArticleContent.css";

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function htmlToMarkdown(value = "") {
  return decodeHtmlEntities(value)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*p(?:\s[^>]*)?>/gi, "")
    .replace(/<\s*h2(?:\s[^>]*)?>([\s\S]*?)<\s*\/h2\s*>/gi, "\n\n## $1\n\n")
    .replace(/<\s*h3(?:\s[^>]*)?>([\s\S]*?)<\s*\/h3\s*>/gi, "\n\n### $1\n\n")
    .replace(/<\s*h4(?:\s[^>]*)?>([\s\S]*?)<\s*\/h4\s*>/gi, "\n\n#### $1\n\n")
    .replace(/<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/li\s*>/gi, "\n- $1")
    .replace(/<\s*\/?(?:ul|ol)(?:\s[^>]*)?>/gi, "\n")
    .replace(/<\s*(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\s*\/(?:strong|b)\s*>/gi, "**$1**")
    .replace(/<\s*(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\s*\/(?:em|i)\s*>/gi, "*$1*")
    .replace(/<[^>]+>/g, " ");
}

function repairPdfBoldArtifacts(value = "") {
  return String(value)
    .replace(/\*{4,}/g, "**")
    .replace(/([\p{L}\p{N}])\*\*(?=[\p{L}\p{N}])/gu, "$1")
    .split("\n")
    .map((line) => {
      const markers = line.match(/\*\*/g) || [];
      return markers.length % 2 === 1 ? line.replace(/\*\*(?![\s\S]*\*\*)/, "") : line;
    })
    .join("\n");
}

function stripEmptyMarkdownHeadings(value = "") {
  return String(value || "")
    // PDF extraction can prefix an otherwise-empty heading with a bullet/list marker.
    // Remove both plain empty headings (###) and malformed list headings (- ### / * ###).
    .replace(/^\s*(?:[-*+]\s+)?#{1,6}(?:\s|\u00a0)*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

const SECTION_NAMES = [
  "FAST READ", "WHY IN NEWS", "TOP DATA & FACTS", "TOP DATA AND FACTS",
  "TOP DATA & FACTS FOR UPSC", "TOP DATA AND FACTS FOR UPSC", "DATA & FACTS FOR UPSC",
  "DATA AND FACTS FOR UPSC", "HISTORICAL PERSPECTIVE", "ECONOMIC PERSPECTIVE",
  "GEOGRAPHICAL PERSPECTIVE", "ENVIRONMENTAL PERSPECTIVE", "SOCIAL PERSPECTIVE",
  "POLITICAL PERSPECTIVE", "POLITICAL / GOVERNANCE PERSPECTIVE",
  "POLITICAL AND GOVERNANCE PERSPECTIVE", "PROS", "CONS", "WAY FORWARD",
  "QUICK REVISION", "PRELIMS QUICK REVISION", "PROBABLE OBJECTIVE QUESTION",
  "PROBABLE DESCRIPTIVE QUESTION", "PROBABLE PRELIMS QUESTION", "PROBABLE MAINS QUESTION",
  "SOURCES", "SOURCES CONSULTED", "CONCLUSION", "STATIC FOUNDATION",
  "खबरों में क्यों?", "यूपीएससी के लिए शीर्ष डेटा और तथ्य", "ऐतिहासिक परिप्रेक्ष्य",
  "आर्थिक परिप्रेक्ष्य", "भौगोलिक परिप्रेक्ष्य", "पर्यावरणीय परिप्रेक्ष्य",
  "सामाजिक परिप्रेक्ष्य", "राजनीतिक परिप्रेक्ष्य", "आगे का रास्ता", "स्रोत",
];
const SECTION_SET = new Set(SECTION_NAMES.map((s) => s.toUpperCase()));

function isStrictPdfSource(value = "") {
  const raw = String(value || "");
  return /\[\[CA_START\]\]|^\s*CA_TITLE\s*:/im.test(raw) ||
    (/^\s*(?:CURRENT\s+AFFAIRS|समसामयिकी)\s+\d+\s*$/im.test(raw) &&
      /(^|\n)\s*(?:WHY\s+IN\s+NEWS|खबरों\s+में\s+क्यों\?)\s*($|\n)/im.test(raw));
}

function normalizeLine(line = "") {
  return String(line)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/^\s*[•●▪◦◎]\s*/, "- ")
    .replace(/^\s*u\s+(?=[A-Z0-9])/i, "- ")
    .replace(/^\s*[-*+]\s+#{1,6}(?:\s|\u00a0)*$/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeStrictPdfMarkdown(value = "") {
  let raw = String(value || "").replace(/\r\n?/g, "\n");
  raw = raw
    .replace(/^\s*\[\[(?:CA_(?:START|END)|CP_BULLET|सीपी_बुलेट)\]\]\s*$/gim, "")
    .replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "")
    .replace(/^\s*CurrentPulse AI\s*\|.*$/gim, "")
    .replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "")
    .replace(/\s*\[\[(?:CP_BULLET|सीपी_बुलेट)\]\]\s*/gi, "\n- ")
    .replace(/^\s*ACTIONABLE\s+ROADMAP\s*$/gim, "WAY FORWARD")
    .replace(/^\s*FINAL\s+TAKEAWAY\s*$/gim, "CONCLUSION")
    .replace(/^\s*VERIFIED\s+OFFICIAL\s+REFERENCES\s*$/gim, "SOURCES")
    .replace(/^\s*MAINS\s+QUESTION\s+FOR\s+UPSC\s*$/gim, "PROBABLE MAINS QUESTION");

  raw = stripEmptyMarkdownHeadings(raw);
  const lines = raw.split("\n").map(normalizeLine).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const plain = line.replace(/^[-*+]\s+/, "").trim();
    const upper = plain.replace(/:$/, "").toUpperCase();
    if (SECTION_SET.has(upper)) {
      out.push("", `## ${plain.replace(/:$/, "")}`, "");
      continue;
    }
    if (/^#{1,6}\s*$/.test(line)) continue;
    out.push(line);
  }
  return stripEmptyMarkdownHeadings(repairPdfBoldArtifacts(out.join("\n"))).trim();
}

function normalizeMarkdown(value = "") {
  const raw = String(value || "");
  if (isStrictPdfSource(raw)) return highlightMarkdownFacts(normalizeStrictPdfMarkdown(raw));
  let text = /<\/?[a-z][\s\S]*>/i.test(raw) ? htmlToMarkdown(raw) : raw;
  text = text
    .replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim, "")
    .replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "")
    .replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim, "")
    .replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "")
    .replace(/\r\n?/g, "\n")
    .replace(/(^|\n)\s*[•◎●▪◦]\s*/g, "$1- ")
    .replace(/[ \t]*[•●▪◦][ \t]*/g, "\n- ");
  return highlightMarkdownFacts(stripEmptyMarkdownHeadings(repairPdfBoldArtifacts(text)).trim());
}

export default function ArticleContent({ content, fallback }) {
  const source = content || fallback || "";
  const strictPdf = isStrictPdfSource(source);
  const value = stripEmptyMarkdownHeadings(
    strictPdf ? highlightMarkdownFacts(normalizeStrictPdfMarkdown(source)) : normalizeMarkdown(source)
  );
  return (
    <div className={`article-rich-content${strictPdf ? " strict-pdf-content" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const label = String(children || "").trim();
            if (!label) return null;
            return <h2 className={label.toUpperCase() === "FAST READ" ? "fast-read-heading" : undefined}>{children}</h2>;
          },
          h3: ({ children }) => String(children || "").trim() ? <h3>{children}</h3> : null,
          h4: ({ children }) => String(children || "").trim() ? <h4>{children}</h4> : null,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong>{children}</strong>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          table: ({ children }) => <div className="article-table-wrap"><table>{children}</table></div>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
