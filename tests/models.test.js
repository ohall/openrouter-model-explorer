import test from "node:test";
import assert from "node:assert/strict";

import {
  annotateModelAccess,
  applyModelFilters,
  normalizeEndpoint,
  normalizeModel,
  sortEndpoints,
} from "../src/models.js";

const baseModel = {
  id: "openai/gpt-4o-mini",
  name: "GPT-4o mini",
  description: "Fast and cheap",
  context_length: 128000,
  created: 1700000000,
  pricing: {
    prompt: "0.00000015",
    completion: "0.0000006",
    request: "0",
    image: "0",
  },
  supported_parameters: ["tools", "response_format"],
  architecture: {
    input_modalities: ["text"],
    output_modalities: ["text"],
  },
  top_provider: {
    is_moderated: true,
  },
};

test("normalizeModel adds per-million price fields", () => {
  const model = normalizeModel(baseModel);
  assert.equal(model.prompt_price_per_million, 0.15);
  assert.equal(model.completion_price_per_million, 0.6);
  assert.equal(model.is_moderated, true);
});

test("normalizeModel treats negative router pricing as special", () => {
  const model = normalizeModel({
    ...baseModel,
    pricing: {
      prompt: "-1",
      completion: "-1",
    },
  });

  assert.equal(model.prompt_price_per_million, null);
  assert.equal(model.completion_price_per_million, null);
  assert.equal(model.prompt_price_is_special, true);
  assert.equal(model.completion_price_is_special, true);
});

test("applyModelFilters filters on price, context, and supported parameters", () => {
  const models = applyModelFilters(
    [
      baseModel,
      {
        ...baseModel,
        id: "anthropic/claude-expensive",
        pricing: { ...baseModel.pricing, prompt: "0.00001" },
        context_length: 32000,
        supported_parameters: ["temperature"],
      },
    ],
    {
      "max-prompt-price": "1",
      "min-context": "100000",
      support: "tools",
    },
  );

  assert.deepEqual(models.map((model) => model.id), ["openai/gpt-4o-mini"]);
});

test("sortEndpoints orders by latency ascending", () => {
  const endpoints = sortEndpoints(
    [
      {
        provider_name: "Slow",
        latency_last_30m: { p50: 1.4 },
        throughput_last_30m: { p50: 20 },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
      {
        provider_name: "Fast",
        latency_last_30m: { p50: 0.2 },
        throughput_last_30m: { p50: 45 },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
    ],
    "latency",
  );

  assert.deepEqual(endpoints.map((endpoint) => endpoint.provider_name), ["Fast", "Slow"]);
  assert.equal(normalizeEndpoint(endpoints[0]).latency_p50, 0.2);
});

test("applyModelFilters respects --limit 0", () => {
  const filtered = applyModelFilters([baseModel], { limit: 0 });
  assert.equal(filtered.length, 0);
});

test("annotateModelAccess flags whether a model is available to the current token", () => {
  const annotated = annotateModelAccess(
    [
      baseModel,
      {
        ...baseModel,
        id: "anthropic/claude-4",
        canonical_slug: "anthropic/claude-4",
      },
    ],
    [{ id: "openai/gpt-4o-mini", canonical_slug: "openai/gpt-4o-mini" }],
  );

  assert.deepEqual(
    annotated.map((model) => [model.id, model.accessible_with_current_token]),
    [
      ["openai/gpt-4o-mini", true],
      ["anthropic/claude-4", false],
    ],
  );
});

test("applyModelFilters supports filtering to accessible models only", () => {
  const filtered = applyModelFilters(
    [
      { ...baseModel, accessible_with_current_token: true },
      { ...baseModel, id: "anthropic/claude-4", accessible_with_current_token: false },
    ],
    { "accessible-only": true },
  );

  assert.deepEqual(filtered.map((model) => model.id), ["openai/gpt-4o-mini"]);
});
