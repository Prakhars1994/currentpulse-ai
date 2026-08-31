import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";

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
    .replace(/<\s*strong(?:\s[^>]*)?>([\s\S]*?)<\s*\/strong\s*>/gi, "**$1**")
    .replace(/<\s*b(?:\s[^>]*)?>([\s\S]*?)<\s*\/b\s*>/gi, "**$1**")
    .replace(/<\s*em(?:\s[^>]*)?>([\s\S]*?)<\s*\/em\s*>/gi, "*$1*")
    .replace(/<\s*i(?:\s[^>]*)?>([\s\S]*?)<\s*\/i\s*>/gi, "*$1*")
    .replace(/<[^>]+>/g, " ");
}

function normalizeMarkdown(value = "") {
  const withoutHtml = /<\/?[a-z][\s\S]*>/i.test(value)
    ? htmlToMarkdown(value)
    : String(value);

  return highlightMarkdownFacts(withoutHtml
    // Strict-PDF controls are import instructions, never reader content.
    .replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim, "")
    .replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "")
    .replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim, "")
    .replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "")
    .replace(/\r\n?/g, "\n")
    // Imported coaching notes often flatten every bullet into one paragraph.
    .replace(/[ \t]*[•●▪◦][ \t]*/g, "\n\n- ")
    // Convert common dash-style separators into list items when clearly separated.
    .replace(/\s+[-–—]\s+(?=[A-Z][A-Za-z])/g, "\n\n- ")
    // Ensure Markdown headings are never embedded in paragraphs.
    .replace(/[ \t]+(#{2,4})[ \t]+/g, "\n\n$1 ")
    // Keep numbered points on separate lines when source text was flattened.
    .replace(/\s+(\d{1,2}[.)])[ \t]+(?=[A-Z])/g, "\n\n$1 ")
    // Give common UPSC analysis labels a real visual hierarchy, including
    // older articles generated before Markdown headings were enforced.
    .replace(
      /(?:^|\n|\.\s+)(Background|Context|Significance|Key Issues(?: or Challenges)?|Issues and Challenges|Issues|Challenges|Way Forward|Conclusion|Impact|Implications|Opportunities|Recommendations)\s*:?\s+(?=[A-Z])/gi,
      (_, heading) => `\n\n### ${heading}\n\n`
    )
    // Emphasize short factual labels such as "Institution:" or "Report:".
    .replace(
      /(^|\n)([-*]\s+)?([A-Z][A-Za-z0-9 /&()'-]{2,45}):\s+/g,
      "$1$2**$3:** "
    )
    // Every list item must begin on its own line.
    .replace(/\s+-[ \t]+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

export default function ArticleContent({ content, fallback }) {
  const value = normalizeMarkdown(content || fallback || "");

  return (
    <div className="article-rich-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
