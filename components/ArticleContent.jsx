import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightMarkdownFacts } from "@/lib/study/highlightFacts";
import "./ArticleContent.css";

function decodeHtmlEntities(value = "") { return String(value).replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'"); }
function htmlToMarkdown(value = "") { return decodeHtmlEntities(value).replace(/<\s*br\s*\/?>/gi,"\n").replace(/<\s*\/p\s*>/gi,"\n\n").replace(/<\s*p(?:\s[^>]*)?>/gi,"").replace(/<\s*h2(?:\s[^>]*)?>([\s\S]*?)<\s*\/h2\s*>/gi,"\n\n## $1\n\n").replace(/<\s*h3(?:\s[^>]*)?>([\s\S]*?)<\s*\/h3\s*>/gi,"\n\n### $1\n\n").replace(/<\s*h4(?:\s[^>]*)?>([\s\S]*?)<\s*\/h4\s*>/gi,"\n\n#### $1\n\n").replace(/<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/li\s*>/gi,"\n- $1").replace(/<\s*\/?(?:ul|ol)(?:\s[^>]*)?>/gi,"\n").replace(/<\s*(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\s*\/(?:strong|b)\s*>/gi,"**$1**").replace(/<\s*(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\s*\/(?:em|i)\s*>/gi,"*$1*").replace(/<[^>]+>/g," "); }
function repairPdfBoldArtifacts(value = "") { return String(value).replace(/\*{4,}/g,"**").replace(/([\p{L}\p{N}])\*\*(?=[\p{L}\p{N}])/gu,"$1").split("\n").map(line=>{const markers=line.match(/\*\*/g)||[];return markers.length%2===1?line.replace(/\*\*(?![\s\S]*\*\*)/,""):line;}).join("\n"); }

const STRICT_SECTIONS = [
  "WHY IN NEWS","TOP DATA & FACTS FOR UPSC","TOP DATA AND FACTS FOR UPSC","DATA & FACTS FOR UPSC","DATA AND FACTS FOR UPSC",
  "HISTORICAL PERSPECTIVE","ECONOMIC PERSPECTIVE","GEOGRAPHICAL PERSPECTIVE","ENVIRONMENTAL PERSPECTIVE","SOCIAL PERSPECTIVE",
  "POLITICAL PERSPECTIVE","POLITICAL AND GOVERNANCE PERSPECTIVE","PROS","CONS","WAY FORWARD","PRELIMS QUICK REVISION",
  "PROBABLE PRELIMS QUESTION","PROBABLE MAINS QUESTION","SOURCES","SOURCES CONSULTED",
];
const STRICT_SECTION_SET = new Set(STRICT_SECTIONS);
const STRICT_MONTHS="January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const STRICT_SECTION_PATTERN = new RegExp(`\\b(${STRICT_SECTIONS.map(s=>s.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")).join("|")})\\b`,"gi");

function cleanStrictPdfText(value="") {
  return String(value||"")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"")
    .replace(/(^|\s)[uU]\s+(?=[A-Z0-9])/g,"$1")
    .replace(/\beliGIble\b/g,"eligible").replace(/\bdiGItal/gi,"digital").replace(/\bforGIv/gi,"forgiv").replace(/\breGIon/gi,"region")
    .replace(/\bstrateGIc\b/g,"strategic").replace(/\btechnoloGIcal\b/g,"technological").replace(/\benGIneering\b/g,"engineering").replace(/\becoloGIcal\b/g,"ecological").replace(/\bStrateGIc\b/g,"Strategic").replace(/\bforGIngs\b/g,"forgings")
    .replace(/\b(\d+)\s+(st|nd|rd|th)\b/gi,"$1$2")
    .replace(/\b(\d+)\s+-\s+(year|month|day|km|GW|MW|MT|LMT)\b/gi,"$1-$2")
    .replace(/\b(FY)\s+(\d{4})\s+-\s+(\d{2})\b/g,"$1 $2-$3")
    .replace(/\*\*Rs\s+(\d+)\s*\*\*\s*,\s*\*\*(\d[\d,]*)\s*\*\*/gi,"**Rs $1,$2**")
    .replace(/\*\*Rs\s+(\d+)\s*\*\*\s*,\s*(\d[\d,]*)/gi,"**Rs $1,$2**")
    .replace(/\*\*([^*]+)\*\*\s*\*\*([^*]+)\*\*/g,"**$1$2**")
    .replace(/\s+([,.;:!?])/g,"$1")
    .replace(/\s{2,}/g," ")
    .trim();
}

function strictFactHighlight(value="") {
  let text=String(value||"");
  const protectedValues=[];
  const protect=(match)=>{const token=`§§strict${protectedValues.length}§§`;protectedValues.push(`**${match}**`);return token;};
  const patterns=[
    /(?:₹|Rs\.?|INR|US\$|\$|€|£)\s*\d[\d,.]*(?:\.\d+)?\s*(?:lakh\s+crore|crore|lakh|million|billion|trillion|thousand)?/gi,
    /\b\d+(?:\.\d+)?\s*(?:%|per\s+cent|crore|lakh|million|billion|trillion|GW|MW|kW|km²|sq\.?\s*km|km|metres?|meters?|tonnes?|MT|LMT|kg|hectares?|years?|months?|days?|hours?)\b/gi,
    new RegExp(`\\b(?:\\d{1,2}\\s+)?(?:${STRICT_MONTHS})\\s+(?:17|18|19|20)\\d{2}\\b`,"gi"),
    /\b(?:17|18|19|20)\d{2}\b/g,
    /\b\d+(?:st|nd|rd|th)\b/gi,
  ];
  for(const pattern of patterns) text=text.replace(pattern,protect);
  return text.replace(/§§strict(\d+)§§/g,(_,i)=>protectedValues[Number(i)]||"");
}

function isStrictPdfSource(value = "") {
  const raw = String(value || "");
  return /\[\[CA_START\]\]|^\s*CA_TITLE\s*:/im.test(raw) ||
    (/^\s*CURRENT\s+AFFAIRS\s+\d+\s*$/im.test(raw) && /(^|\n)\s*WHY\s+IN\s+NEWS\s*($|\n)/im.test(raw));
}

function normalizeStrictPdfMarkdown(value = "") {
  let raw = String(value || "").replace(/\r\n?/g, "\n");
  raw = raw.replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim, "").replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim, "").replace(/^\s*CurrentPulse AI\s*\|.*$/gim, "").replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim, "");
  const whyIndex = raw.search(/(^|\n)\s*WHY\s+IN\s+NEWS\s*(?=\n|$)/i);
  if (whyIndex >= 0) raw = raw.slice(whyIndex).replace(/^\s+/, "");
  const lines = raw.split("\n").map((line) => cleanStrictPdfText(line)).filter(Boolean);
  const out = [];
  let bulletIndex = -1;
  const pushSectionAwareBullet=(text)=>{
    let rest=text.trim();
    const pieces=[];
    let last=0; STRICT_SECTION_PATTERN.lastIndex=0; let m;
    while((m=STRICT_SECTION_PATTERN.exec(rest))!==null){ if(m.index>last) pieces.push({type:"text",value:rest.slice(last,m.index).trim()}); pieces.push({type:"section",value:m[1].toUpperCase()}); last=STRICT_SECTION_PATTERN.lastIndex; }
    if(last<rest.length) pieces.push({type:"text",value:rest.slice(last).trim()});
    if(!pieces.some(p=>p.type==="section")){ out.push(`- ${rest}`); bulletIndex=out.length-1; return; }
    for(const p of pieces){ if(!p.value) continue; if(p.type==="section"){ out.push("",`## ${p.value}`,""); bulletIndex=-1; } else { out.push(`- ${p.value}`); bulletIndex=out.length-1; } }
  };
  for (const original of lines) {
    const upper = original.replace(/\s+/g, " ").toUpperCase();
    if (STRICT_SECTION_SET.has(upper)) { out.push("", `## ${upper}`, ""); bulletIndex = -1; continue; }
    if (/^[•●▪◦◎u]\s*/i.test(original) || /^[-*]\s+/.test(original)) {
      const text = original.replace(/^(?:[•●▪◦◎u]|[-*])\s*/i, "").trim();
      pushSectionAwareBullet(text); continue;
    }
    const inlineSection=original.match(STRICT_SECTION_PATTERN);
    STRICT_SECTION_PATTERN.lastIndex=0;
    if(inlineSection){ pushSectionAwareBullet(original); continue; }
    if (bulletIndex >= 0 && out[bulletIndex]?.startsWith("- ")) out[bulletIndex] += ` ${original}`;
    else out.push(original);
  }
  return repairPdfBoldArtifacts(out.join("\n")).replace(/\n{3,}/g, "\n\n").trim();
}

