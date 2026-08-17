import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  enumerateHistoryDates,
  historyDateWindow,
  normalizeHistoryDate,
} from "@/lib/automation/history";
import { APPROVED_UPSC_COVERAGE_SOURCES } from "@/lib/coverage/sourcePolicy";
import { NEWS_SOURCES } from "@/lib/news/sourceCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_AUDIT_DAYS = 62;
const MAX_AUDIT_ROWS = 5000;

function authorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

function dateOnly(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function canonicalSourceName(value = "", kind = "") {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return "Unknown source";
  const catalog = kind === "coaching"
    ? APPROVED_UPSC_COVERAGE_SOURCES
    : NEWS_SOURCES;
  const match = catalog.find((source) =>
    [source.name, source.id]
      .filter(Boolean)
      .some((candidate) => input.includes(String(candidate).toLowerCase()))
  );
  return match?.name || String(value || "Unknown source").trim();
}

function emptyCell(date, source, stream) {
  return {
    date,
    source,
    stream,
    retainedSourceRecords: 0,
    uniqueArticles: new Set(),
    queue: {
      pending: 0,
      processing: 0,
      published: 0,
      rejected: 0,
      failed: 0,
      duplicate: 0,
      other: 0,
    },
  };
}

function publicCell(cell) {
  return {
    ...cell,
    uniqueArticles: cell.uniqueArticles.size,
  };
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised history audit request." },
      { status: 401 }
    );
  }

  const params = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 16 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rawFrom = params.get("from") || defaultFrom;
  const rawTo = params.get("to") || today;
  const from = normalizeHistoryDate(rawFrom);
  const to = normalizeHistoryDate(rawTo);
  const dates = enumerateHistoryDates(from, to, MAX_AUDIT_DAYS + 1);
  if (!from || !to || !dates.length || dates.length > MAX_AUDIT_DAYS) {
    return NextResponse.json(
      {
        success: false,
        message: `Use a valid inclusive date range of at most ${MAX_AUDIT_DAYS} days (YYYY-MM-DD).`,
      },
      { status: 400 }
    );
  }

  const start = historyDateWindow(from)?.start;
  const end = historyDateWindow(to)?.end;
  const supabase = createServerSupabase();
  const [sourceResult, queueResult] = await Promise.all([
    supabase
      .from("article_sources")
      .select(
        "article_id,source_kind,source_name,source_published_at,created_at"
      )
      .gte("source_published_at", start)
      .lt("source_published_at", end)
      .order("source_published_at", { ascending: true })
      .limit(MAX_AUDIT_ROWS),
    supabase
      .from("article_queue")
      .select(
        "article_id,pipeline_kind,source,published_at,status,created_at"
      )
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: true })
      .limit(MAX_AUDIT_ROWS),
  ]);

  if (sourceResult.error || queueResult.error) {
    return NextResponse.json(
      {
        success: false,
        message:
          sourceResult.error?.message ||
          queueResult.error?.message ||
          "History audit query failed.",
      },
      { status: 500 }
    );
  }

  const cells = new Map();
  const uniqueArticleIds = new Set();
  function getCell(date, source, stream) {
    const key = `${date}|${stream}|${source}`;
    if (!cells.has(key)) cells.set(key, emptyCell(date, source, stream));
    return cells.get(key);
  }

  // Pre-create the seven-source CA matrix so missing days are explicit zeros.
  for (const date of dates) {
    for (const source of APPROVED_UPSC_COVERAGE_SOURCES) {
      getCell(date, source.name, "coverage");
    }
  }

  for (const row of sourceResult.data || []) {
    const stream = row.source_kind === "coaching" ? "coverage" : "news";
    const sourceDate = dateOnly(row.source_published_at);
    const date = dates.includes(sourceDate) ? sourceDate : dateOnly(row.created_at);
    if (!dates.includes(date)) continue;
    const source = canonicalSourceName(row.source_name, row.source_kind);
    const cell = getCell(date, source, stream);
    cell.retainedSourceRecords += 1;
    if (row.article_id) {
      cell.uniqueArticles.add(row.article_id);
      uniqueArticleIds.add(row.article_id);
    }
  }

  for (const row of queueResult.data || []) {
    const stream = ["coaching", "coaching_enrichment"].includes(row.pipeline_kind)
      ? "coverage"
      : "news";
    const sourceDate = dateOnly(row.published_at);
    const date = dates.includes(sourceDate) ? sourceDate : dateOnly(row.created_at);
    if (!dates.includes(date)) continue;
    const names = String(row.source || "Unknown source")
      .split(",")
      .map((value) => canonicalSourceName(value, stream === "coverage" ? "coaching" : "news"));
    for (const source of [...new Set(names)]) {
      const cell = getCell(date, source, stream);
      const status = Object.hasOwn(cell.queue, row.status) ? row.status : "other";
      cell.queue[status] += 1;
      if (row.article_id) {
        cell.uniqueArticles.add(row.article_id);
        uniqueArticleIds.add(row.article_id);
      }
    }
  }

  const rows = [...cells.values()]
    .map(publicCell)
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      left.stream.localeCompare(right.stream) ||
      left.source.localeCompare(right.source)
    );
  const totals = rows.reduce(
    (summary, row) => {
      summary.retainedSourceRecords += row.retainedSourceRecords;
      for (const [status, count] of Object.entries(row.queue)) {
        summary.queue[status] = (summary.queue[status] || 0) + count;
      }
      return summary;
    },
    {
      retainedSourceRecords: 0,
      uniqueArticles: uniqueArticleIds.size,
      queue: {},
    }
  );

  return NextResponse.json(
    {
      success: true,
      from,
      to,
      days: dates.length,
      rowLimit: MAX_AUDIT_ROWS,
      truncated:
        (sourceResult.data?.length || 0) >= MAX_AUDIT_ROWS ||
        (queueResult.data?.length || 0) >= MAX_AUDIT_ROWS,
      totals,
      rows,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
