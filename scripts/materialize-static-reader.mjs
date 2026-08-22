import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const base = String(arg("--base", process.env.STATIC_READER_BASE || "http://127.0.0.1:3100"))
  .replace(/\/+$/, "");
const outDir = path.resolve(arg("--out", ".open-next/assets"));
const reuseBase = String(
  arg("--reuse-base", process.env.STATIC_READER_REUSE_BASE || "")
).replace(/\/+$/, "");
const freshDays = Math.max(
  1,
  Math.min(30, Number(arg("--fresh-days", "3")) || 3)
);
const reuseBefore = Date.now() - freshDays * 86_400_000;
const reuseLocal = ["1", "true", "yes"].includes(
  String(arg("--reuse-local", process.env.STATIC_READER_REUSE_LOCAL || "0")).toLowerCase()
);
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseServiceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const maxPages = Math.max(
  25,
  Math.min(
    2500,
    Number(
      arg(
        "--max-pages",
        process.env.STATIC_READER_MAX_PAGES || 1200
      )
    ) || 1200
  )
);
const concurrency = Math.max(
  1,
  Math.min(4, Number(arg("--concurrency", "3")) || 3)
);
const requestTimeoutMs = Math.max(
  4000,
  Math.min(
    15000,
    Number(arg("--timeout-ms", "10000")) || 10000
  )
);
const budgetSeconds = Math.max(
  60,
  Math.min(
    1800,
    Number(arg("--budget-seconds", "720")) || 720
  )
);
const materializationBudgetMs = budgetSeconds * 1000;
const materializationStartedAt = Date.now();
const generatedAt = new Date().toISOString();

const CORE_PATHS = [
  "/",
  "/current-affairs",
  "/news",
  "/exams",
  "/quiz",
  "/pdf",
  "/contact",
  "/ai",
];

const FORBIDDEN_PREFIXES = ["/api/", "/admin/", "/_next/"];
const NON_HTML_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/news-sitemap.xml",
  "/feed.xml",
  "/google3ff2ae106454c0cb.html",
]);
const REQUIRED_STATIC_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/news-sitemap.xml",
  "/feed.xml",
]);
const pathMetadata = new Map();
const recentlyChangedPaths = new Set();

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractLocations(xml = "") {
  return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
}

function extractSitemapEntries(xml = "") {
  const entries = [];
  for (const match of String(xml).matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const location = decodeXml(
      block.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1] || ""
    ).trim();
    const lastModified = decodeXml(
      block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1] || ""
    ).trim();
    if (location) entries.push({ location, lastModified });
  }
  if (entries.length) return entries;
  return extractLocations(xml).map((location) => ({
    location,
    lastModified: "",
  }));
}

