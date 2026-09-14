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

let decodedQueueCount = 0;
const rejectedQueues = [];

for (const name of files) {
  try {
    const raw = await fs.readFile(path.join(SOURCE_DIR, name), "utf8");
    const packed = JSON.parse(raw);
    if (packed?.schema !== "currentpulse-ca-queue-v1") throw new Error("unsupported schema.");
    const encoded = clean(packed.articlesGzipBase64);
    if (!encoded) throw new Error("articlesGzipBase64 is required.");

    let articles;
    try {
      const decoded = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
      articles = JSON.parse(decoded);
    } catch (error) {
      throw new Error(`compressed article payload could not be decoded: ${error.message}`);
    }
    if (!Array.isArray(articles) || !articles.length || articles.length > 20) {
      throw new Error("decoded payload must contain 1-20 articles.");
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
    decodedQueueCount += 1;
    console.log(`${name}: decoded ${articles.length} articles into ${output}`);
  } catch (error) {
    rejectedQueues.push({ name, reason: error.message });
    console.error(`${name}: rejected compressed queue: ${error.message}`);
  }
}

if (!decodedQueueCount) {
  const detail = rejectedQueues.map(({ name, reason }) => `${name}: ${reason}`).join("; ");
  throw new Error(`No valid compressed CurrentPulse CA queues could be decoded. ${detail}`);
}

if (rejectedQueues.length) {
  console.warn(
    `Continuing with ${decodedQueueCount} valid compressed queue(s); ${rejectedQueues.length} corrupt queue(s) were isolated.`,
  );
}

await import("./publish-currentpulse-queue.mjs");
