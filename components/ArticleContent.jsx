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

function repairPdfBoldArtifacts(value = "") {
  return String(value)
    // PDF extraction can split one visually bold word into adjacent markdown spans,
    // e.g. **AFFAI****RS. Join only that malformed intra-word boundary.
    .replace(/([\p{L}\p{N}])\*{4}(?=[\p{L}\p{N}])/gu, "$1")
    // If a PDF line is left with a single orphan ** delimiter, remove only that
    // orphan instead of destroying valid paired markdown bold everywhere.
    .split("\n")
    .map((line) => {
      const markers = line.match(/\*\*/g) || [];
      return markers.length === 1 ? line.replace(/\*\*/, "") : line;
    })
    .join("\n");
}

const MAJOR_SECTION = "(?:Why in News\\?|Top Data \\& Facts for UPSC|Top Data and Facts for UPSC|Data \\& Facts for UPSC|Data and Facts for UPSC|Historical Perspective|History|Economic Perspective|Geographical Perspective|Environmental Perspective|Social Perspective|Political Perspective|Political and Governance Perspective|Economic, Geographical \\& Environmental Perspective|Economic, Geographical and Environmental Perspective|Examples, Case Studies \\& Answer-Writing Value|Examples, Case Studies and Answer-Writing Value|Pros / Significance|Cons / Challenges|Advantages and Significance|Limitations and Challenges|Issues and Challenges|Way Forward|Conclusion|Static Foundation|Prelims Quick Revision|Probable Prelims Question|Probable Mains Question|UPSC\\/?BPSC Syllabus Linkage|Sources|Sources Consulted)";

function normalizeMarkdown(value = "") {
  const withoutHtml = /<\/?[a-z][\s\S]*>/i.test(value)
    ? htmlToMarkdown(value)
    : String(value);

  return highlightMarkdownFacts(repairPdfBoldArtifacts(withoutHtml
    .replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim, "")
    .replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "")
    .replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim, "")
    .replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "")
    .replace(/\r\n?/g, "\n"))
    // Preserve the short fact markers used in the approved PDF template as real list items.
    .replace(/\s+[u•●▪◦]\s+(?=[A-Z0-9])/g, "\n- ")
    .replace(/[ \t]*[•●▪◦][ \t]*/g, "\n\n- ")
    .replace(/\s+[-–—]\s+(?=[A-Z][A-Za-z])/g, "\n\n- ")
    .replace(/[ \t]+(#{2,4})[ \t]+/g, "\n\n$1 ")
    .replace(/\s+(\d{1,2}[.)])[ \t]+(?=[A-Z])/g, "\n\n$1 ")
    .replace(new RegExp(`(^|\\n|\\s+)(${MAJOR_SECTION})\\s*:?[ \\t]*(?=(?:[-•●▪◦]|[A-Z0-9]))`, "gim"), "$1\n\n## $2\n\n")
    .replace(new RegExp(`(^|\\n)\\s*(${MAJOR_SECTION})\\s*:?[ \\t]*(?=\\n|$)`, "gim"), "$1## $2\n")
    .replace(
      /(?:^|\n|\.\s+)(Background|Context|Significance|Key Developments|Key Issues(?: or Challenges)?|Issues and Challenges|Issues|Challenges|Impact|Implications|Opportunities|Recommendations|Dimensions|Key Features|Key Provisions|Concerns|Limitations)\s*:?\s+(?=[A-Z])/gi,
      (_, heading) => `\n\n### ${heading}\n\n`
    )
    .replace(/(^|\n)([-*]\s+)?([A-Z][A-Za-z0-9 /&()'-]{2,45}):\s+/g, "$1$2**$3:** ")
    .replace(/\s+-[ \t]+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function headingTheme(children = "") {
  const text = String(children).toLowerCase();
  if (/why in news/.test(text)) return { icon: "✓", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (/top data|data & facts|data and facts/.test(text)) return { icon: "★", cls: "border-blue-200 bg-blue-50 text-blue-900" };
  if (/prelims quick|probable prelims/.test(text)) return { icon: "◆", cls: "border-sky-200 bg-sky-50 text-sky-900" };
  if (/probable mains/.test(text)) return { icon: "Q", cls: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900" };
  if (/way forward|conclusion/.test(text)) return { icon: "→", cls: "border-indigo-200 bg-indigo-50 text-indigo-900" };
  if (/histor/.test(text)) return { icon: "◷", cls: "border-amber-200 bg-amber-50 text-amber-900" };
  if (/economic/.test(text)) return { icon: "↗", cls: "border-green-200 bg-green-50 text-green-900" };
  if (/geographical/.test(text)) return { icon: "◎", cls: "border-cyan-200 bg-cyan-50 text-cyan-900" };
  if (/environmental/.test(text)) return { icon: "♧", cls: "border-lime-200 bg-lime-50 text-lime-900" };
  if (/social/.test(text)) return { icon: "●", cls: "border-orange-200 bg-orange-50 text-orange-900" };
  if (/political/.test(text)) return { icon: "◇", cls: "border-violet-200 bg-violet-50 text-violet-900" };
  if (/pros|advantages/.test(text)) return { icon: "+", cls: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  if (/cons|disadvantages|challenges|issues/.test(text)) return { icon: "!", cls: "border-rose-200 bg-rose-50 text-rose-900" };
  if (/sources/.test(text)) return { icon: "↗", cls: "border-slate-200 bg-slate-50 text-slate-800" };
  return { icon: "•", cls: "border-blue-200 bg-blue-50 text-blue-900" };
}

export default function ArticleContent({ content, fallback }) {
  const value = normalizeMarkdown(content || fallback || "");

  return (
    <div className="article-rich-content rounded-2xl border border-slate-200 bg-white px-4 py-5 text-slate-800 shadow-sm sm:px-7 sm:py-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const theme = headingTheme(children);
            return (
              <h2 className={`mt-7 flex items-center gap-3 rounded-xl border px-4 py-3 text-lg font-black tracking-tight shadow-sm sm:text-xl ${theme.cls}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-sm font-black shadow-sm ring-1 ring-current/10">{theme.icon}</span>
                <span>{children}</span>
              </h2>
            );
          },
          h3: ({ children }) => (
            <h3 className="mt-6 border-b border-slate-200 pb-2 text-base font-extrabold text-blue-900 sm:text-lg">{children}</h3>
          ),
          p: ({ children }) => <p className="my-3 text-[0.98rem] leading-7 text-slate-700 sm:text-[1.02rem]">{children}</p>,
          ul: ({ children }) => <ul className="my-4 space-y-2.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 list-decimal space-y-2.5 pl-6">{children}</ol>,
          li: ({ children }) => (
            <li className="relative list-none rounded-lg border border-slate-100 bg-slate-50/80 py-2.5 pl-9 pr-3 text-[0.97rem] leading-6 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] before:absolute before:left-3 before:top-[0.95rem] before:h-2 before:w-2 before:rounded-full before:bg-blue-500 sm:text-[1rem]">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="rounded bg-amber-100 px-1 py-0.5 font-extrabold text-slate-900 ring-1 ring-amber-200/70">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-5 rounded-r-xl border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-slate-700">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-900">{children}</a>
          ),
        }}
      >{value}</ReactMarkdown>
    </div>
  );
}
