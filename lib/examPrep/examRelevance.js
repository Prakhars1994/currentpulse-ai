
import { getExamVertical } from "@/lib/examPrep/sourceRegistry";

function articleText(article = {}) {
  return [
    article.title, article.category, article.paper, article.why_news,
    article.static_foundation, article.data_examples, article.prelims, article.mains,
    ...(Array.isArray(article.tags) ? article.tags : []),
    ...(article.article_sources || []).flatMap((source) => [source?.source_name, source?.source_title]),
  ].filter(Boolean).join(" ").toLowerCase();
}

const COMMON = /\b(?:appointment|award|honou?r|sports|tournament|championship|book|author|scheme|mission|ministry|cabinet|rank|index|report|important day|theme|festival|summit|country|capital|currency|river|lake|mountain|dam|national park|wildlife|science|space|isro|defence|missile|constitution|parliament|economy|gdp|inflation)\b/i;
const BANKING = /\b(?:rbi|reserve bank|banking|bank|nbfc|repo|crr|slr|monetary policy|financial inclusion|upi|npci|sebi|bond|g-sec|forex|currency|fintech|insurance|ibps|sbi|nabard)\b/i;
const RAILWAY = /\b(?:railway|railways|rrb|train|locomotive|vande bharat|freight|rail corridor|railway station|metro|transport|physics|chemistry|biology)\b/i;
const STATE = /\b(?:state government|chief minister|governor|state assembly|district|state scheme|state psc|uppsc|bpsc|rpsc|mppsc)\b/i;

export function articleMatchesExam(article = {}, exam = "upsc") {
  const slug = getExamVertical(exam).slug;
  const text = articleText(article);
  if (slug === "upsc") return true;

  const tags = Array.isArray(article.tags) ? article.tags.map(String) : [];
  if (tags.includes(`exam:${slug}`)) return true;

  if (slug === "banking") return BANKING.test(text) || COMMON.test(text);
  if (slug === "railway") return RAILWAY.test(text) || COMMON.test(text);
  if (slug === "ssc") return COMMON.test(text) || BANKING.test(text);
  if (slug === "state-pcs") return STATE.test(text) || COMMON.test(text) || BANKING.test(text);
  return true;
}
