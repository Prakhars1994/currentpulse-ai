import { GoogleGenAI } from "@google/genai";
import { SITE_URL } from "@/lib/siteUrl";

const DEFAULT_TIMEOUT_MS = 25_000;
const PROVIDER_COOLDOWN_MS = 10 * 60_000;
const DEFAULT_ROUTER_DEADLINE_MS = 65_000;
const DEFAULT_GEMINI_TIMEOUT_MS = 35_000;
const providerCooldowns = globalThis.__currentPulseAiProviderCooldowns || new Map();
globalThis.__currentPulseAiProviderCooldowns = providerCooldowns;

const OPEN_AI_COMPATIBLE_PROVIDERS = [
  {
    id: "groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    id: "mistral",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
  },
  {
    id: "cerebras",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "gpt-oss-120b",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
  },
  {
    id: "huggingface",
    keyEnv: "HF_TOKEN",
    modelEnv: "HF_MODEL",
    // Keep this configurable because Inference Providers availability changes.
    // A widely supported open-weight chat model is used only as a starter.
    defaultModel: "openai/gpt-oss-120b:fastest",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "openrouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "openrouter/free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      "HTTP-Referer": SITE_URL,
      "X-OpenRouter-Title": "CurrentPulse AI",
    },
  },
];

function cloudflareProvider() {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!accountId) return null;
  return {
    id: "cloudflare",
    keyEnv: "CLOUDFLARE_AI_API_TOKEN",
    modelEnv: "CLOUDFLARE_AI_MODEL",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
  };
}

function getGeminiClient() {
  return process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function toPrompt(contents) {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return JSON.stringify(part);
      })
      .join("\n")
      .trim();
  }
  return JSON.stringify(contents);
}

function extractCompatibleText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
    if (text) return text;
  }
  throw new Error(payload?.error?.message || "AI provider returned an empty response.");
}

function providerErrorStatus(error) {
  return Number(error?.status || error?.statusCode || 0);
}

function isTemporaryProviderError(error) {
  const status = providerErrorStatus(error);
  const message = String(error?.message || "").toLowerCase();
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500 ||
    [
      "quota",
      "rate limit",
      "resource_exhausted",
      "too many requests",
      "capacity",
      "temporarily unavailable",
      "high demand",
      "timeout",
      "timed out",
      "fetch failed",
      "network",
    ].some((term) => message.includes(term))
  );
}

function providerIsCoolingDown(id) {
  const until = Number(providerCooldowns.get(id) || 0);
  if (!until) return false;
  if (Date.now() >= until) {
    providerCooldowns.delete(id);
    return false;
  }
  return true;
}

function providerCooldownDuration(error) {
  const status = providerErrorStatus(error);
  const message = String(error?.message || "").toLowerCase();
  if (
    message.includes("perday") ||
    message.includes("daily quota") ||
    message.includes("free_tier_requests")
  ) {
    return 6 * 60 * 60_000;
  }
  if (status === 429 || message.includes("quota") || message.includes("rate limit")) {
    return 15 * 60_000;
  }
  return Math.max(60_000, Number(process.env.AI_PROVIDER_COOLDOWN_MS) || PROVIDER_COOLDOWN_MS);
}

function markProviderCoolingDown(id, error) {
  providerCooldowns.set(id, Date.now() + providerCooldownDuration(error));
}

