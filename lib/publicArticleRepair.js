function clean(value = "") {
  return String(value || "")
    .replace(/\[\[(?:CA|NEWS)_(?:START|END)\]\]/gi, " ")
    .replace(/\b(?:CA|NEWS)_(?:TITLE|CATEGORY|GS|DATE|IMAGE|SCOPE|SECTION|STYLE)\s*:\s*[^\n\r]*/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
function sentenceLead(value = "", max = 170) { const text=clean(value);if(!text)return"";const sentence=text.split(/(?<=[.!?])\s+/)[0]||text;const clipped=sentence.length<=max?sentence:sentence.slice(0,max).replace(/\s+\S*$/,"");return clipped.replace(/[,:;\-–—]+\s*$/,"").trim(); }
function looksBrokenNewsTitle(title = "") { const text=clean(title);const words=text.split(/\s+/).filter(Boolean);return !text||words.length<=2||/^[a-z]/.test(text)||/^(?:in|as|and|or|but|to|for|with|from|of|on|at|by)\b/i.test(text)||/^\d+\b/.test(text); }
export function repairedNewsTitle(article={}){const title=clean(article.title);if(!looksBrokenNewsTitle(title))return title;const lead=sentenceLead(article.why_news||article.seo_description,170);return lead||title||"Latest News";}
export function repairedCaTitle(article={}){const title=clean(article.title);const body=clean(article.why_news||article.content);if(!title||!body)return title;const titleIndex=body.toLowerCase().indexOf(title.toLowerCase());if(titleIndex>0&&titleIndex<=100){const prefix=body.slice(0,titleIndex).trim().replace(/[|:;\-–—]+$/,"").trim();const prefixWords=prefix.split(/\s+/).filter(Boolean);if(prefix&&prefixWords.length<=12&&!/[.!?]/.test(prefix))return `${title} ${prefix}`.replace(/\s+/g," ").trim();}return title;}
export function cleanPublicExcerpt(value="",title="",limit=220){let text=clean(value).replace(/^\s*(?:Why\s+in\s+News|What\s+happened|The\s+development)\??\s*[:\-–—]?\s*/i,"").trim();const cleanTitle=clean(title);if(cleanTitle&&text.toLowerCase().startsWith(cleanTitle.toLowerCase()))text=text.slice(cleanTitle.length).replace(/^\s*[:\-–—]?\s*/,"").trim();const duplicateIndex=cleanTitle?text.toLowerCase().indexOf(cleanTitle.toLowerCase()):-1;if(duplicateIndex>=0&&duplicateIndex<100)text=text.slice(duplicateIndex+cleanTitle.length).replace(/^\s*[:\-–—]?\s*/,"").trim();if(text.length<=limit)return text;return text.slice(0,limit).replace(/\s+\S*$/,"").replace(/[,:;\-–—]+$/,"").trim()+"…";}
function classifyCategory(text=""){
  const v=clean(text).toLowerCase();
  if(/space|nuclear|technology|science|navic|magnetar|quantum|reactor|satellite|vaccine/.test(v))return"Science & Technology";
  if(/hydropower|flood|glacier|climate|biodiversity|forest|wildlife|pollution|environment|himalay|disaster/.test(v))return"Environment";
  if(/defence|military|missile|drone|warship|navy|submarine|diving support vessel|signals intelligence|air.?defence/.test(v))return"Defence & Security";
  if(/international|diplomacy|russia|china|ukraine|g20|sco|shanghai cooperation|foreign policy|united states|beijing|moscow|kyiv/.test(v))return"International Relations";
  if(/federalism|judiciary|legal metrology|court|parliament|governance|constitution|election|water sharing|inter.?state dispute/.test(v))return"Polity & Governance";
  if(/labour|social security|education|human development|health|jan dhan|e-shram|worker|university|school|welfare/.test(v))return"Social Issues";
  if(/agriculture|water.?use|fisher|makhana|farm|irrigation|economy|economic|finance|bank|industry|trade|gdp|supply.?chain|manufacturing|critical mineral|food safety/.test(v))return"Economy";
  if(/sport|cricket|football|hockey|olympic/.test(v))return"Sports";
  if(/history|culture|heritage|archaeolog|temple|festival/.test(v))return"History & Culture";
  return"";
}
export function normalizedPublicCategory(value="",context=""){const contextual=classifyCategory(context);if(contextual)return contextual;const raw=clean(value);return classifyCategory(raw)||raw||"Current Affairs";}
export function normalizedPaper(value=""){return clean(value).replace(/GS\s*PAPER\s*I\b/gi,"GS-I").replace(/GS\s*PAPER\s*II\b/gi,"GS-II").replace(/GS\s*PAPER\s*III\b/gi,"GS-III").replace(/GS\s*PAPER\s*IV\b/gi,"GS-IV").replace(/\s*,\s*/g,", ").trim()||"GS";}
