export function createDeadline(totalMs) {
  const bounded = Math.max(250, Number(totalMs) || 0);
  return Date.now() + bounded;
}

export function remainingDeadlineMs(
  deadlineAt,
  maximumMs,
  minimumUsefulMs = 250
) {
  const maximum = Math.max(minimumUsefulMs, Number(maximumMs) || minimumUsefulMs);
  if (!Number.isFinite(Number(deadlineAt)) || Number(deadlineAt) <= 0) {
    return maximum;
  }
  const remaining = Number(deadlineAt) - Date.now();
  return remaining >= minimumUsefulMs ? Math.min(maximum, remaining) : 0;
}

export function deadlineSignal(deadlineAt, maximumMs, minimumUsefulMs = 250) {
  const timeoutMs = remainingDeadlineMs(
    deadlineAt,
    maximumMs,
    minimumUsefulMs
  );
  return timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : null;
}
