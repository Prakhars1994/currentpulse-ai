export class ReaderReleaseError extends Error {
  constructor(reason, status = null) {
    super(reason === "token_missing" ? "GITHUB_READER_RELEASE_TOKEN is not configured." : status ? `GitHub workflow dispatch returned HTTP ${status}.` : "GitHub workflow dispatch failed.");
    this.name = "ReaderReleaseError";
    this.reason = reason;
    this.status = status;
  }
}

export function readerReleaseReason(error) {
  if (error instanceof ReaderReleaseError) return error.reason;
  return "network_error";
}

export function readerReleaseAdminMessage(reason) {
  const messages = {
    token_missing: "Reader release token is not configured.",
    github_401: "GitHub rejected the reader release token.",
    github_403: "GitHub permission issue while queuing the reader refresh.",
    github_404: "GitHub reader workflow was not found or is not visible to the token.",
    github_422: "GitHub rejected the reader workflow inputs.",
    github_error: "GitHub could not queue the reader refresh.",
    network_error: "Network error while contacting GitHub.",
  };
  return messages[reason] || messages.github_error;
}
