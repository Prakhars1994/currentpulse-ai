import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";
import { classifyCategoryWithConfidence, resolvePaper } from "@/lib/contentTaxonomy";
import { filterRelevantMapLocations, normaliseMapLocations } from "@/lib/study/mapRelevance";
import { assessArticleQuality } from "@/lib/ai/articleQuality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const auth = request.headers.get("authorization")?.trim() || "";
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

function text(article = {}) {
  return [
    article.title,
    article.why_news,
    article.static_foundation,
    article.data_examples,
    article.prelims,
    article.mains,
  ].filter(Boolean).join(" ");
}

function flagsWith(existing, flag) {
  const values = Array.isArray(existing) ? existing : [];
  return [...new Set([...values, flag])];
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorised quality repair request." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const apply = ["1", "true", "yes"].includes((searchParams.get("apply") || "").toLowerCase());
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 1200, 1), 2000);
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,static_foundation,data_examples,prelims,mains,answer_framework,question,map_locations,quality_score,quality_flags,quality_version,created_at,article_sources!inner(source_kind,source_url,source_title)")
    .eq("status", "published")
    .eq("article_sources.source_kind", "coaching")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ success: false, message: `Quality repair scan failed: ${error.message}` }, { status: 500 });
  }

  const actions = [];
  for (const article of data || []) {
    const source = article.article_sources?.[0] || {};
    const combined = text(article);
    const inspection = inspectCoverageCandidate({
      title: article.title,
      summary: combined,
      url: source.source_url,
    });

    if (!inspection.accepted) {
      const action = {
        id: article.id,
        slug: article.slug,
        title: article.title,
        action: "quarantine_source_noise",
        reason: inspection.reason,
        flags: inspection.flags,
      };
      actions.push(action);
      if (apply) {
        const { error: updateError } = await supabase.from("articles").update({
          status: "draft",
          quality_score: Math.min(Number(article.quality_score || 0), 25),
          quality_flags: flagsWith(article.quality_flags, "quarantined_source_noise"),
          updated_at: new Date().toISOString(),
        }).eq("id", article.id);
        if (updateError) action.error = updateError.message;
      }
      continue;
    }

    const quality = assessArticleQuality(article, { mode: "upsc" });
    const severeQualityFailure =
      quality.score < 45 ||
      ["article_too_short", "insufficient_data_or_examples", "weak_exam_utility"]
        .every((flag) => quality.flags.includes(flag));

    if (severeQualityFailure) {
      const action = {
        id: article.id,
        slug: article.slug,
        title: article.title,
        action: "quarantine_quality_floor",
        reason: `Below publication quality floor (${quality.score}/100).`,
        flags: quality.flags,
        metrics: quality.metrics,
      };
      actions.push(action);
      if (apply) {
        const { error: updateError } = await supabase.from("articles").update({
          status: "draft",
          quality_score: quality.score,
          quality_flags: [...new Set([...(article.quality_flags || []), ...quality.flags, "quarantined_quality_floor_v4"])],
          quality_version: 4,
          updated_at: new Date().toISOString(),
        }).eq("id", article.id);
        if (updateError) action.error = updateError.message;
      }
      continue;
    }

    const classification = classifyCategoryWithConfidence(combined, article.category);
    const cleanedMaps = filterRelevantMapLocations({
      title: article.title,
      category: classification.category,
      text: combined,
      mapLocations: article.map_locations,
    });
    const originalMaps = normaliseMapLocations(article.map_locations);
    const categoryChanged = classification.confident && classification.category !== article.category;
    const mapChanged = JSON.stringify(cleanedMaps) !== JSON.stringify(originalMaps);
    const qualityNeedsUpgrade = !quality.passed;

    if (!categoryChanged && !mapChanged && !qualityNeedsUpgrade) continue;

    const action = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      action: "repair",
      quality: qualityNeedsUpgrade ? { score: quality.score, flags: quality.flags } : null,
      category: categoryChanged ? { from: article.category, to: classification.category, confidence: classification } : null,
      maps: mapChanged ? { from: originalMaps, to: cleanedMaps } : null,
    };
    actions.push(action);

    if (apply) {
      const values = {
        updated_at: new Date().toISOString(),
        quality_score: quality.score,
        quality_flags: quality.passed
          ? article.quality_flags
          : [...new Set([...(article.quality_flags || []), ...quality.flags, "needs_quality_upgrade_v4"])],
        quality_version: quality.passed ? Math.max(Number(article.quality_version || 0), 4) : 1,
      };
      if (categoryChanged) {
        values.category = classification.category;
        values.paper = resolvePaper(classification.category, "");
        values.quality_flags = [...new Set([...(values.quality_flags || []), "taxonomy_repaired_v4"])];
      }
      if (mapChanged) values.map_locations = cleanedMaps;
      const { error: updateError } = await supabase.from("articles").update(values).eq("id", article.id);
      if (updateError) action.error = updateError.message;
    }
  }

  return NextResponse.json({
    success: true,
    mode: apply ? "applied" : "dry_run",
    scanned: data?.length || 0,
    sourceQuarantines: actions.filter((item) => item.action === "quarantine_source_noise").length,
    qualityQuarantines: actions.filter((item) => item.action === "quarantine_quality_floor").length,
    repairs: actions.filter((item) => item.action === "repair").length,
    errors: actions.filter((item) => item.error).length,
    actions: actions.slice(0, 250),
    message: apply
      ? "Quality repair applied. Quarantined rows are drafts and disappear from public streams/sitemaps."
      : "Dry run only. Re-run with ?apply=true after reviewing the actions.",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