function stripPdfHeader(value = "") { return String(value).replace(/^\s*(?:\*{0,2})?CURRENT\s+(?:\*{0,2})?AFFAI\*{0,6}RS\s*\d+.*?(?=(?:WHY\s+IN\s+NEWS|##|\n[-•]))/is,"").replace(/^\s*(?:CURRENT\s+AFFAIRS|CURRENT AFFAIRS)\s*\d*\s*$/gim,"").replace(/^\s*(?:Category|GS|Date)\s*:\s*.*$/gim,""); }
const MAJOR_SECTION="(?:Why in News\\?|Top Data \\& Facts for UPSC|Top Data and Facts for UPSC|Data \\& Facts for UPSC|Data and Facts for UPSC|Historical Perspective|History|Economic Perspective|Geographical Perspective|Environmental Perspective|Social Perspective|Political Perspective|Political and Governance Perspective|Economic, Geographical \\& Environmental Perspective|Economic, Geographical and Environmental Perspective|Examples, Case Studies \\& Answer-Writing Value|Examples, Case Studies and Answer-Writing Value|Pros / Significance|Cons / Challenges|Advantages and Significance|Limitations and Challenges|Issues and Challenges|Way Forward|Conclusion|Static Foundation|Prelims Quick Revision|Probable Prelims Question|Probable Mains Question|UPSC\\/?BPSC Syllabus Linkage|Sources|Sources Consulted)";
const MICRO_HEADING_ENDING="(?:perspective|dimension|angle|lens|linkage|challenge|challenges|concern|concerns|opportunity|opportunities|implication|implications|recommendation|recommendations|case study|case studies|exam relevance|answer-writing value|policy takeaway|governance takeaway|strategic takeaway)";
function structureMicroHeadings(value="") {
  let text=String(value);
  const inlineBold=new RegExp(`(?:^|\\s+)\\*\\*([A-Z][A-Za-z0-9 /&()'’–—-]{1,70}\\s+${MICRO_HEADING_ENDING}):\\*\\*\\s*`,"gim");
  text=text.replace(inlineBold,(_,heading)=>`\n\n### ${heading}\n\n- `);
  const plainBullet=new RegExp(`(^|\\n)\\s*[-*]\\s+([A-Z][A-Za-z0-9 /&()'’–—-]{1,70}\\s+${MICRO_HEADING_ENDING}):\\s*`,`gim`);
  text=text.replace(plainBullet,(_,lead,heading)=>`${lead}\n\n### ${heading}\n\n- `);
  text=text.replace(/(^|\n)(### [^\n]+\n\n- [^\n]+?\.)(?=\s+[A-Z][^\n]{25,})/g,(_,lead,first)=>`${lead}${first.replace(/\.\s+/g,".\n- ")}`);
  return text;
}
function normalizeMarkdown(value="") {
  const raw=String(value||"");
  if (isStrictPdfSource(raw)) return normalizeStrictPdfMarkdown(raw);
  const withoutHtml=/<\/?[a-z][\s\S]*>/i.test(raw)?htmlToMarkdown(raw):raw;
  let cleaned=stripPdfHeader(withoutHtml.replace(/^\s*\[\[CA_(?:START|END)\]\]\s*$/gim,"").replace(/^\s*CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*.*$/gim,"").replace(/^\s*CurrentPulse AI\s*\|\s*STRICT CA UPLOAD FORMAT.*$/gim,"").replace(/^\s*(?:Page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gim,"").replace(/\r\n?/g,"\n"));
  cleaned=repairPdfBoldArtifacts(cleaned)
    .replace(/(^|\n)\s*[•◎●▪◦]\s*/g,"$1- ").replace(/[ \t]*[•●▪◦][ \t]*/g,"\n\n- ").replace(/\s+[-–—]\s+(?=[A-Z][A-Za-z])/g,"\n\n- ").replace(/[ \t]+(#{2,4})[ \t]+/g,"\n\n$1 ").replace(/\s+(\d{1,2}[.)])[ \t]+(?=[A-Z])/g,"\n\n$1 ")
    .replace(new RegExp(`(^|\\n|\\s+)(${MAJOR_SECTION})\\s*:?[ \\t]*(?=(?:[-•●▪◦]|[A-Z0-9]))`,"gim"),"$1\n\n## $2\n\n").replace(new RegExp(`(^|\\n)\\s*(${MAJOR_SECTION})\\s*:?[ \\t]*(?=\\n|$)`,"gim"),"$1## $2\n")
    .replace(/(?:^|\n|\.\s+)(Background|Context|Significance|Key Developments|Key Issues(?: or Challenges)?|Issues and Challenges|Issues|Challenges|Impact|Implications|Opportunities|Recommendations|Dimensions|Key Features|Key Provisions|Concerns|Limitations)\s*:?\s+(?=[A-Z])/gi,(_,heading)=>`\n\n### ${heading}\n\n`)
    .replace(/(^|\n)([-*]\s+)?([A-Z][A-Za-z0-9 /&()'-]{2,45}):\s+/g,"$1$2**$3:** ").replace(/\s+-[ \t]+/g,"\n- ")
    .replace(/\bstrateGIc\b/g,"strategic").replace(/\btechnoloGIcal\b/g,"technological").replace(/\benGIneering\b/g,"engineering").replace(/\becoloGIcal\b/g,"ecological").replace(/\bStrateGIc\b/g,"Strategic").replace(/\bforGIngs\b/g,"forgings").replace(/\breGIons\b/g,"regions")
    .replace(/\bq\s+UAN\s+tities\b/g,"quantities").replace(/\s+u\s+(?=[a-z])/g,"; ").replace(/\n-\s+(\d{1,4})\s*\.\s*(?=\n|$)/g,"").replace(/\n{3,}/g,"\n\n").trim();
  cleaned=structureMicroHeadings(cleaned).replace(/\n{3,}/g,"\n\n");
  return highlightMarkdownFacts(cleaned);
}
export default function ArticleContent({content,fallback}) {
  const source=content||fallback||"";
  const strictPdf=isStrictPdfSource(source);
  const value=strictPdf?normalizeStrictPdfMarkdown(source):normalizeMarkdown(source);
  return <div className={`article-rich-content${strictPdf?" strict-pdf-content":""}`}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{h2:({children})=><h2>{children}</h2>,h3:({children})=><h3>{children}</h3>,h4:({children})=><h4>{children}</h4>,p:({children})=><p>{children}</p>,ul:({children})=><ul>{children}</ul>,ol:({children})=><ol>{children}</ol>,li:({children})=><li>{children}</li>,strong:({children})=><strong>{children}</strong>,blockquote:({children})=><blockquote>{children}</blockquote>,a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,table:({children})=><div className="article-table-wrap"><table>{children}</table></div>}}>{value}</ReactMarkdown></div>;
}
