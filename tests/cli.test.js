import test from "node:test";
import assert from "node:assert/strict";

import { main } from "../src/cli.js";
import packageJson from "../package.json" with { type: "json" };

function captureOutput(run) {
  const stdoutChunks = [];
  const stderrChunks = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = (chunk, ...args) => {
    stdoutChunks.push(String(chunk));
    if (typeof args[args.length - 1] === "function") {
      args[args.length - 1]();
    }
    return true;
  };

  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(String(chunk));
    if (typeof args[args.length - 1] === "function") {
      args[args.length - 1]();
    }
    return true;
  };

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    })
    .then((exitCode) => ({
      exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    }));
}

test("returns JSON error for parse failures with --json", async () => {
  const result = await captureOutput(() => main(["models", "list", "-x", "--json"]));

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    error: {
      code: "CLI_ERROR",
      message: "Unknown short option: -x",
    },
  });
});

test("returns JSON error for unknown command with --json", async () => {
  const result = await captureOutput(() => main(["unknown", "--json"]));

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    error: {
      code: "CLI_ERROR",
      message: "Unknown command: unknown",
    },
  });
});

test("returns auth exit code and JSON error for missing key", async () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  try {
    const result = await captureOutput(() => main(["key", "info", "--json"]));

    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    assert.deepEqual(JSON.parse(result.stderr), {
      error: {
        code: "AUTH_REQUIRED",
        message: "This command requires OPENROUTER_API_KEY or --api-key.",
      },
    });
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  }
});

test("fails fast on invalid numeric options", async () => {
  const result = await captureOutput(() =>
    main(["models", "list", "--max-prompt-price", "oops", "--json"]),
  );

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    error: {
      code: "INPUT_ERROR",
      message: "Invalid value for --max-prompt-price: oops",
    },
  });
});

test("fails fast on invalid timeout option", async () => {
  const result = await captureOutput(() => main(["models", "list", "--timeout", "0", "--json"]));

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    error: {
      code: "INPUT_ERROR",
      message: "Invalid value for --timeout: 0",
    },
  });
});

test("prints package version with --version", async () => {
  const result = await captureOutput(() => main(["--version"]));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `openrouter-model-explorer ${packageJson.version}\n`);
});

test("models list --check-access annotates each result using /models/user", async () => {
  const fakeClient = {
    async getModels() {
      return {
        data: [
          {
            id: "openai/gpt-4o-mini",
            canonical_slug: "openai/gpt-4o-mini",
            pricing: { prompt: "0.00000015", completion: "0.0000006" },
            architecture: { output_modalities: ["text"] },
            top_provider: { is_moderated: true },
            context_length: 128000,
          },
          {
            id: "anthropic/claude-4",
            canonical_slug: "anthropic/claude-4",
            pricing: { prompt: "0.000003", completion: "0.000015" },
            architecture: { output_modalities: ["text"] },
            top_provider: { is_moderated: false },
            context_length: 200000,
          },
        ],
      };
    },
    async getUserModels() {
      return {
        data: [{ id: "openai/gpt-4o-mini", canonical_slug: "openai/gpt-4o-mini" }],
      };
    },
  };

  const result = await captureOutput(() =>
    main(["models", "list", "--check-access", "--json"], {
      clientFactory: () => fakeClient,
    }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    data: [
      {
        id: "openai/gpt-4o-mini",
        canonical_slug: "openai/gpt-4o-mini",
        pricing: { prompt: "0.00000015", completion: "0.0000006" },
        architecture: { output_modalities: ["text"] },
        top_provider: { is_moderated: true },
        context_length: 128000,
        accessible_with_current_token: true,
        prompt_price_per_million: 0.15,
        completion_price_per_million: 0.6,
        prompt_price_is_special: false,
        completion_price_is_special: false,
        request_price: null,
        image_price: null,
        input_modalities: [],
        output_modalities: ["text"],
        is_moderated: true,
      },
      {
        id: "anthropic/claude-4",
        canonical_slug: "anthropic/claude-4",
        pricing: { prompt: "0.000003", completion: "0.000015" },
        architecture: { output_modalities: ["text"] },
        top_provider: { is_moderated: false },
        context_length: 200000,
        accessible_with_current_token: false,
        prompt_price_per_million: 3,
        completion_price_per_million: 15,
        prompt_price_is_special: false,
        completion_price_is_special: false,
        request_price: null,
        image_price: null,
        input_modalities: [],
        output_modalities: ["text"],
        is_moderated: false,
      },
    ],
  });
});

test("models list --accessible-only filters out inaccessible models", async () => {
  const fakeClient = {
    async getModels() {
      return {
        data: [
          {
            id: "openai/gpt-4o-mini",
            canonical_slug: "openai/gpt-4o-mini",
            pricing: { prompt: "0.00000015", completion: "0.0000006" },
            architecture: { output_modalities: ["text"] },
            top_provider: { is_moderated: true },
            context_length: 128000,
          },
          {
            id: "anthropic/claude-4",
            canonical_slug: "anthropic/claude-4",
            pricing: { prompt: "0.000003", completion: "0.000015" },
            architecture: { output_modalities: ["text"] },
            top_provider: { is_moderated: false },
            context_length: 200000,
          },
        ],
      };
    },
    async getUserModels() {
      return {
        data: [{ id: "openai/gpt-4o-mini", canonical_slug: "openai/gpt-4o-mini" }],
      };
    },
  };

  const result = await captureOutput(() =>
    main(["models", "list", "--accessible-only", "--json"], {
      clientFactory: () => fakeClient,
    }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.data.map((model) => model.id), ["openai/gpt-4o-mini"]);
  assert.equal(payload.data[0].accessible_with_current_token, true);
});
