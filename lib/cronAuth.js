import "server-only";

export function isCronAuthorized(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  return Boolean(secret) && authorization === `Bearer ${secret}`;
}
