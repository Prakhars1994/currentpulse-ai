const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const DATE_PATTERNS = [
  new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+20\\d{2}\\b`, "gi"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\s+20\\d{2}\\b`, "gi"),
  /\b20\d{2}-\d{2}-\d{2}\b/g,
];
const ENTITY_STOP = new Set(["The","This","That","These","Those","What","Why","How","When","Where","Who","Key Facts","Context","Background","Significance","CurrentPulse","CurrentPulse AI","News","Article","India","Indian","Government","Officials","Researchers","According"]);

function clean(value = "") { return String(value || "").replace(/<[^>]+>/g, " ").replace(/[*_#>`~]+/g, " ").replace(/\s+/g, " ").trim(); }
function normalize(value = "") { return clean(value).toLowerCase().replace(/[â€™']/g, "").replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim(); }
function sourceText(source = {}) {
  return clean([
    source.title,
    source.description,
    source.content,
    source.source,
    source.sourceName,
    source.publisher,
    ...(Array.isArray(source.sourceReferences)
      ? source.sourceReferences.flatMap((item) => [
          item?.sourceName,
          item?.sourceTitle,
          item?.summary,
          item?.content,
        ])
      : []),
  ].filter(Boolean).join("\n"));
}
function generatedSections(article = {}) {
  return [
    article.title,
    article.why_news,
    article.data_examples,
    article.static_foundation,
    article.india_relevance,
    article.content,
  ].filter(Boolean).map((value) => String(value));
}
function generatedText(article = {}) { return clean(generatedSections(article).join("\n")); }
function explicitDates(value = "") { const values=[]; for (const pattern of DATE_PATTERNS) { pattern.lastIndex=0; for (const match of String(value).matchAll(pattern)) values.push(normalize(match[0])); } return [...new Set(values)]; }
function entitySegments(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_#>`~]+/g, " ")
    .split(/\n+|(?<=[.!?;:])\s+/)
    .map(clean)
    .filter(Boolean);
}
function entities(value = "") {
  const found=new Set();
  for (const text of entitySegments(value)) {
    for (const match of text.matchAll(/\b(?:[A-Z][a-z]{2,}|[A-Z]{2,})(?:[\s-]+(?:[A-Z][a-z]{2,}|[A-Z]{2,})){1,4}\b/g)) { const item=clean(match[0]); if(!ENTITY_STOP.has(item)&&item.length>=5) found.add(item); }
    for (const match of text.matchAll(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g)) { const item=clean(match[0]); if(!ENTITY_STOP.has(item)) found.add(item); }
    for (const match of text.matchAll(/\b[A-Z]{2,8}\b/g)) { const item=match[0]; if(!["AI","CA","PDF","URL","UK","US","USA"].includes(item)) found.add(item); }
  }
  return [...found];
}
function supportedPhrase(phrase, sourceNormalized) { const n=normalize(phrase); if(!n||n.length<4)return true; if(sourceNormalized.includes(n))return true; const words=n.split(" ").filter((w)=>w.length>2); return words.length>=2&&words.every((w)=>sourceNormalized.includes(w)); }

export function assessSourceEntailment(source = {}, article = {}) {
  const sourceValue=sourceText(source), generatedValue=generatedText(article);
  if(!sourceValue||!generatedValue) return {allowed:false,code:"missing_entailment_material",reason:"Source or generated material is empty."};
  const sourceNormalized=normalize(sourceValue);
  const sourceDates=new Set(explicitDates(sourceValue));
  const unsupportedDates=explicitDates(generatedValue).filter((date)=>!sourceDates.has(date));
  if(unsupportedDates.length) return {allowed:false,code:"unsupported_event_date",reason:`Generated News introduced explicit date(s) absent from source text: ${unsupportedDates.slice(0,3).join(", ")}.`};
  const unsupportedEntities=[...new Set(generatedSections(article).flatMap(entities))]
    .filter((entity)=>!supportedPhrase(entity,sourceNormalized))
    .slice(0,12);
  if(unsupportedEntities.length>=2) return {allowed:false,code:"unsupported_named_entities",reason:`Generated News introduced multiple named entities not supported by retained source material: ${unsupportedEntities.slice(0,5).join(", ")}.`};
  return {allowed:true,code:"source_entailment_pass",reason:"No unsupported explicit dates or multiple unsupported named entities were detected."};
}