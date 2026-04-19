# openrouter-model-explorer

Dependency-light Node.js package for OpenRouter model discovery. It works both as a CLI and as an importable module, using built-in Node APIs instead of runtime helper libraries.

## Install

```bash
npm install openrouter-model-explorer
```

For one-off CLI usage:

```bash
npx openrouter-model-explorer --help
```

For a global command:

```bash
npm install --global openrouter-model-explorer
openrouter --help
```

## CLI usage

```bash
# cheapest tool-capable text models
openrouter models list --support tools --sort prompt-price --limit 10

# check whether specific search results are actually usable with the current token
OPENROUTER_API_KEY=sk-or-v1-... openrouter models list --search gpt-4o --check-access

# keep only models allowed by the token's provider/privacy policy
OPENROUTER_API_KEY=sk-or-v1-... openrouter models list --accessible-only --support tools

# privacy-aware models for the current API key
OPENROUTER_API_KEY=sk-or-v1-... openrouter models user --json

# EU in-region filtered view
openrouter models user --region eu

# compare provider endpoint performance for one model
openrouter models endpoints openai/gpt-4o-mini --sort latency

# inspect the current key
openrouter key info
```

Run `openrouter --help` for the full command reference.

## Module usage

```js
import { OpenRouterClient, applyModelFilters } from "openrouter-model-explorer";

const client = new OpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const { data } = await client.getUserModels();
const models = applyModelFilters(data, {
  support: "tools",
  "max-prompt-price": 5,
  limit: 5,
});

console.log(models.map((model) => model.id));
```

Available exports include:

- `OpenRouterClient`
- `OpenRouterError`
- `resolveBaseUrl`
- `parseArgs`
- `annotateModelAccess`
- `applyModelFilters`
- `normalizeModel`
- `normalizeEndpoint`
- `sortEndpoints`
- `main`

## Release flow

Versioning and npm publication are handled by GitHub Actions.

- `ci.yml` runs `npm ci`, `npm run build`, and `npm test` on pushes and pull requests.
- `release.yml` uses release-please to open or update release PRs from Conventional Commit history.
- When a release is cut on `main`, the workflow runs the same build and test steps before `npm publish`.

Bootstrap note:

- npm trusted publishing only works after the package already exists on npm.
- Publish `openrouter-model-explorer` manually once from an npm account with publish rights.
- After that first publish, configure npm trusted publishing for this repository and point it at `release.yml`.

npm documents that trusted publishing from GitHub Actions requires `id-token: write`, Node 22.14.0 or newer, and an existing package record on npm.

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
