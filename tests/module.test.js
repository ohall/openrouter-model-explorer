import test from "node:test";
import assert from "node:assert/strict";

test("package self-reference exports the public module api", async () => {
  const mod = await import("openrouter-cli");

  assert.equal(typeof mod.OpenRouterClient, "function");
  assert.equal(typeof mod.applyModelFilters, "function");
  assert.equal(typeof mod.main, "function");
});
