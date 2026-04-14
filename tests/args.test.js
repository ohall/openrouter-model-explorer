import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "../src/args.js";

test("parseArgs handles boolean and valued long options", () => {
  const parsed = parseArgs([
    "models",
    "list",
    "--json",
    "--max-prompt-price",
    "5",
    "--support=tools",
  ]);

  assert.deepEqual(parsed.positionals, ["models", "list"]);
  assert.equal(parsed.options.json, true);
  assert.equal(parsed.options["max-prompt-price"], "5");
  assert.equal(parsed.options.support, "tools");
});

test("parseArgs accumulates repeated options", () => {
  const parsed = parseArgs([
    "models",
    "list",
    "--support",
    "tools",
    "--support",
    "response_format",
  ]);

  assert.deepEqual(parsed.options.support, ["tools", "response_format"]);
});

test("parseArgs supports short aliases", () => {
  const parsed = parseArgs(["models", "user", "-jhv"]);
  assert.equal(parsed.options.json, true);
  assert.equal(parsed.options.help, true);
  assert.equal(parsed.options.version, true);
});
