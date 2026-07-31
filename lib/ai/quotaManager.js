const exhaustedModels = new Set();

export function isModelAvailable(model) {
  return !exhaustedModels.has(model);
}

export function markModelExhausted(model) {
  exhaustedModels.add(model);

  console.log(
    `[Quota Manager] ${model} marked as exhausted for this server session.`
  );
}

export function resetQuotaManager() {
  exhaustedModels.clear();

  console.log("[Quota Manager] Reset.");
}

export function getUnavailableModels() {
  return [...exhaustedModels];
}