import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";
import { filterRelevantMapLocations, normaliseMapLocations } from "@/lib/study/mapRelevance";
import { assessArticleQuality } from "@/lib/ai/articleQuality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_MAINTENANCE_ROWS = 120;
const MAINTENANCE_WRITE_CONCURRENCY = 4;
const MAINTENANCE_DEADLINE_MS = 110000;

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
function hasLowValueEvidence(article = {}) { const value = String(article.data_examples || ""); return /\bpotentially bring economic benefits\b/i.test(value) || /\bdata\s*:\s*(?:institution|year|economic_benefit)\b/i.test(value) || /\binstitution\s*:\s*Indian government\b/i.test(value) || /\beconomic_benefit\s*:\s*potential/i.test(value); }

async function mapWithConcurrency(items, limit, handler) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await handler(items[current], current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorised quality repair request." }, { status: 401 });
  }

  const maintenanceDeadline = Date.now() + MAINTENANCE_DEADLINE_MS;
  let deadlineExhausted = false;

  const { searchParams } = new URL(request.url);
  const apply = ["1", "true", "yes"].includes(
    (searchParams.get("apply") || "").toLowerCase()
  );
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || MAX_MAINTENANCE_ROWS, 1),
    MAX_MAINTENANCE_ROWS
  );
  const rawBefore = searchParams.get("before") || "";
  const parsedBefore = rawBefore ? new Date(rawBefore) : null;
  const before =
    parsedBefore && !Number.isNaN(parsedBefore.getTime())
      ? parsedBefore.toISOString()
      : null;
  const supabase = createServerSupabase();

  let scanQuery = supabase
    .from("articles")
    .select("id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,static_foundation,data_examples,prelims,mains,answer_framework,question,map_locations,quality_score,quality_flags,quality_version,created_at,article_sources!inner(source_kind,source_url,source_title)")
    .eq("status", "published")
    .eq("manual_protected", false)
    .eq("article_sources.source_kind", "coaching")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    scanQuery = scanQuery.lt("created_at", before);
  }

  const { data, error } = await scanQuery;
  const nextBefore =
    data?.length ? data[data.length - 1]?.created_at || null : null;
  const hasMore =
    Boolean(nextBefore) && (data?.length || 0) === limit;

  if (error) {
    return NextResponse.json({ success: false, message: `Quality repair scan failed: ${error.message}` }, { status: 500 });
  }

  const actions = [];
  const pendingWrites = [];
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
        pendingWrites.push({ action, id: article.id, values: {
          status: "draft",
          quality_score: Math.min(Number(article.quality_score || 0), 25),
          quality_flags: flagsWith(article.quality_flags, "quarantined_source_noise"),
          updated_at: new Date().toISOString(),
        } });
      }
      continue;
    }

    const quality = assessArticleQuality(article, { mode: "upsc" });
    const severeQualityFailure =
      quality.score < 60 ||
      quality.flags.includes("editorial_residue") ||
      quality.flags.includes("repetitive_sections") ||
      (quality.flags.includes("insufficient_data_or_examples") && quality.flags.includes("weak_exam_utility")) ||
      hasLowValueEvidence(article);

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
        pendingWrites.push({ action, id: article.id, values: {
          status: "draft",
          quality_score: quality.score,
          quality_flags: [...new Set([...(article.quality_flags || []), ...quality.flags, "quarantined_quality_floor_v4"])],
          quality_version: 4,
          updated_at: new Date().toISOString(),
        } });
      }
      continue;
    }

    // Editorial cleanup is the single authority for category/paper changes.
    // Quality repair may quarantine weak content and repair maps/quality flags,
    // but it must never fight the taxonomy pass by reclassifying the same row.
    const cleanedMaps = filterRelevantMapLocations({
      title: article.title,
      category: article.category,
      text: combined,
      mapLocations: article.map_locations,
    });
    const originalMaps = normaliseMapLocations(article.map_locations);
    const mapChanged = JSON.stringify(cleanedMaps) !== JSON.stringify(originalMaps);
    const qualityNeedsUpgrade = !quality.passed;

    if (!mapChanged && !qualityNeedsUpgrade) continue;

    const action = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      action: "repair",
      quality: qualityNeedsUpgrade ? { score: quality.score, flags: quality.flags } : null,
      category: null,
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
        quality_version: Math.max(Number(article.quality_version || 0), 4),
      };
      if (mapChanged) values.map_locations = cleanedMaps;
      pendingWrites.push({ action, id: article.id, values });
    }
  }

  if (apply) {
    await mapWithConcurrency(
      pendingWrites,
      MAINTENANCE_WRITE_CONCURRENCY,
      async ({ action, id, values }) => {
        if (Date.now() >= maintenanceDeadline) {
          deadlineExhausted = true;
          return;
        }
        const { error: updateError } = await supabase
          .from("articles")
          .update(values)
          .eq("id", id);
        if (updateError) action.error = updateError.message;
      }
    );
  }

  return NextResponse.json({
    success: true,
    mode: apply ? "applied" : "dry_run",
    scanned: data?.length || 0,
    pagination: {
      limit,
      before,
      nextBefore: deadlineExhausted ? before : nextBefore,
      hasMore: deadlineExhausted || hasMore,
      deadlineExhausted,
    },
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
