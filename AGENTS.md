# Repository Guidelines

## Project Structure & Module Organization
- `bin/openrouter.js` is the executable entrypoint.
- `src/` holds the CLI parser, OpenRouter API client, filter logic, formatters, and help text.
- `tests/` contains `node:test` coverage for parsing and model filtering behavior.
- `.github/workflows/` contains CI and release automation.
- `README.md` is the user-facing quick start; keep it aligned with the actual command surface.

Keep modules small and single-purpose. Add new command logic under `src/` rather than growing `bin/`.

## Build, Test, and Development Commands
- `npm ci` installs from the lockfile in CI and release workflows.
- `npm run build` runs `npm pack --dry-run` to verify the package can be published.
- `npm test` runs the built-in Node test suite.
- `node ./bin/openrouter.js --help` prints the top-level CLI reference.
- `node ./bin/openrouter.js models list --json` is a quick smoke test for argument parsing and output mode.

This project intentionally avoids runtime dependencies. Prefer built-in Node APIs such as `fetch`, `node:test`, `assert`, `fs`, and `path`.

## Coding Style & Naming Conventions
- Use ES modules and 2-space indentation.
- Prefer plain functions and small modules over framework-style abstractions.
- Use kebab-case for CLI flags, camelCase for local variables, and clear command names such as `models user`.
- Keep JSON output stable and machine-friendly because AI agents are a primary user.

## Testing Guidelines
- Add tests in `tests/*.test.js`.
- Cover argument parsing, filtering, sorting, and other pure logic before adding network-heavy behavior.
- Avoid live API calls in tests; mock responses or test the transformation layer directly.

## Commit & Pull Request Guidelines
- Make small, focused commits. Separate scaffolding, behavior changes, and docs when practical.
- Use Conventional Commits such as `feat:`, `fix:`, `docs:`, or `chore:`. Release automation depends on these messages for versioning and changelog generation.
- PRs should include the user-visible command changes, updated help or README text when relevant, and the exact validation commands run.

## Configuration Tips
- Use `OPENROUTER_API_KEY` for authenticated commands.
- `OPENROUTER_REGION=eu` or `--region eu` targets the EU endpoint.
- npm publishing uses GitHub Actions trusted publishing via `.github/workflows/release.yml`.
- Release publication runs from the GitHub release tag, and the workflow can republish an existing tag through `workflow_dispatch` when recovery is needed.
- Keep secrets out of the repo; `.env` is ignored.
