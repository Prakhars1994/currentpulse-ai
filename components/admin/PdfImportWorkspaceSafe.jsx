"use client";

import { useEffect } from "react";
import PdfImportWorkspace from "@/components/admin/PdfImportWorkspace";

const PUBLISH_PATH = "/api/admin/pdf-import/publish";

function isPdfPublishRequest(input, init) {
  const url = typeof input === "string" ? input : input?.url || "";
  return url.includes(PUBLISH_PATH) && String(init?.method || "GET").toUpperCase() === "POST";
}

async function readJsonSafely(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const compact = text.replace(/\s+/g, " ").slice(0, 220);
    throw new Error(
      `Publish API returned HTTP ${response.status} ${response.statusText || ""} as ${contentType || "non-JSON"}. ${compact || "Empty response."}`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Publish API returned invalid JSON (HTTP ${response.status}).`);
  }
}

function aggregate(parts) {
  const results = parts.flatMap((part) => part?.results || []);
  const stats = results.reduce(
    (acc, item) => {
      if (item?.status === "published") acc.published += 1;
      else if (item?.status === "duplicate") acc.duplicates += 1;
      else if (item?.status === "failed") acc.failed += 1;
      return acc;
    },
    { published: 0, duplicates: 0, failed: 0 }
  );
  const warnings = parts.map((part) => part?.readerRefreshWarning).filter(Boolean);
  return {
    success: stats.published + stats.duplicates > 0,
    stats,
    results,
    readerRefreshQueued: parts.some((part) => part?.readerRefreshQueued),
    readerRefreshDurable: parts.some((part) => part?.readerRefreshDurable),
    readerRefreshWarning: warnings[0] || "",
    message:
      `Published ${stats.published}; duplicates ${stats.duplicates}; failed ${stats.failed}.` +
      (warnings.length ? " Articles are in the database; immediate reader refresh may be delayed." : ""),
  };
}

export default function PdfImportWorkspaceSafe() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      if (!isPdfPublishRequest(input, init)) return nativeFetch(input, init);

      let payload;
      try {
        payload = JSON.parse(String(init.body || "{}"));
      } catch {
        return nativeFetch(input, init);
      }

      const articles = Array.isArray(payload?.articles) ? payload.articles : [];
      if (articles.length <= 1) {
        const response = await nativeFetch(input, init);
        if ((response.headers.get("content-type") || "").toLowerCase().includes("application/json")) return response;
        const text = await response.text();
        return new Response(
          JSON.stringify({
            success: false,
            message: `Publish API returned HTTP ${response.status} instead of JSON. ${text.replace(/\s+/g, " ").slice(0, 180)}`,
          }),
          { status: response.ok ? 502 : response.status, headers: { "Content-Type": "application/json" } }
        );
      }

      // Cloudflare-safe publishing: commit one article per request. This prevents a
      // long 8-20 article request from ending as an HTML timeout/error page. Each
      // successful article is durable before the next begins, so retries are safe.
      const parts = [];
      for (const article of articles) {
        const response = await nativeFetch(input, {
          ...init,
          headers: { ...(init.headers || {}), "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, articles: [article] }),
        });
        try {
          const data = await readJsonSafely(response);
          parts.push(data);
          // Continue after article-level failures/duplicates; stop only for an
          // authentication/server response that contains no per-article result.
          if (!response.ok && !data?.results) break;
        } catch (error) {
          parts.push({
            success: false,
            stats: { published: 0, duplicates: 0, failed: 1 },
            results: [{ status: "failed", importIndex: article?.importIndex, title: article?.title, error: error.message }],
          });
          break;
        }
      }

      const data = aggregate(parts);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return <PdfImportWorkspace />;
}