function isReaderPath(pathname) {
  if (!pathname || !pathname.startsWith("/")) return false;
  if (FORBIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (NON_HTML_PATHS.has(pathname)) return false;
  if (pathname === "/search" || pathname.startsWith("/search/")) return false;
  if (/\.(?:xml|txt|json|ico|svg|png|jpe?g|webp|gif|pdf)$/i.test(pathname)) return false;
  return true;
}

function priority(pathname) {
  if (CORE_PATHS.includes(pathname)) return 0;
  if (pathname.startsWith("/news/page/")) return 1;
  if (pathname.startsWith("/current-affairs/")) return 1;
  if (pathname.startsWith("/news/")) return 2;
  if (pathname.startsWith("/exams/")) return 3;
  if (pathname.startsWith("/category/") || pathname.startsWith("/current-affairs/category/")) return 4;
  return 5;
}

async function fetchText(url, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "CurrentPulseStaticReader/1.0",
        "x-currentpulse-static-render": "1",
      },
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

function injectStaticGuard(html) {
  const marker = `<meta name="currentpulse-static-reader" content="1">`;
  const guard = `<script id="currentpulse-static-reader-guard">
(()=>{try{
const originalFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  try{
    const raw=typeof input==="string"?input:(input&&input.url)||"";
    const u=new URL(raw,location.href);
    const sourceHeaders=(input instanceof Request)?input.headers:undefined;
    const h=new Headers((init&&init.headers)||sourceHeaders||undefined);
    if(u.origin===location.origin&&(u.searchParams.has("_rsc")||h.has("RSC")||h.get("Next-Router-Prefetch")==="1")){
      return Promise.resolve(new Response("",{status:204,headers:{"x-currentpulse-static-reader":"1"}}));
    }
  }catch(_){}
  return originalFetch(input,init);
};
document.addEventListener("click",function(event){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=event.target&&event.target.closest?event.target.closest("a[href]"):null;
  if(!target||target.target||target.hasAttribute("download"))return;
  let u;
  try{u=new URL(target.href,location.href);}catch(_){return;}
  if(u.origin!==location.origin)return;
  if(u.pathname.startsWith("/api/")||u.pathname.startsWith("/admin/"))return;
  if(u.hash&&u.pathname===location.pathname&&u.search===location.search)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(u.href);
},true);
}catch(_){}})();
</script>`;
  let output = String(html)
    .replace(/<link\b[^>]*\brel=["']prefetch["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*\bas=["']fetch["'][^>]*>/gi, "");
  if (/name=["']currentpulse-static-reader["']/i.test(output)) {
    return output;
  }
  const injection = `${marker}${guard}`;
  if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/<head\b[^>]*>/i, (match) => `${match}${injection}`);
  } else {
    output = `${injection}${output}`;
  }
  return output;
}

function destinationFor(pathname) {
  if (pathname === "/") return path.join(outDir, "index.html");
  const safe = pathname.replace(/^\/+|\/+$/g, "");
  return path.join(outDir, safe, "index.html");
}

function isPublicArticleDetailPath(pathname) {
  if (pathname.startsWith("/news/")) {
    return !pathname.startsWith("/news/page/");
  }
  if (pathname.startsWith("/current-affairs/")) {
    return !pathname.startsWith("/current-affairs/category/");
  }
  return pathname.startsWith("/exams/");
}

function looksLikeNoindexPlaceholder(html = "") {
  const head = String(html).slice(0, 40000);
  const robotsTags =
    head.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi) || [];
  return (
    robotsTags.some((tag) => /\bnoindex\b/i.test(tag)) ||
    /<title>\s*(?:News\s+)?Not Found\b/i.test(head)
  );
}

async function addRecentlyChangedDatabasePaths(paths) {
  if (!supabaseUrl || !supabaseServiceKey) return;
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const since = new Date(reuseBefore).toISOString();
    const [articleResult, examResult] = await Promise.all([
      supabase
        .from("articles")
        .select("slug,created_at,updated_at,article_sources(source_kind)")
        .eq("status", "published")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(1200),
      supabase
        .from("exam_updates")
        .select("slug,created_at,updated_at")
        .eq("status", "published")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(800),
    ]);

    if (articleResult.error) {
      console.warn(`[static-reader] Recent article refresh query failed: ${articleResult.error.message}`);
    } else {
      for (const article of articleResult.data || []) {
        if (!article?.slug) continue;
        const kinds = new Set((article.article_sources || []).map((source) => source?.source_kind));
        const lastModified = article.updated_at || article.created_at || new Date().toISOString();
        if (kinds.has("news")) {
          const route = `/news/${article.slug}`;
          paths.add(route);
          recentlyChangedPaths.add(route);
          pathMetadata.set(route, { lastModified });
        }
        if (kinds.has("coaching")) {
          const route = `/current-affairs/${article.slug}`;
          paths.add(route);
          recentlyChangedPaths.add(route);
          pathMetadata.set(route, { lastModified });
        }
      }
    }

    if (examResult.error) {
      console.warn(`[static-reader] Recent exam refresh query failed: ${examResult.error.message}`);
    } else {
      for (const exam of examResult.data || []) {
        if (!exam?.slug) continue;
        const route = `/exams/${exam.slug}`;
        paths.add(route);
        recentlyChangedPaths.add(route);
        pathMetadata.set(route, {
          lastModified: exam.updated_at || exam.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.warn(`[static-reader] Recent database refresh lookup failed: ${error?.message || error}`);
  }
}

async function collectPaths() {
  const paths = new Set(CORE_PATHS);

  // Query-string pagination cannot be materialized as distinct Cloudflare
  // static files. Pre-render a bounded path-based News archive instead.
  const staticNewsArchivePages = Math.max(
    2,
    Math.min(
      60,
      Number(process.env.STATIC_NEWS_ARCHIVE_PAGES || 48)
    )
  );
  for (let page = 2; page <= staticNewsArchivePages; page += 1) {
    paths.add(`/news/page/${page}`);
  }
  for (const sitemapPath of ["/sitemap.xml", "/news-sitemap.xml"]) {
    try {
      const { response, text } = await fetchText(`${base}${sitemapPath}`, 30000);
      if (!response.ok) {
        console.warn(`[static-reader] ${sitemapPath} returned ${response.status}`);
        continue;
      }
      for (const entry of extractSitemapEntries(text)) {
        try {
          const url = new URL(entry.location);
          const pathname = url.pathname.replace(/\/+$/, "") || "/";
          if (isReaderPath(pathname)) {
            paths.add(pathname);
            if (entry.lastModified) {
              pathMetadata.set(pathname, { lastModified: entry.lastModified });
            }
          }
        } catch {
          // Ignore malformed sitemap items rather than failing the whole reader release.
        }
      }
    } catch (error) {
      console.warn(`[static-reader] Could not read ${sitemapPath}: ${error?.message || error}`);
    }
  }

  await addRecentlyChangedDatabasePaths(paths);

  return [...paths]
    .filter(isReaderPath)
    .sort((a, b) => {
      const coreDelta =
        Number(!CORE_PATHS.includes(a)) - Number(!CORE_PATHS.includes(b));
      if (coreDelta) return coreDelta;

      // Recent DB changes must never be crowded out by old sitemap archive
      // entries when the global static-reader page cap is reached.
      const recentDelta =
        Number(!recentlyChangedPaths.has(a)) -
        Number(!recentlyChangedPaths.has(b));
      if (recentDelta) return recentDelta;

      const priorityDelta = priority(a) - priority(b);
      if (priorityDelta) return priorityDelta;

      const aModified =
        new Date(pathMetadata.get(a)?.lastModified || 0).getTime() || 0;
      const bModified =
        new Date(pathMetadata.get(b)?.lastModified || 0).getTime() || 0;
      if (aModified !== bModified) return bModified - aModified;

      return a.localeCompare(b);
    })
    .slice(0, maxPages);
}

async function renderOne(pathname) {
  const lastModified = new Date(
    pathMetadata.get(pathname)?.lastModified || 0
  ).getTime();
  const reuseExisting = Boolean(
    reuseBase &&
      !CORE_PATHS.includes(pathname) &&
      Number.isFinite(lastModified) &&
      lastModified > 0 &&
      lastModified < reuseBefore
  );
  const destination = destinationFor(pathname);
  if (reuseLocal && reuseExisting) {
    try {
      const stat = await fs.stat(destination);
      if (stat.isFile() && stat.size >= 500) {
        return {
          pathname,
          ok: true,
          status: 200,
          bytes: stat.size,
          reused: true,
          reusedLocal: true,
        };
      }
    } catch {
      // Cache miss: fall through to live/base rendering.
    }
  }
  const selectedBase = reuseExisting ? reuseBase : base;
  const url = `${selectedBase}${pathname}`;
  try {
    let { response, text } = await fetchText(url);
    let reused = reuseExisting;
    if (reused && (!response.ok || !/<html\b/i.test(text) || text.length < 500)) {
      ({ response, text } = await fetchText(`${base}${pathname}`));
      reused = false;
    }
    const contentType = String(response.headers.get("content-type") || "");
    if (!response.ok) {
      return { pathname, ok: false, status: response.status, reason: `HTTP ${response.status}` };
    }
    if (!/text\/html/i.test(contentType)) {
      return { pathname, ok: false, status: response.status, reason: `Non-HTML ${contentType}` };
    }
    if (!/<html\b/i.test(text) || text.length < 500) {
      return { pathname, ok: false, status: response.status, reason: "HTML response was unexpectedly small." };
    }
    if (isPublicArticleDetailPath(pathname) && looksLikeNoindexPlaceholder(text)) {
      // Do not publish a successful-looking static asset for a page whose
      // reader itself says "not found" / noindex. Remove an old cached copy too.
      await fs.rm(destination, { force: true });
      return {
        pathname,
        ok: false,
        status: response.status,
        reason: "Article detail rendered as noindex/not-found; stale static asset removed.",
      };
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, injectStaticGuard(text), "utf8");
    return {
      pathname,
      ok: true,
      status: 200,
      bytes: Buffer.byteLength(text),
      reused,
    };
  } catch (error) {
    return {
      pathname,
      ok: false,
      status: 0,
      reason: error?.name === "AbortError" ? "Timed out" : (error?.message || String(error)),
    };
  }
}

async function materializeStaticFiles() {
  const results = [];
  for (const pathname of NON_HTML_PATHS) {
    try {
      const { response, text } = await fetchText(`${base}${pathname}`, 30000);
      if (!response.ok || !text) {
        results.push({ pathname, ok: false, status: response.status });
        continue;
      }
      const destination = path.join(outDir, pathname.replace(/^\/+/, ""));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, text, "utf8");
      results.push({
        pathname,
        ok: true,
        status: response.status,
        bytes: Buffer.byteLength(text),
      });
    } catch (error) {
      results.push({
        pathname,
        ok: false,
        status: 0,
        reason: error?.message || String(error),
      });
    }
  }
  return results;
}

async function mapWithConcurrency(items, limit, handler) {
  const results = new Array(items.length);
  let index = 0;
  let budgetExhausted = false;

  async function worker() {
    while (true) {
      if (budgetExhausted) break;
      if (
        Date.now() - materializationStartedAt >=
        materializationBudgetMs
      ) {
        budgetExhausted = true;
        break;
      }

      const current = index++;
      if (current >= items.length) break;
      results[current] = await handler(items[current], current);

      if ((current + 1) % 50 === 0) {
        console.log(
          `[static-reader] rendered ${current + 1}/${items.length}`
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )
  );

  return { results, budgetExhausted };
}

await fs.mkdir(outDir, { recursive: true });
const staticFiles = await materializeStaticFiles();
const requiredStaticFailures = staticFiles.filter(
  (item) => REQUIRED_STATIC_PATHS.has(item.pathname) && !item.ok
);
const paths = await collectPaths();
console.log(`[static-reader] candidate pages=${paths.length} max=${maxPages} concurrency=${concurrency}`);

const renderRun = await mapWithConcurrency(
  paths,
  concurrency,
  renderOne
);
const results = renderRun.results;
const skippedForBudget = paths.filter(
  (_, index) => !results[index]
);
const succeeded = results.filter((item) => item?.ok);
const reused = succeeded.filter((item) => item.reused);
const reusedLocal = succeeded.filter((item) => item.reusedLocal);
const failed = results.filter((item) => item && !item.ok);
const requiredFailures = [
  ...failed.filter((item) => CORE_PATHS.includes(item.pathname)),
  ...skippedForBudget
    .filter((pathname) => CORE_PATHS.includes(pathname))
    .map((pathname) => ({
      pathname,
      ok: false,
      status: 0,
      reason: "Skipped after the global materialization budget was exhausted.",
    })),
];

const manifest = {
  generatedAt,
  base,
  mode: "asset-first-static-reader",
  candidatePages: paths.length,
  generatedPages: succeeded.length,
  freshlyRenderedPages: succeeded.length - reused.length,
  reusedArchivePages: reused.length,
  reusedLocalArchivePages: reusedLocal.length,
  localReuseEnabled: reuseLocal,
  failedPages: failed.length,
  skippedForBudget: skippedForBudget.length,
  budgetExhausted: renderRun.budgetExhausted,
  budgetSeconds,
  requiredFailures,
  requiredStaticFailures,
  staticFiles,
  reuseBase: reuseBase || null,
  freshDays,
  failures: failed.slice(0, 100),
  skippedSample: skippedForBudget.slice(0, 100),
  note:
    "Canonical reader HTML is materialized into Cloudflare Static Assets. API/admin requests remain Worker-backed.",
};

await fs.writeFile(
  path.join(outDir, "currentpulse-static-reader-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log(
  `STATIC_READER_COMPLETE generated=${succeeded.length} failed=${failed.length} requiredFailed=${requiredFailures.length}`
);

if (requiredFailures.length) {
  console.error(JSON.stringify(requiredFailures, null, 2));
  process.exit(2);
}
if (requiredStaticFailures.length) {
  console.error(JSON.stringify(requiredStaticFailures, null, 2));
  process.exit(4);
}
if (paths.length >= 25 && succeeded.length < Math.min(25, paths.length)) {
  console.error("Static reader produced too few pages to be considered healthy.");
  process.exit(3);
}