function providerOrder() {
  const cloudflare = cloudflareProvider();
  const all = [
    ...OPEN_AI_COMPATIBLE_PROVIDERS.slice(0, 3),
    ...(cloudflare ? [cloudflare] : []),
    ...OPEN_AI_COMPATIBLE_PROVIDERS.slice(3),
  ];

  const requested = cleanText(process.env.AI_PROVIDER_ORDER)
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requested.length) return all;

  const byId = new Map(all.map((provider) => [provider.id, provider]));
  const ordered = [];
  for (const id of requested) {
    const provider = byId.get(id);
    if (provider) {
      ordered.push(provider);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

function configuredProvider(provider) {
  const apiKey = cleanText(process.env[provider.keyEnv]);
  const model = cleanText(process.env[provider.modelEnv]) || provider.defaultModel;
  if (!apiKey || !model) return null;
  return { ...provider, apiKey, model };
}

async function generateWithCompatibleProvider(provider, contents, config = {}, budgetMs = null) {
  const controller = new AbortController();
  const configuredTimeoutMs = Math.max(8_000, Number(process.env.AI_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Math.max(5_000, Math.min(configuredTimeoutMs, Number(budgetMs) || configuredTimeoutMs));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      model: provider.model,
      messages: [{ role: "user", content: toPrompt(contents) }],
      max_tokens: Math.min(16_000, Math.max(256, Number(config.maxOutputTokens) || 7_000)),
    };

    if (typeof config.temperature === "number") body.temperature = config.temperature;
    if (config.responseMimeType === "application/json") {
      // JSON object mode is supported by the major OpenAI-compatible providers.
      // Providers that reject it are automatically skipped by the fallback chain.
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        ...(provider.headers || {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        `${provider.id} failed (${response.status}): ${payload?.error?.message || payload?.message || response.statusText}`
      );
      error.status = response.status;
      throw error;
    }

    return {
      text: extractCompatibleText(payload),
      provider: provider.id,
      model: payload?.model || provider.model,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`${provider.id} request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function configuredProviderNames() {
  const names = [];
  if (process.env.GEMINI_API_KEY) names.push("gemini");
  for (const provider of providerOrder()) {
    if (configuredProvider(provider)) names.push(provider.id);
  }
  return [...new Set(names)];
}

/**
 * CurrentPulse AI provider router.
 *
 * Gemini remains the first attempt when configured because callers pass a
 * concrete Gemini model. If that request fails, the same prompt is routed
 * through independent providers rather than retrying only Google quota.
 */
export async function generateWithRouter({ model, contents, config = {} }) {
  const errors = [];
  const gemini = getGeminiClient();
  const startedAt = Date.now();
  const routerDeadlineMs = Math.max(20_000, Number(process.env.AI_ROUTER_DEADLINE_MS) || DEFAULT_ROUTER_DEADLINE_MS);
  const remainingMs = () => Math.max(0, routerDeadlineMs - (Date.now() - startedAt));

  if (gemini && !providerIsCoolingDown(`gemini:${model}`) && remainingMs() > 5_000) {
    try {
      const geminiTimeoutMs = Math.max(8_000, Math.min(
        Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || DEFAULT_GEMINI_TIMEOUT_MS,
        remainingMs()
      ));
      const response = await gemini.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          httpOptions: {
            ...(config.httpOptions || {}),
            timeout: geminiTimeoutMs,
            retryOptions: {
              ...(config.httpOptions?.retryOptions || {}),
              attempts: 1,
            },
          },
        },
      });
      return {
        text: cleanText(response?.text),
        provider: "gemini",
        model,
      };
    } catch (error) {
      errors.push(`gemini/${model}: ${error?.message || error}`);
      if (isTemporaryProviderError(error)) markProviderCoolingDown(`gemini:${model}`, error);
      console.warn(`[AI router] Gemini ${model} unavailable; trying independent providers:`, error?.message || error);
    }
  }

  for (const definition of providerOrder()) {
    if (remainingMs() <= 5_000) break;
    const provider = configuredProvider(definition);
    if (!provider || providerIsCoolingDown(provider.id)) continue;
    try {
      const result = await generateWithCompatibleProvider(
        provider,
        contents,
        config,
        remainingMs()
      );
      console.log(`[AI router] ${provider.id}/${result.model} completed request.`);
      return result;
    } catch (error) {
      errors.push(`${provider.id}/${provider.model}: ${error?.message || error}`);
      if (isTemporaryProviderError(error)) markProviderCoolingDown(provider.id, error);
      console.warn(`[AI router] ${provider.id} unavailable; trying next provider:`, error?.message || error);
    }
  }

  const configured = configuredProviderNames();
  if (!configured.length) {
    throw new Error(
      "No AI provider is configured. Add at least one of GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY, CLOUDFLARE_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, HF_TOKEN, or OPENROUTER_API_KEY."
    );
  }

  throw new Error(`All configured AI providers are temporarily unavailable. ${errors.slice(-6).join(" | ")}`);
}

export function getConfiguredAiProviders() {
  return configuredProviderNames();
}
