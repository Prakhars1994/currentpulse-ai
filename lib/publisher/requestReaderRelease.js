import "server-only";
import { dispatchReaderRelease } from "./dispatchReaderRelease";

const recentlyQueued = globalThis.__currentPulseReaderReleaseQueue || new Map();
globalThis.__currentPulseReaderReleaseQueue = recentlyQueued;

export async function requestReaderRelease({ articleId, stream, fetchImpl = fetch }) {
  const token = String(process.env.GITHUB_READER_RELEASE_TOKEN || "").trim();
  const owner = String(process.env.GITHUB_REPOSITORY_OWNER || "Prakhars1994").trim();
  const repository = String(
    process.env.GITHUB_REPOSITORY_NAME || "currentpulse-ai"
  ).trim();
  const key = `${articleId}:${stream}`;
  const now = Date.now();

  if (recentlyQueued.get(key) > now) return { queued: true, deduplicated: true };
  await dispatchReaderRelease({ token, owner, repository, articleId, stream, fetchImpl });

  recentlyQueued.set(key, now + 30_000);
  return { queued: true, deduplicated: false };
}
