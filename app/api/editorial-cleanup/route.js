import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  assessPublishedArticle,
  publicArticleText,
  sanitizeEditorialText,
} from "@/lib/editorial/publicationSafety";
import { classifyNewsCategory, correctTaxonomy } from "@/lib/contentTaxonomy";
import {
  hasClearlyStaleSource,
  isObviousLowValueNews,
} from "@/lib/news/newsQuality";
import { isSameEvent } from "@/lib/news/eventCluster";
import { assessNewsOutputQuality } from "@/lib/news/newsOutputQuality";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ARTICLE_FIELDS = `
  id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,
  static_foundation,data_examples,prelims,mains,answer_framework,question,
  visual_summary,memory_trick,content,seo_description,map_locations,created_at,updated_at,
  views,quality_score,quality_flags,status,
  article_sources(id,source_kind,source_name,source_url,source_published_at,event_key)
`;

const SANITIZABLE_FIELDS = ["why_news","syllabus_linkage","india_relevance","static_foundation","data_examples","prelims","mains","answer_framework","question","visual_summary","memory_trick","seo_description"];
const KNOWN_QUARANTINE_SLUGS = new Set(["new-fruit-salad-trends-emerge-as-chefs-experiment-with-global-flavors","jellyfish-hit-french-nuclear-plant-shuts-down-three-reactors","2-ex-chinese-military-personnel-arrested-in-south-korea-for-alleged-espionage","bashar-al-assad-atef-najib-sentenced-to-death-in-landmark-syria-trial","india-must-redefine-its-cities-before-urban-growth-outpaces-governance"]);
const HANDLOOM_SLUG="indias-handloom-heritage-and-rural-livelihoods-national-handloom-day-2026";
const HALLANIYAT_SLUG="hallaniyat-islands-a-pristine-ecosystem-threatened-by-oil-spill";
function knownEditorialRepair(article={}){if(KNOWN_QUARANTINE_SLUGS.has(article.slug))return{quarantine:true,code:"known_audit_failure",reason:"Live audit identified this row as unsupported, broken or below the minimum public quality standard.",values:{}};const publicText=publicArticleText(article);if(/solar eclipse/i.test(publicText)&&/August\s+11,\s*2026/i.test(publicText))return{quarantine:true,code:"event_date_confusion",reason:"Source publication date was confused with the event date.",values:{}};const values={};if(article.slug===HANDLOOM_SLUG){for(const field of [...SANITIZABLE_FIELDS,"content"]){if(typeof article[field]!=="string"||!article[field])continue;const repaired=article[field].replace(/35\.22\s+lakh\s+handloom\s+households/gi,"31.45 lakh handloom households").replace(/Number of handloom households\s*:\s*35\.22\s+lakh/gi,"Number of handloom households: 31.45 lakh");if(repaired!==article[field])values[field]=repaired;}}if(article.slug===HALLANIYAT_SLUG)values.map_locations=["Hallaniyat Islands","Dhofar","Oman"];return{quarantine:false,values};}

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";
  return Boolean(configuredSecret) && authorization === `Bearer ${configuredSecret}`;
}

function articleStream(article = {}) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "coaching"
  ) ? "coverage" : "news";
}

function streamLabels(article = {}) {
  const sources = article.article_sources || [];
  const labels = new Set();
  if (sources.some((source) => source?.source_kind === "coaching")) labels.add("coverage");
  if (sources.some((source) => source?.source_kind === "news") || sources.length === 0) labels.add("news");
  return labels;
}

function sharesStream(left, right) {
  const leftLabels = streamLabels(left);
  return [...streamLabels(right)].some((label) => leftLabels.has(label));
}

function newestSourceDate(article = {}, sourceKind = "") {
  return (article.article_sources || [])
    .filter((source) => !sourceKind || source?.source_kind === sourceKind)
    .map((source) => source?.source_published_at)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;
}

function hasMisleadingOldHeadlineYear(article = {}) {
  const publication = new Date(article.created_at || 0);
  if (Number.isNaN(publication.getTime())) return false;
  const publicationYear = publication.getUTCFullYear();
  const text = `${article.title || ""} ${article.why_news || ""}`;
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (!years.some((year) => year <= publicationYear - 2)) return false;
  if (years.includes(publicationYear)) return false;
  return !/\b(?:since|anniversary|retrospective|review|legacy|years? after|impact of|revisits?)\b/i.test(text);
}

function sanitizedFieldUpdates(article = {}) {
  const updates = {};
  for (const field of SANITIZABLE_FIELDS) {
    if (typeof article[field] !== "string" || !article[field]) continue;
    const sanitized = sanitizeEditorialText(article[field]);
    if (sanitized !== article[field]) updates[field] = sanitized;
  }
  return updates;
}

function eventInput(article = {}) {
  return {
    title: article.title,
    description: `${article.why_news || ""} ${article.data_examples || ""}`,
    publishedAt:
      newestSourceDate(article) ||
      article.created_at,
  };
}

