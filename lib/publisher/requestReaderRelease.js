import "server-only";
import { dispatchReaderRelease } from "./dispatchReaderRelease";
import { recordReaderReleaseDispatch, recordReaderReleaseRequest } from "./readerReleaseOutbox";

const recentlyQueued = globalThis.__currentPulseReaderReleaseQueue || new Map();
globalThis.__currentPulseReaderReleaseQueue = recentlyQueued;

export async function requestReaderRelease({ articleId, stream, supabase = null, fetchImpl = fetch }) {
  const token = String(process.env.GITHUB_READER_RELEASE_TOKEN || "").trim();
  const owner = String(process.env.GITHUB_REPOSITORY_OWNER || "Prakhars1994").trim();
  const repository = String(
    process.env.GITHUB_REPOSITORY_NAME || "currentpulse-ai"
  ).trim();
  const key = `${articleId}:${stream}`;
  const now = Date.now();

  const recent = recentlyQueued.get(key);
  if (recent?.expiresAt > now) {
    return { queued: true, durable: recent.durable, deduplicated: true };
  }
  const outbox = await recordReaderReleaseRequest(supabase, { articleId, stream });
  try {
    await dispatchReaderRelease({ token, owner, repository, articleId, stream, fetchImpl });
    await recordReaderReleaseDispatch(supabase, outbox.id);
  } catch (error) {
    await recordReaderReleaseDispatch(supabase, outbox.id, error);
    error.durable = outbox.durable;
    throw error;
  }

  recentlyQueued.set(key, { expiresAt: now + 30_000, durable: outbox.durable });
  return { queued: true, durable: outbox.durable, deduplicated: false };
}
