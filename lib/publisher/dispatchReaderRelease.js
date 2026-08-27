import { ReaderReleaseError } from "./readerReleaseResult.js";

export async function dispatchReaderRelease({ token, owner, repository, articleId, stream, fetchImpl = fetch }) {
  if (!token) throw new ReaderReleaseError("token_missing");
  let response;
  try {
    response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${repository}/actions/workflows/currentpulse-reader-release.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main", inputs: { reason: `admin-publish:${articleId}:${stream}`, full: "false" } }),
      }
    );
  } catch {
    throw new ReaderReleaseError("network_error");
  }
  if (!response.ok) {
    const reason = [401, 403, 404, 422].includes(response.status) ? `github_${response.status}` : "github_error";
    throw new ReaderReleaseError(reason, response.status);
  }
}
