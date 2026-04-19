import { parseArgs } from "./args.js";
import {
  formatCurrencyPerMillion,
  formatInteger,
  formatLatencySeconds,
  formatPercent,
  renderKeyValueBlock,
  renderTable,
} from "./format.js";
import {
  renderEndpointsHelp,
  renderKeyHelp,
  renderMainHelp,
  renderModelsListHelp,
} from "./help.js";
import { annotateModelAccess, applyModelFilters, sortEndpoints } from "./models.js";
import { OpenRouterClient, OpenRouterError, resolveBaseUrl } from "./openrouter-api.js";
import packageJson from "../package.json" with { type: "json" };

function write(message, stream = process.stdout) {
  stream.write(`${message}\n`);
}

function wantsJsonOutput(argv, options) {
  if (options?.json) {
    return true;
  }
  return argv.includes("--json") || argv.includes("-j");
}

function writeError(message, { json = false, code = "CLI_ERROR" } = {}) {
  if (json) {
    process.stderr.write(`${JSON.stringify({ error: { code, message } })}\n`);
    return;
  }
  process.stderr.write(`Error: ${message}\n`);
}

function resolveExitCode(error) {
  if (error instanceof OpenRouterError) {
    switch (error.code) {
      case "AUTH_REQUIRED":
      case "AUTH_ERROR":
        return 2;
      case "API_ERROR":
        return 3;
      case "NETWORK_ERROR":
        return 4;
      default:
        return 1;
    }
  }

  if (error?.code === "INPUT_ERROR") {
    return 1;
  }

  return 1;
}

function parseNumericOption(options, key, { min = null, integer = false } = {}) {
  const raw = options[key];
  if (raw === undefined || raw === null || raw === false) {
    return null;
  }

  const parsed = Number(raw);
  const isValidNumber = integer ? Number.isInteger(parsed) : Number.isFinite(parsed);
  if (!isValidNumber || (min !== null && parsed < min)) {
    throw new OpenRouterError(`Invalid value for --${key}: ${raw}`, { code: "INPUT_ERROR" });
  }

  return parsed;
}

function validateModelFilterOptions(options) {
  parseNumericOption(options, "max-prompt-price", { min: 0 });
  parseNumericOption(options, "max-completion-price", { min: 0 });
  parseNumericOption(options, "min-context", { min: 0, integer: true });
  parseNumericOption(options, "limit", { min: 0, integer: true });
}

function resolveTimeoutMs(options) {
  const fromCli = parseNumericOption(options, "timeout", { min: 1, integer: true });
  if (fromCli !== null) {
    return fromCli;
  }

  const fromEnv = process.env.OPENROUTER_TIMEOUT_MS;
  if (fromEnv === undefined) {
    return 30_000;
  }

  const parsed = Number(fromEnv);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new OpenRouterError(
      `Invalid value for OPENROUTER_TIMEOUT_MS: ${process.env.OPENROUTER_TIMEOUT_MS}`,
      { code: "INPUT_ERROR" },
    );
  }
  return parsed;
}

function buildClient(options) {
  const baseUrl = resolveBaseUrl({
    baseUrl: options["base-url"] || process.env.OPENROUTER_BASE_URL,
    region: options.region || process.env.OPENROUTER_REGION,
  });

  return new OpenRouterClient({
    apiKey: options["api-key"] || process.env.OPENROUTER_API_KEY,
    baseUrl,
    referer: process.env.OPENROUTER_HTTP_REFERER,
    appTitle: process.env.OPENROUTER_APP_TITLE || "openrouter-model-explorer",
    timeoutMs: resolveTimeoutMs(options),
  });
}

function renderModelRows(models, options = {}) {
  const columns = [
    { label: "Model", value: (model) => model.id },
    {
      label: "Prompt",
      value: (model) =>
        model.prompt_price_is_special
          ? "router"
          : formatCurrencyPerMillion(model.prompt_price_per_million),
    },
    {
      label: "Completion",
      value: (model) =>
        model.completion_price_is_special
          ? "router"
          : formatCurrencyPerMillion(model.completion_price_per_million),
    },
    { label: "Context", value: (model) => formatInteger(model.context_length) },
    { label: "Outputs", value: (model) => model.output_modalities.join(",") || "-" },
    { label: "Moderated", value: (model) => (model.is_moderated ? "yes" : "no") },
  ];

  if (options["check-access"] || options["accessible-only"]) {
    columns.push({
      label: "Access",
      value: (model) => (model.accessible_with_current_token ? "yes" : "no"),
    });
  }

  return renderTable(models, columns);
}

function renderEndpointRows(endpoints) {
  return renderTable(endpoints, [
    { label: "Provider", value: (endpoint) => endpoint.provider_name || endpoint.name },
    { label: "Prompt", value: (endpoint) => formatCurrencyPerMillion(endpoint.prompt_price_per_million) },
    {
      label: "Completion",
      value: (endpoint) => formatCurrencyPerMillion(endpoint.completion_price_per_million),
    },
    { label: "Latency", value: (endpoint) => formatLatencySeconds(endpoint.latency_p50) },
    { label: "Throughput", value: (endpoint) => endpoint.throughput_p50?.toFixed(1) ?? "-" },
    { label: "Uptime", value: (endpoint) => formatPercent(endpoint.uptime_last_30m) },
    { label: "Context", value: (endpoint) => formatInteger(endpoint.context_length) },
  ]);
}

