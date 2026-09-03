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

const MAJOR_SECTION = "(?:Why in News\\?|Top Data \\& Facts for UPSC|Top Data and Facts for UPSC|Data \\& Facts for UPSC|Data and Facts for UPSC|Historical Perspective|History|Economic Perspective|Geographical Perspective|Environmental Perspective|Social Perspective|Political Perspective|Pros|Cons|Advantages|Disadvantages|Challenges|Issues|Way Forward|Conclusion|Static Foundation|Prelims Quick Revision|Probable Prelims Question|Probable Mains Question|UPSC\\/?BPSC Syllabus Linkage|Sources|Sources Consulted)";

function normalizeMarkdown(value = "") {
  const withoutHtml = /<\/?[a-z][\s\S]*>/i.test(value)
    ? htmlToMarkdown(value)
    : String(value);

  return highlightMarkdownFacts(withoutHtml
    .replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim, "")
    .replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "")
    .replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim, "")
    .replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*[•●▪◦][ \t]*/g, "\n\n- ")
    .replace(/\s+[-–—]\s+(?=[A-Z][A-Za-z])/g, "\n\n- ")
    .replace(/[ \t]+(#{2,4})[ \t]+/g, "\n\n$1 ")
    .replace(/\s+(\d{1,2}[.)])[ \t]+(?=[A-Z])/g, "\n\n$1 ")
    // PDF extraction can flatten a section label and its first bullet onto one line.
    // Promote every known CurrentPulse section label into a real Markdown heading.
    .replace(new RegExp(`(^|\\n|\\s{2,})(${MAJOR_SECTION})\\s*:?[ \\t]*(?=(?:[-•●▪◦]|[A-Z0-9]))`, "gim"), "$1\n\n## $2\n\n")
    .replace(new RegExp(`(^|\\n)\\s*(${MAJOR_SECTION})\\s*:?[ \\t]*(?=\\n|$)`, "gim"), "$1## $2\n")
    .replace(
      /(?:^|\n|\.\s+)(Background|Context|Significance|Key Developments|Key Issues(?: or Challenges)?|Issues and Challenges|Issues|Challenges|Impact|Implications|Opportunities|Recommendations|Dimensions|Key Features|Key Provisions|Concerns|Limitations)\s*:?\s+(?=[A-Z])/gi,
      (_, heading) => `\n\n### ${heading}\n\n`
    )
    .replace(
      /(^|\n)([-*]\s+)?([A-Z][A-Za-z0-9 /&()'-]{2,45}):\s+/g,
      "$1$2**$3:** "
    )
    .replace(/\s+-[ \t]+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function headingTone(children = "") {
  const text = String(children).toLowerCase();
  if (/top data|prelims quick|probable prelims/.test(text)) {
    return "border-amber-400 bg-amber-400/10 text-amber-100";
  }
  if (/probable mains|way forward|conclusion/.test(text)) {
    return "border-emerald-400 bg-emerald-400/10 text-emerald-100";
  }
  if (/histor|economic|geographical|environmental|social|political|pros|cons|advantages|disadvantages|challenges|issues/.test(text)) {
    return "border-violet-400 bg-violet-400/10 text-violet-100";
  }
  return "border-cyan-400 bg-cyan-400/10 text-cyan-50";
}

export default function ArticleContent({ content, fallback }) {
  const value = normalizeMarkdown(content || fallback || "");

  return (
    <div className="article-rich-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className={`mt-8 rounded-r-lg border-l-4 px-4 py-3 text-xl font-black tracking-tight sm:text-2xl ${headingTone(children)}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 border-b border-slate-700 pb-2 text-lg font-extrabold text-slate-100 sm:text-xl">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-[1.02rem] leading-7 text-slate-200 sm:text-[1.06rem] sm:leading-8">{children}</p>,
          ul: ({ children }) => <ul className="my-4 space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 space-y-2 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1 text-[1.02rem] leading-7 text-slate-200 sm:text-[1.06rem] sm:leading-8">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-5 border-l-4 border-cyan-400 bg-slate-900/80 px-4 py-3 text-slate-200">{children}</blockquote>,
        }}
      >{value}</ReactMarkdown>
    </div>
  );
}
