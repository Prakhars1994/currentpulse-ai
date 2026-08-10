import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  assessPublishedArticle,
  publicArticleText,
} from "@/lib/editorial/publicationSafety";
import { correctTaxonomy } from "@/lib/contentTaxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ARTICLE_FIELDS = `
  id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,
  static_foundation,data_examples,prelims,mains,answer_framework,question,
  visual_summary,memory_trick,content,seo_description,created_at,status,
  article_sources(source_kind,source_url)
`;

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

  for (const article of data || []) {
    const stream = articleStream(article);
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

    const taxonomy = correctTaxonomy(
      publicArticleText(article),
      article.category,
      article.paper
    );
    if (
      taxonomy.overridden &&
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
  }

  let quarantined = 0;
  let taxonomyUpdated = 0;
  if (apply) {
    const now = new Date().toISOString();
    for (const idGroup of chunks(quarantine.map((item) => item.id), 100)) {
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
      quarantined += updated?.length || 0;
    }

    for (const correction of taxonomyCorrections) {
      const { error: taxonomyError } = await supabase
        .from("articles")
        .update({
          category: correction.to.category,
          paper: correction.to.paper,
          updated_at: now,
        })
        .eq("id", correction.id);
      if (!taxonomyError) taxonomyUpdated += 1;
      else console.error(`[Editorial cleanup] Taxonomy update failed for ${correction.id}:`, taxonomyError.message);
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
    },
    applied: { quarantined, taxonomyUpdated },
    quarantine: quarantine.slice(0, 200),
    taxonomyCorrections: taxonomyCorrections.slice(0, 200),
    message: apply
      ? "Strict noise was moved to draft and deterministic taxonomy overrides were applied."
      : "Preview only. Run with apply=1 to move strict noise to draft and apply taxonomy overrides.",
  });
}