async function handleModels(command, options, client) {
  validateModelFilterOptions(options);

  if (command === "list") {
    const query = {};
    if (options.category) {
      query.category = options.category;
    }
    if (options.support) {
      query.supported_parameters = Array.isArray(options.support)
        ? options.support.join(",")
        : options.support;
    }
    if (options.modality) {
      query.output_modalities = Array.isArray(options.modality)
        ? options.modality.join(",")
        : options.modality;
    }

    const payload = await client.getModels(query);
    let models = payload.data || [];

    if (options["check-access"] || options["accessible-only"]) {
      const accessiblePayload = await client.getUserModels();
      models = annotateModelAccess(models, accessiblePayload.data || []);
    }

    models = applyModelFilters(models, options);
    if (options.json) {
      write(JSON.stringify({ data: models }, null, 2));
      return 0;
    }
    write(renderModelRows(models, options));
    return 0;
  }

  if (command === "user") {
    const payload = await client.getUserModels();
    const models = applyModelFilters(payload.data || [], options);
    if (options.json) {
      write(JSON.stringify({ data: models }, null, 2));
      return 0;
    }
    write(renderModelRows(models, options));
    return 0;
  }

  if (command === "endpoints") {
    const modelId = options._modelId;
    if (!modelId) {
      writeError("Missing required argument: <author/slug>.", {
        json: Boolean(options.json),
        code: "INPUT_ERROR",
      });
      if (!options.json) {
        write(renderEndpointsHelp(), process.stderr);
      }
      return 1;
    }
    const payload = await client.getModelEndpoints(modelId);
    const data = payload.data || {};
    const endpoints = sortEndpoints(data.endpoints || [], options.sort || "latency");
    if (options.json) {
      write(JSON.stringify({ ...data, endpoints }, null, 2));
      return 0;
    }
    write(`${data.id || modelId}`);
    write(renderEndpointRows(endpoints));
    return 0;
  }

  write(renderModelsListHelp());
  return 1;
}

async function handleKey(command, options, client) {
  if (command !== "info") {
    write(renderKeyHelp());
    return 1;
  }

  const payload = await client.getCurrentKey();
  const keyInfo = payload.data || {};

  if (options.json) {
    write(JSON.stringify(payload, null, 2));
    return 0;
  }

  write(
    renderKeyValueBlock([
      ["label", keyInfo.label ?? "-"],
      ["limit", keyInfo.limit ?? "-"],
      ["limit_remaining", keyInfo.limit_remaining ?? "-"],
      ["usage", keyInfo.usage ?? "-"],
      ["usage_daily", keyInfo.usage_daily ?? "-"],
      ["usage_monthly", keyInfo.usage_monthly ?? "-"],
      ["free_tier", keyInfo.is_free_tier ? "yes" : "no"],
      ["management_key", keyInfo.is_management_key ? "yes" : "no"],
      ["provisioning_key", keyInfo.is_provisioning_key ? "yes" : "no"],
      ["expires_at", keyInfo.expires_at ?? "-"],
    ]),
  );
  return 0;
}

function resolveHelpTarget(positionals) {
  return positionals.join(" ").trim();
}

export async function main(argv, { clientFactory = buildClient } = {}) {
  const jsonRequested = wantsJsonOutput(argv);
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    writeError(error.message, { json: jsonRequested, code: error.code || "CLI_ERROR" });
    if (!jsonRequested) {
      write(renderMainHelp(), process.stderr);
    }
    return resolveExitCode(error);
  }

  const { options, positionals } = parsed;
  const outputJson = wantsJsonOutput(argv, options);

  if (options.version) {
    write(`openrouter-model-explorer ${packageJson.version}`);
    return 0;
  }

  if (options.help || positionals.length === 0) {
    const target = resolveHelpTarget(positionals);
    if (target === "models list" || target === "models user" || target === "models") {
      write(renderModelsListHelp());
      return 0;
    }
    if (target === "models endpoints") {
      write(renderEndpointsHelp());
      return 0;
    }
    if (target === "key" || target === "key info") {
      write(renderKeyHelp());
      return 0;
    }
    write(renderMainHelp());
    return 0;
  }

  if (positionals[0] === "help") {
    const target = resolveHelpTarget(positionals.slice(1));
    if (target === "models" || target === "models list" || target === "models user") {
      write(renderModelsListHelp());
      return 0;
    }
    if (target === "models endpoints") {
      write(renderEndpointsHelp());
      return 0;
    }
    if (target === "key" || target === "key info") {
      write(renderKeyHelp());
      return 0;
    }
    write(renderMainHelp());
    return 0;
  }

  try {
    if (positionals[0] === "models") {
      const [_, subcommand, maybeModelId] = positionals;
      options._modelId = maybeModelId;
      return await handleModels(subcommand, options, clientFactory(options));
    }

    if (positionals[0] === "key") {
      const [_, subcommand] = positionals;
      return await handleKey(subcommand, options, clientFactory(options));
    }

    writeError(`Unknown command: ${positionals.join(" ")}`, { json: outputJson });
    if (!outputJson) {
      write(renderMainHelp(), process.stderr);
    }
    return 1;
  } catch (error) {
    writeError(error.message, { json: outputJson, code: error.code || "CLI_ERROR" });
    return resolveExitCode(error);
  }
}
