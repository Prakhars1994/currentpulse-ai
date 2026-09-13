import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const SOURCE_DIR = path.resolve("automation/publish-compressed");
const QUEUE_DIR = path.resolve("automation/publish-queue");

function clean(value = "") {
  return String(value ?? "").trim();
}

async function listCompressedFiles() {
  try {
    const names = await fs.readdir(SOURCE_DIR);
    return names.filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const files = await listCompressedFiles();
if (!files.length) {
  console.log("No compressed CurrentPulse CA queues found; skipping.");
  process.exit(0);
}

await fs.mkdir(QUEUE_DIR, { recursive: true });

for (const name of files) {
  const raw = await fs.readFile(path.join(SOURCE_DIR, name), "utf8");
  const packed = JSON.parse(raw);
  if (packed?.schema !== "currentpulse-ca-queue-v1") throw new Error(`${name}: unsupported schema.`);
  const encoded = clean(packed.articlesGzipBase64);
  if (!encoded) throw new Error(`${name}: articlesGzipBase64 is required.`);

  let articles;
  try {
    const decoded = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
    articles = JSON.parse(decoded);
  } catch (error) {
    throw new Error(`${name}: compressed article payload could not be decoded: ${error.message}`);
  }
  if (!Array.isArray(articles) || !articles.length || articles.length > 20) {
    throw new Error(`${name}: decoded payload must contain 1-20 articles.`);
  }

  const standardQueue = {
    schema: "currentpulse-ca-queue-v1",
    queueId: clean(packed.queueId),
    publishedAt: clean(packed.publishedAt),
    revision: Number(packed.revision || 1),
    articles,
  };
  const output = `compressed-${name}`;
  await fs.writeFile(path.join(QUEUE_DIR, output), JSON.stringify(standardQueue), "utf8");
  console.log(`${name}: decoded ${articles.length} articles into ${output}`);
}

await import("./publish-currentpulse-queue.mjs");