function keeperScore(article = {}) {
  const fields = [
    article.why_news,
    article.static_foundation,
    article.data_examples,
    article.prelims,
    article.mains,
    article.answer_framework,
    article.content,
  ];
  const knowledgeLength = fields.reduce((total, value) => total + String(value || "").length, 0);
  const sourceCount = (article.article_sources || []).length;
  return (
    Number(article.quality_score || 0) * 20 +
    sourceCount * 120 +
    Math.min(knowledgeLength, 20000) / 10 +
    Math.min(Number(article.views || 0), 10000) / 10
  );
}

function findDuplicateGroups(articles = []) {
  const clusters = [];
  for (const article of articles) {
    const cluster = clusters.find((candidate) =>
      candidate.some((existing) =>
        sharesStream(article, existing) && isSameEvent(eventInput(article), eventInput(existing))
      )
    );
    if (cluster) cluster.push(article);
    else clusters.push([article]);
  }

  return clusters
    .filter((cluster) => cluster.length > 1)
    .map((cluster) => {
      const ranked = [...cluster].sort((left, right) => keeperScore(right) - keeperScore(left));
      return { keeper: ranked[0], duplicates: ranked.slice(1) };
    });
}

function chunks(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised editorial cleanup request." },
      { status: 401 }
    );
  }

  const params = new URL(request.url).searchParams;
  const apply = params.get("apply") === "1";
  const requestedLimit = Number(params.get("limit") || 3000);
  const limit = Math.max(1, Math.min(requestedLimit || 3000, 5000));
  const lookbackDays = Math.max(1, Math.min(Number(params.get("days") || 120), 3650));
  const supabase = createServerSupabase();
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .eq("status", "published")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { success: false, message: `Editorial cleanup scan failed: ${error.message}` },
      { status: 500 }
    );
  }

  const quarantine = [];
  const taxonomyCorrections = [];
  const sanitizationUpdates = [];
  const knownRepairs = [];
  const safeArticles = [];

  for (const article of data || []) {
    const stream = articleStream(article);
    const known = knownEditorialRepair(article);
    if (known.quarantine) { quarantine.push({id:article.id,slug:article.slug,title:article.title,stream,code:known.code,reason:known.reason}); continue; }
    if (Object.keys(known.values || {}).length) knownRepairs.push({id:article.id,slug:article.slug,title:article.title,values:known.values,fields:Object.keys(known.values)});
    const assessment = assessPublishedArticle(article, { stream });
    if (!assessment.allowed) {
      quarantine.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        stream,
        code: assessment.code,
        reason: assessment.reason,
      });
      continue;
    }

    const labels = streamLabels(article);

    if (labels.has("coverage")) {
      const coverageShape = inspectCoverageCandidate({
        title: article.title,
        summary: `${article.why_news || ""} ${article.static_foundation || ""}`,
        url: (article.article_sources || []).find(
          (source) => source?.source_kind === "coaching"
        )?.source_url || "",
      });
      if (coverageShape.flags.includes("multi_topic_bundle")) {
        quarantine.push({
          id: article.id,
          slug: article.slug,
          title: article.title,
          stream: "coverage",
          code: "multi_topic_bundle",
          reason: "A multi-topic digest wrapper must not remain a single Current Affairs article.",
        });
        continue;
      }
    }

    if (labels.has("news") && !labels.has("coverage")) {
      const outputQuality = assessNewsOutputQuality(article);
      const lowValue = isObviousLowValueNews(article);
      const stale = hasClearlyStaleSource(article) || hasMisleadingOldHeadlineYear(article);
      if (!outputQuality.allowed || lowValue || stale) {
        quarantine.push({
          id: article.id,
          slug: article.slug,
          title: article.title,
          stream: "news",
          code: !outputQuality.allowed
            ? outputQuality.code
            : lowValue
              ? "routine_operational_news"
              : "stale_news",
          reason: !outputQuality.allowed
            ? outputQuality.reason
            : "The published row is routine operational noise or an old development surfaced as fresh news.",
        });
        continue;
      }
    }

    const sanitizedFields = sanitizedFieldUpdates(article);
    if (Object.keys(sanitizedFields).length) {
      sanitizationUpdates.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        fields: Object.keys(sanitizedFields),
        values: sanitizedFields,
      });
    }

    const taxonomyText = publicArticleText({ ...article, ...sanitizedFields });
    const taxonomy = stream === "news"
      ? {
          category: classifyNewsCategory(taxonomyText, article.category),
          paper: "Prelims",
        }
      : correctTaxonomy(
          taxonomyText,
          article.category,
          article.paper
        );
    if (
      (taxonomy.category !== article.category || taxonomy.paper !== article.paper)
    ) {
      taxonomyCorrections.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        from: { category: article.category, paper: article.paper },
        to: { category: taxonomy.category, paper: taxonomy.paper },
      });
    }
    safeArticles.push(article);
  }

  const duplicateGroups = findDuplicateGroups(safeArticles);
  const duplicateFindings = duplicateGroups.flatMap(({ keeper, duplicates }) =>
    duplicates.map((duplicate) => ({
      keeper: { id: keeper.id, slug: keeper.slug, title: keeper.title },
      duplicate: { id: duplicate.id, slug: duplicate.slug, title: duplicate.title },
      sharedStreams: [...streamLabels(keeper)].filter((label) => streamLabels(duplicate).has(label)),
    }))
  );

  let quarantined = 0;
  let taxonomyUpdated = 0;
  let sanitized = 0;
  let duplicatesDrafted = 0;
  let sourcesMerged = 0;
  const applyWarnings = [];
  if (apply) {
    const now = new Date().toISOString();

    const updatesById = new Map();
    for (const item of sanitizationUpdates) {
      updatesById.set(item.id, { ...(updatesById.get(item.id) || {}), ...item.values });
    }
    for (const correction of taxonomyCorrections) {
      updatesById.set(correction.id, { ...(updatesById.get(correction.id) || {}), category: correction.to.category, paper: correction.to.paper });
    }
    for (const repair of knownRepairs) updatesById.set(repair.id,{...(updatesById.get(repair.id)||{}),...repair.values});

    for (const [articleId, values] of updatesById) {
      const { error: updateError } = await supabase
        .from("articles")
        .update({ ...values, updated_at: now })
        .eq("id", articleId);
      if (updateError) {
        applyWarnings.push(`Article ${articleId} editorial update failed: ${updateError.message}`);
        continue;
      }
      if (sanitizationUpdates.some((item) => item.id === articleId)) sanitized += 1;
      if (taxonomyCorrections.some((item) => item.id === articleId)) taxonomyUpdated += 1;
    }

    const deduplicatedIds = [];
    for (const finding of duplicateFindings) {
      const keeperId = finding.keeper.id;
      const duplicateId = finding.duplicate.id;
      const { data: movedSources, error: sourceMoveError } = await supabase
        .from("article_sources")
        .update({ article_id: keeperId, updated_at: now })
        .eq("article_id", duplicateId)
        .select("id");
      if (sourceMoveError) {
        applyWarnings.push(`Duplicate ${duplicateId} source merge failed: ${sourceMoveError.message}`);
        continue;
      }
      sourcesMerged += movedSources?.length || 0;

      const queueArticleUpdate = await supabase
        .from("article_queue")
        .update({ article_id: keeperId, updated_at: now })
        .eq("article_id", duplicateId);
      if (queueArticleUpdate.error) {
        applyWarnings.push(`Duplicate ${duplicateId} queue article link update failed: ${queueArticleUpdate.error.message}`);
      }
      const queueTargetUpdate = await supabase
        .from("article_queue")
        .update({ target_article_id: keeperId, updated_at: now })
        .eq("target_article_id", duplicateId);
      if (queueTargetUpdate.error) {
        applyWarnings.push(`Duplicate ${duplicateId} queue target update failed: ${queueTargetUpdate.error.message}`);
      }
      deduplicatedIds.push(duplicateId);
    }

    const quarantineIds = [...new Set(quarantine.map((item) => item.id))];
    for (const idGroup of chunks([...new Set([...quarantineIds, ...deduplicatedIds])], 100)) {
      const { data: updated, error: updateError } = await supabase
        .from("articles")
        .update({ status: "draft", updated_at: now })
        .in("id", idGroup)
        .select("id");
      if (updateError) {
        return NextResponse.json(
          { success: false, message: `Quarantine update failed: ${updateError.message}` },
          { status: 500 }
        );
      }
      const updatedIds = new Set((updated || []).map((row) => row.id));
      quarantined += quarantineIds.filter((id) => updatedIds.has(id)).length;
      duplicatesDrafted += deduplicatedIds.filter((id) => updatedIds.has(id)).length;
    }
  }

  return NextResponse.json({
    success: true,
    mode: apply ? "apply" : "preview",
    scanned: data?.length || 0,
    lookbackDays,
    findings: {
      quarantine: quarantine.length,
      taxonomyCorrections: taxonomyCorrections.length,
      sanitizationUpdates: sanitizationUpdates.length,
      knownRepairs: knownRepairs.length,
      duplicateGroups: duplicateGroups.length,
      duplicateArticles: duplicateFindings.length,
    },
    applied: {
      quarantined,
      taxonomyUpdated,
      sanitized,
      duplicatesDrafted,
      sourcesMerged,
    },
    quarantine: quarantine.slice(0, 200),
    taxonomyCorrections: taxonomyCorrections.slice(0, 200),
    sanitizationUpdates: sanitizationUpdates.slice(0, 200).map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      fields: item.fields,
    })),
    duplicateFindings: duplicateFindings.slice(0, 200),
    warnings: applyWarnings.slice(0, 100),
    message: apply
      ? "Unsafe rows were quarantined, taxonomy and leaked/promotional text were repaired, and same-event duplicates were consolidated without deleting records."
      : "Preview only. Run with apply=1 to quarantine unsafe rows, repair taxonomy/text and consolidate same-event duplicates.",
  });
}
