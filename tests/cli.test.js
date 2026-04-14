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
