export function renderMainHelp() {
  return `openrouter-model-explorer

Discover OpenRouter models and provider endpoints without extra dependencies.

Usage:
  openrouter <command> [options]

Commands:
  models list                 List all models and filter on price, context, modality, and parameters
  models user                 List models available to the current key after privacy and provider filters
  models endpoints <model>    Compare provider endpoints for one model by latency, throughput, uptime, and price
  key info                    Inspect the current API key session
  help [command]              Show command-specific help

Examples:
  openrouter models list --max-prompt-price 5 --min-context 128000 --support tools
  openrouter models list --search gpt-4o --check-access
  openrouter models list --accessible-only --support tools
  openrouter models user --region eu --json
  openrouter models endpoints openai/gpt-4o-mini --sort latency
  OPENROUTER_API_KEY=sk-or-... openrouter key info

Useful options:
  --json                      Emit JSON for agents and scripts
  --version                   Show installed CLI version
  --timeout MS                HTTP timeout in milliseconds (default: 30000)
  --region eu                 Use https://eu.openrouter.ai/api/v1 for EU in-region filtering
  --base-url URL              Override the API base URL
  --api-key TOKEN             Override OPENROUTER_API_KEY for a single command

Environment:
  OPENROUTER_API_KEY          API key used for authenticated commands
  OPENROUTER_BASE_URL         Default base URL override
  OPENROUTER_REGION           "eu" to default to the EU endpoint
  OPENROUTER_TIMEOUT_MS       Default HTTP timeout in milliseconds
  OPENROUTER_HTTP_REFERER     Optional OpenRouter attribution header
  OPENROUTER_APP_TITLE        Optional OpenRouter app title header`;
}

export function renderModelsListHelp() {
  return `Usage:
  openrouter models list [filters]
  openrouter models user [filters]

Filters:
  --search TEXT               Match id, name, or description
  --category NAME             Pass OpenRouter's category filter through to /models
  --max-prompt-price USD      Maximum prompt price in USD per 1M tokens
  --max-completion-price USD  Maximum completion price in USD per 1M tokens
  --min-context TOKENS        Minimum supported context length
  --modality NAME             Require output modality, for example text or image
  --support PARAM             Require a supported parameter, repeat or comma-separate values
  --check-access              Mark whether each listed model is accessible for the current token
  --accessible-only           Filter out models that are blocked by the current token's settings
  --free-only                 Keep only zero-cost models
  --sort FIELD                prompt-price, completion-price, context, newest, or name
  --limit N                   Limit the number of rows
  --json                      Emit JSON instead of a table

Notes:
  "--check-access" and "--accessible-only" call /api/v1/models/user and require an API key.
  "models user" calls /api/v1/models/user, which OpenRouter documents as filtering
  by user provider preferences, privacy settings, and guardrails.
  With --region eu, requests go to eu.openrouter.ai/api/v1.`;
}

export function renderEndpointsHelp() {
  return `Usage:
  openrouter models endpoints <author/slug> [options]

Options:
  --sort FIELD                latency, throughput, uptime, prompt-price, completion-price, or context
  --json                      Emit raw JSON for agents and scripts

Examples:
  openrouter models endpoints anthropic/claude-3.7-sonnet
  openrouter models endpoints openai/gpt-4o-mini --sort throughput`;
}

export function renderKeyHelp() {
  return `Usage:
  openrouter key info [--json]

Shows the current API key session using GET /api/v1/key.`;
}
