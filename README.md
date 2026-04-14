# openrouter-cli

Small Node.js CLI for OpenRouter model discovery with no runtime dependencies.

## Quick start

```bash
npm install
OPENROUTER_API_KEY=sk-or-v1-... node ./bin/openrouter.js models user
```

## Common commands

```bash
# cheapest tool-capable text models
node ./bin/openrouter.js models list --support tools --sort prompt-price --limit 10

# privacy-aware models for the current API key
node ./bin/openrouter.js models user --json

# EU in-region filtered view
node ./bin/openrouter.js models user --region eu

# compare provider endpoint performance for one model
node ./bin/openrouter.js models endpoints openai/gpt-4o-mini --sort latency

# inspect the current key
node ./bin/openrouter.js key info
```

Run `node ./bin/openrouter.js --help` for the full command reference.

## Agent and script integration

- Use `--json` for machine-readable output on all data commands.
- In `--json` mode, failures are emitted on `stderr` as a single-line JSON object:
  `{"error":{"code":"...","message":"..."}}`
- Successful command payloads are emitted on `stdout`.
- Use `--version` (or `-v`) to detect installed capabilities before issuing commands.

### Exit codes

- `0`: success
- `1`: invalid input or usage error
- `2`: authentication error (missing or rejected API key)
- `3`: API returned an error response
- `4`: network/transport failure (including timeout)
