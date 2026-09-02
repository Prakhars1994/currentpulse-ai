function stripMachineMetadata(value = "") {
  let text = String(value || "");
  text = text.replace(/\[\[(?:CA|NEWS)_(?:START|END)\]\]/gi, " ");
  const key = "(?:CA|NEWS)_(?:TITLE|CATEGORY|GS|DATE|IMAGE|SCOPE|SECTION|STYLE)";
  // PDF extraction may flatten several metadata fields onto one line. Stop each
  // value at the next metadata key, a known article heading, or the end.
  text = text.replace(new RegExp(`\\b${key}\\s*:\\s*[\\s\\S]*?(?=\\b${key}\\s*:|\\b(?:WHY\\s+IN\\s+NEWS|TOP\\s+DATA\\s*&\\s*FACTS|HISTORICAL\\s+PERSPECTIVE|ECONOMIC\\s+PERSPECTIVE|GEOGRAPHICAL\\s+PERSPECTIVE|ENVIRONMENTAL\\s+PERSPECTIVE|SOCIAL\\s+PERSPECTIVE|POLITICAL\\s+PERSPECTIVE|PROS|CONS|WAY\\s+FORWARD|PRELIMS\\s+QUICK\\s+REVISION|PROBABLE\\s+(?:PRELIMS|MAINS)\\s+QUESTION)\\b|$)`, "gi"), " ");
  return text;
}
function clean(value = "") {
  return stripMachineMetadata(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
function stripCaDecorators(value = "") {
  return clean(value)
    .replace(/^\s*CURRENT\s+AFFAIRS\s*\d+\s*[:|\-–—]?\s*/i, "")
    .replace(/\s*[:|\-–—]?\s*CURRENT\s+AFFAIRS\s*\d+\s*$/i, "")
    .replace(/^\s*CA\s*\d+\s*[:|\-–—]?\s*/i, "")
    .trim();
}
function sentenceLead(value = "", max = 170) { const text=stripCaDecorators(value);if(!text)return"";const sentence=text.split(/(?<=[.!?])\s+/)[0]||text;const clipped=sentence.length<=max?sentence:sentence.slice(0,max).replace(/\s+\S*$/,"");return clipped.replace(/[,:;\-–—]+\s*$/,"").trim(); }
function looksBrokenNewsTitle(title = "") { const text=clean(title);const words=text.split(/\s+/).filter(Boolean);return !text||words.length<=2||/^[a-z]/.test(text)||/^(?:in|as|and|or|but|to|for|with|from|of|on|at|by)\b/i.test(text)||/^\d+\b/.test(text); }
export function repairedNewsTitle(article={}){const title=clean(article.title);if(!looksBrokenNewsTitle(title))return title;const lead=sentenceLead(article.why_news||article.seo_description,170);return lead||title||"Latest News";}
export function repairedCaTitle(article={}){const title=stripCaDecorators(article.title);if(!title)return"Current Affairs";return title;}
export function cleanPublicExcerpt(value="",title="",limit=220){let text=stripCaDecorators(value).replace(/^\s*(?:Why\s+in\s+News|What\s+happened|The\s+development)\??\s*[:\-–—]?\s*/i,"").trim();text=text.replace(/^\s*(?:Category|GS|Date)\s*:\s*.*?(?=\bWHY\s+IN\s+NEWS\b|$)/i,"").trim();const cleanTitle=stripCaDecorators(title);if(cleanTitle&&text.toLowerCase().startsWith(cleanTitle.toLowerCase()))text=text.slice(cleanTitle.length).replace(/^\s*[:\-–—]?\s*/,"").trim();const duplicateIndex=cleanTitle?text.toLowerCase().indexOf(cleanTitle.toLowerCase()):-1;if(duplicateIndex>=0&&duplicateIndex<120)text=text.slice(duplicateIndex+cleanTitle.length).replace(/^\s*[:\-–—]?\s*/,"").trim();text=text.replace(/^\s*CURRENT\s+AFFAIRS\s*\d+\s*/i,"").trim();if(text.length<=limit)return text;return text.slice(0,limit).replace(/\s+\S*$/,"").replace(/[,:;\-–—]+$/,"").trim()+"…";}
function classifyCategory(text=""){
  const v=clean(text).toLowerCase();
  if(/\b(sco|shanghai cooperation|g20|diplomacy|foreign policy|russia|russian|ukraine|ukrainian|china|chinese|beijing|moscow|kyiv|united states|india-russia|central asia)\b/.test(v))return"International Relations";
  if(/\b(defence|military|missile|drone|warship|navy|submarine|diving support vessel|signals intelligence|air.?defence|armed forces)\b/.test(v))return"Defence & Security";
  if(/\b(nuclear|navic|magnetar|quantum|reactor|satellite|space weather|solar mission|vaccine|technology|science)\b/.test(v))return"Science & Technology";
  if(/hydropower|flood|glacier|climate|biodiversity|forest|wildlife|pollution|environment|himalay|disaster|land degradation|wastewater/.test(v))return"Environment";
  if(/federalism|judiciary|legal metrology|court|parliament|governance|constitution|election|water sharing|inter.?state dispute|creamy layer/.test(v))return"Polity & Governance";
  if(/labour|social security|education|human development|health|jan dhan|e-shram|worker|university|school|welfare|higher education/.test(v))return"Social Issues";
  if(/agriculture|water.?use|fisher|makhana|farm|irrigation|economy|economic|finance|bank|industry|trade|gdp|supply.?chain|manufacturing|critical mineral|food safety|msp|pm-aasha/.test(v))return"Economy";
  if(/sport|cricket|football|hockey|olympic/.test(v))return"Sports";
  if(/history|culture|heritage|archaeolog|temple|festival/.test(v))return"History & Culture";
  return"";
}
export function normalizedPublicCategory(value="",context=""){const contextual=classifyCategory(context);if(contextual)return contextual;const raw=clean(value);return classifyCategory(raw)||raw||"Current Affairs";}
export function normalizedPaper(value=""){return clean(value).replace(/GS\s*PAPER\s*I\b/gi,"GS-I").replace(/GS\s*PAPER\s*II\b/gi,"GS-II").replace(/GS\s*PAPER\s*III\b/gi,"GS-III").replace(/GS\s*PAPER\s*IV\b/gi,"GS-IV").replace(/\s*,\s*/g,", ").trim()||"GS";}
