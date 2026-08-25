import "server-only";

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
  if (!token) throw new Error("GITHUB_READER_RELEASE_TOKEN is not configured.");

  const response = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repository}/actions/workflows/currentpulse-reader-release.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          reason: `admin-publish:${articleId}:${stream}`,
          full: false,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub workflow dispatch returned HTTP ${response.status}.`);
  }

  recentlyQueued.set(key, now + 30_000);
  return { queued: true, deduplicated: false };
}
