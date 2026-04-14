const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const EU_BASE_URL = "https://eu.openrouter.ai/api/v1";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function joinUrl(baseUrl, path, query = {}) {
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`);
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }
    url.searchParams.set(key, String(rawValue));
  }
  return url;
}

export function resolveBaseUrl({ baseUrl, region }) {
  if (baseUrl) {
    return trimTrailingSlash(baseUrl);
  }
  if (region === "eu") {
    return EU_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

export class OpenRouterError extends Error {
  constructor(message, { code = "OPENROUTER_ERROR", status, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "OpenRouterError";
    this.code = code;
    this.status = status;
  }
}

export class OpenRouterClient {
  constructor({
    apiKey,
    baseUrl,
    appTitle = "openrouter-model-explorer",
    referer,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }

    this.apiKey = apiKey;
    this.baseUrl = resolveBaseUrl({ baseUrl });
    this.appTitle = appTitle;
    this.referer = referer;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { query, requireAuth = false } = {}) {
    if (requireAuth && !this.apiKey) {
      throw new OpenRouterError("This command requires OPENROUTER_API_KEY or --api-key.", {
        code: "AUTH_REQUIRED",
      });
    }

    const headers = {
      Accept: "application/json",
      "X-OpenRouter-Title": this.appTitle,
    };

    if (this.referer) {
      headers["HTTP-Referer"] = this.referer;
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    let response;
    try {
      response = await this.fetchImpl(joinUrl(this.baseUrl, path, query), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new OpenRouterError(`Request timed out after ${this.timeoutMs}ms`, {
          code: "NETWORK_ERROR",
          cause: error,
        });
      }
      throw new OpenRouterError(`Network request failed: ${error.message}`, {
        code: "NETWORK_ERROR",
        cause: error,
      });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `${response.status} ${response.statusText}`;
      throw new OpenRouterError(message, {
        code: response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "API_ERROR",
        status: response.status,
      });
    }

    return payload;
  }

  getModels(query = {}) {
    return this.request("/models", { query });
  }

  getUserModels() {
    return this.request("/models/user", { requireAuth: true });
  }

  getModelEndpoints(modelId) {
    const [author, ...slugParts] = modelId.split("/");
    if (!author || slugParts.length === 0) {
      throw new OpenRouterError(
        `Model id "${modelId}" must be in "author/slug" format, for example "openai/gpt-4o-mini".`,
        { code: "INPUT_ERROR" },
      );
    }
    return this.request(`/models/${author}/${slugParts.join("/")}/endpoints`);
  }

  getCurrentKey() {
    return this.request("/key", { requireAuth: true });
  }
}
