import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const base = String(arg("--base", process.env.STATIC_READER_BASE || "http://127.0.0.1:3100"))
  .replace(/\/+$/, "");
const outDir = path.resolve(arg("--out", ".open-next/assets"));
const maxPages = Math.max(25, Math.min(5000, Number(arg("--max-pages", process.env.STATIC_READER_MAX_PAGES || 3200)) || 3200));
const concurrency = Math.max(1, Math.min(6, Number(arg("--concurrency", "3")) || 3));
const requestTimeoutMs = Math.max(4000, Math.min(30000, Number(arg("--timeout-ms", "15000")) || 15000));
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

function injectStaticGuard(html, pathname) {
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

async function collectPaths() {
  const paths = new Set(CORE_PATHS);
  for (const sitemapPath of ["/sitemap.xml", "/news-sitemap.xml"]) {
    try {
      const { response, text } = await fetchText(`${base}${sitemapPath}`, 30000);
      if (!response.ok) {
        console.warn(`[static-reader] ${sitemapPath} returned ${response.status}`);
        continue;
      }
      for (const location of extractLocations(text)) {
        try {
          const url = new URL(location);
          const pathname = url.pathname.replace(/\/+$/, "") || "/";
          if (isReaderPath(pathname)) paths.add(pathname);
        } catch {
          // Ignore malformed sitemap items rather than failing the whole reader release.
        }
      }
    } catch (error) {
      console.warn(`[static-reader] Could not read ${sitemapPath}: ${error?.message || error}`);
    }
  }

  return [...paths]
    .filter(isReaderPath)
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b))
    .slice(0, maxPages);
}

async function renderOne(pathname) {
  const url = `${base}${pathname}`;
  try {
    const { response, text } = await fetchText(url);
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

    const destination = destinationFor(pathname);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, injectStaticGuard(text, pathname), "utf8");
    return { pathname, ok: true, status: 200, bytes: Buffer.byteLength(text) };
  } catch (error) {
    return {
      pathname,
      ok: false,
      status: 0,
      reason: error?.name === "AbortError" ? "Timed out" : (error?.message || String(error)),
    };
  }
}

async function mapWithConcurrency(items, limit, handler) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      results[current] = await handler(items[current], current);
      if ((current + 1) % 50 === 0) {
        console.log(`[static-reader] rendered ${current + 1}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

await fs.mkdir(outDir, { recursive: true });
const paths = await collectPaths();
console.log(`[static-reader] candidate pages=${paths.length} max=${maxPages} concurrency=${concurrency}`);

const results = await mapWithConcurrency(paths, concurrency, renderOne);
const succeeded = results.filter((item) => item?.ok);
const failed = results.filter((item) => item && !item.ok);
const requiredFailures = failed.filter((item) => CORE_PATHS.includes(item.pathname));

const manifest = {
  generatedAt,
  base,
  mode: "asset-first-static-reader",
  candidatePages: paths.length,
  generatedPages: succeeded.length,
  failedPages: failed.length,
  requiredFailures,
  failures: failed.slice(0, 100),
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
if (paths.length >= 25 && succeeded.length < Math.min(25, paths.length)) {
  console.error("Static reader produced too few pages to be considered healthy.");
  process.exit(3);
}
