# ADR-003: Biome for Linting/Formatting and Coding Standards

## Context

The project had no linter or formatter configured. Inconsistent formatting (mixed tabs/spaces, double/single quotes, semicolons) had crept in across source files.

## Decision

Adopted [Biome](https://biomejs.dev/) as the single tool for formatting, linting, and import sorting.

### Formatting

- 2-space indentation
- Single quotes
- No semicolons

### Linting

- Biome recommended rules enabled globally
- `noExplicitAny` enforced as error in source code, off for test files (via biome override)
- Remaining `any` suppressions in source code are limited to genuinely untyped external data (JSON-LD from third-party HTML, CMS JSON payloads) where typing isn't practical

### TypeScript strictness

- `strict: true` with `noUncheckedIndexedAccess` (pre-existing)
- `DOM` lib added for Playwright browser-context callbacks
- `@/*` path alias mapped to `./src/*`, preferred over deep relative imports

### Type strategy for untyped CMS data

- ITV News Contentful rich text nodes use a local `ContentfulNode` interface instead of `any`
- JSON-LD and top-level CMS article payloads remain `any` with biome-ignore suppressions and explanations
- Test files are exempt from `noExplicitAny` to keep test assertions concise

## Consequences

- `bun run check` validates formatting + linting in CI
- `bun run format` auto-fixes formatting issues
- New code must satisfy biome before committing
- Any new `biome-ignore` suppression requires a clear reason comment
