import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";

function decodeHtmlEntities(value = "") {
  return String(value).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}
function htmlToMarkdown(value = "") {
  return decodeHtmlEntities(value).replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\s*\/p\s*>/gi, "\n\n").replace(/<\s*p(?:\s[^>]*)?>/gi, "").replace(/<\s*h2(?:\s[^>]*)?>([\s\S]*?)<\s*\/h2\s*>/gi, "\n\n## $1\n\n").replace(/<\s*h3(?:\s[^>]*)?>([\s\S]*?)<\s*\/h3\s*>/gi, "\n\n### $1\n\n").replace(/<\s*h4(?:\s[^>]*)?>([\s\S]*?)<\s*\/h4\s*>/gi, "\n\n#### $1\n\n").replace(/<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/li\s*>/gi, "\n- $1").replace(/<\s*\/?(?:ul|ol)(?:\s[^>]*)?>/gi, "\n").replace(/<\s*strong(?:\s[^>]*)?>([\s\S]*?)<\s*\/strong\s*>/gi, "**$1**").replace(/<\s*b(?:\s[^>]*)?>([\s\S]*?)<\s*\/b\s*>/gi, "**$1**").replace(/<\s*em(?:\s[^>]*)?>([\s\S]*?)<\s*\/em\s*>/gi, "*$1*").replace(/<\s*i(?:\s[^>]*)?>([\s\S]*?)<\s*\/i\s*>/gi, "*$1*").replace(/<[^>]+>/g, " ");
}
function repairPdfBoldArtifacts(value = "") {
  return String(value)
    .replace(/\*{4,}/g, "**")
    .replace(/([\p{L}\p{N}])\*\*(?=[\p{L}\p{N}])/gu, "$1")
    .split("\n").map((line) => { const markers=line.match(/\*\*/g)||[]; return markers.length%2===1?line.replace(/\*\*(?![\s\S]*\*\*)/,""):line; }).join("\n");
}
function stripPdfHeader(value = "") {
  return String(value)
    .replace(/^\s*(?:\*{0,2})?CURRENT\s+(?:\*{0,2})?AFFAI\*{0,6}RS\s*\d+.*?(?=(?:WHY\s+IN\s+NEWS|##|\n[-•]))/is, "")
    .replace(/^\s*(?:CURRENT\s+AFFAIRS|CURRENT AFFAIRS)\s*\d*\s*$/gim, "")
    .replace(/^\s*(?:Category|GS|Date)\s*:\s*.*$/gim, "");
}
const MAJOR_SECTION = "(?:Why in News\\?|Top Data \\& Facts for UPSC|Top Data and Facts for UPSC|Data \\& Facts for UPSC|Data and Facts for UPSC|Historical Perspective|History|Economic Perspective|Geographical Perspective|Environmental Perspective|Social Perspective|Political Perspective|Political and Governance Perspective|Economic, Geographical \\& Environmental Perspective|Economic, Geographical and Environmental Perspective|Examples, Case Studies \\& Answer-Writing Value|Examples, Case Studies and Answer-Writing Value|Pros / Significance|Cons / Challenges|Advantages and Significance|Limitations and Challenges|Issues and Challenges|Way Forward|Conclusion|Static Foundation|Prelims Quick Revision|Probable Prelims Question|Probable Mains Question|UPSC\\/?BPSC Syllabus Linkage|Sources|Sources Consulted)";
function normalizeMarkdown(value = "") {
  const withoutHtml=/<\/?[a-z][\s\S]*>/i.test(value)?htmlToMarkdown(value):String(value);
  let cleaned=stripPdfHeader(withoutHtml.replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim,"").replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim,"").replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim,"").replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim,"").replace(/\r\n?/g,"\n"));
  cleaned=repairPdfBoldArtifacts(cleaned)
    .replace(/(^|\n)\s*[•◎●▪◦]\s*(?=[A-Z])/g,"$1")
    .replace(/[ \t]*[•●▪◦][ \t]*/g,"\n\n- ")
    .replace(/\s+[-–—]\s+(?=[A-Z][A-Za-z])/g,"\n\n- ")
    .replace(/[ \t]+(#{2,4})[ \t]+/g,"\n\n$1 ")
    .replace(/\s+(\d{1,2}[.)])[ \t]+(?=[A-Z])/g,"\n\n$1 ")
    .replace(new RegExp(`(^|\\n|\\s+)(${MAJOR_SECTION})\\s*:?[ \\t]*(?=(?:[-•●▪◦]|[A-Z0-9]))`,"gim"),"$1\n\n## $2\n\n")
    .replace(new RegExp(`(^|\\n)\\s*(${MAJOR_SECTION})\\s*:?[ \\t]*(?=\\n|$)`,"gim"),"$1## $2\n")
    .replace(/(?:^|\n|\.\s+)(Background|Context|Significance|Key Developments|Key Issues(?: or Challenges)?|Issues and Challenges|Issues|Challenges|Impact|Implications|Opportunities|Recommendations|Dimensions|Key Features|Key Provisions|Concerns|Limitations)\s*:?\s+(?=[A-Z])/gi,(_,heading)=>`\n\n### ${heading}\n\n`)
    .replace(/(^|\n)([-*]\s+)?([A-Z][A-Za-z0-9 /&()'-]{2,45}):\s+/g,"$1$2**$3:** ")
    .replace(/\s+-[ \t]+/g,"\n- ")
    .replace(/\bstrateGIc\b/g,"strategic").replace(/\btechnoloGIcal\b/g,"technological").replace(/\benGIneering\b/g,"engineering").replace(/\becoloGIcal\b/g,"ecological").replace(/\bStrateGIc\b/g,"Strategic")
    .replace(/\bq\s+UAN\s+tities\b/g,"quantities").replace(/\s+u\s+(?=[a-z])/g,"; ")
    .replace(/\n-\s+(\d{1,4})\s*\.\s*(?=\n|$)/g,"")
    .replace(/\n{3,}/g,"\n\n").trim();
  return highlightMarkdownFacts(cleaned);
}
export default function ArticleContent({content,fallback}) {
  const value=normalizeMarkdown(content||fallback||"");
  return <div className="article-rich-content"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    h2:({children})=><h2>{children}</h2>, h3:({children})=><h3>{children}</h3>, h4:({children})=><h4>{children}</h4>,
    p:({children})=><p>{children}</p>, ul:({children})=><ul>{children}</ul>, ol:({children})=><ol>{children}</ol>, li:({children})=><li>{children}</li>,
    strong:({children})=><strong>{children}</strong>, blockquote:({children})=><blockquote>{children}</blockquote>,
    a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table:({children})=><div className="article-table-wrap"><table>{children}</table></div>
  }}>{value}</ReactMarkdown></div>;
}
