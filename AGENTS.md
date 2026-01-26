# Agent Guidelines for Yazelix

This document provides coding agents with essential commands, conventions, and guidelines for working in this repository.

## Build/Test Commands

### Main Repository (Yazelix - Nushell/Nix)

```bash
devenv shell                                      # Enter development environment
yzx launch [--here] [--verbose]                   # Launch Yazelix
yzx env [--no-shell]                              # Load tools without UI
yzx doctor [--fix] [--verbose]                    # Health check

# Testing
nu nushell/scripts/utils/test_runner.nu          # Run all tests
nu nushell/scripts/dev/validate_syntax.nu        # Validate Nushell syntax
```

### Cloudflare Sandbox SDK (`cloudflare/sandbox-sdk/`)

```bash
npm run build                                     # Build all packages (turbo)
npm run check                                     # Biome lint + typecheck
npm run fix                                       # Auto-fix lint issues

# Unit tests
npm test                                          # All unit tests
npm test -w @cloudflare/sandbox                   # SDK tests only
npm test -w @repo/sandbox-container               # Container tests only

# E2E tests (requires Docker)
npm run test:e2e                                  # All E2E tests
npm run test:e2e -- -- tests/e2e/file.ts          # Single file
npm run test:e2e -- -- tests/e2e/file.ts -t 'name' # Single test
```

### Cloudflare Docs (`docs/cloudflare/docs/`)

```bash
npm install && npm run dev                        # Local development
npm run build                                     # Build site
npm run lint                                      # ESLint checks
```

## Code Style Guidelines

### File Naming (Yazelix - CRITICAL)

**Always use underscores (`_`) for file/directory names. Never use hyphens (`-`).**

```
✅ home_manager/          ❌ home-manager/
✅ yazelix_default.toml   ❌ yazelix-default.toml
```

### Nushell (CRITICAL - Parentheses Escaping)

Use SINGLE backslash only for parentheses in string interpolation:

```nushell
$"Checking pane \(editor\)"      # ✅ Correct
$"Checking pane \\(editor\\)"    # ❌ Wrong - fails
$"Checking pane (editor)"        # ❌ Wrong - executes command
```

### TypeScript (Sandbox SDK)

- **Never use `any`** - Define proper types in `packages/shared/src/types.ts`
- Use Biome for linting (not ESLint)
- ES modules syntax, strict mode enabled
- Web-standard APIs only (not Node.js)

### TypeScript (Cloudflare Docs)

- ESLint + TypeScript recommended configs
- `@typescript-eslint/no-explicit-any: off` (docs exception)
- Unused vars with `_` prefix are allowed

### Documentation Writing (docs/cloudflare/docs)

- Use active voice, present tense, second person ("you")
- No contractions or marketing language
- Sentence case for headings, imperative mood
- Replace `e.g.` → `for example`, `i.e.` → `that is`
- Use relative links (`/r2/get-started/`), never full URLs
- Import components: `import { ComponentName } from "~/components";`

## Error Handling

1. **No silent failures** - Every error must be visible
2. **Avoid fallbacks** - They mask underlying issues
3. **Fail fast with clear errors** - Explicit messages over degraded functionality

## Git Workflow

### Yazelix
- Branch: `issue_{number}` (e.g., `issue_42`)
- Commit: `#{issue-number} {description}` (e.g., `#42 Add sidebar`)

### Sandbox SDK
- Use imperative mood, ≤50 char subject
- Explain why, not how; no bullet points
- Create changesets for published package changes:
  ```markdown
  ---
  '@cloudflare/sandbox': patch
  ---
  Brief user-focused description
  ```

## Project Structure

```
/
├── cloudflare/sandbox-sdk/       # Cloudflare Sandbox SDK (monorepo)
│   ├── packages/sandbox/         # Public SDK (@cloudflare/sandbox)
│   ├── packages/shared/          # Shared types (@repo/shared)
│   ├── packages/sandbox-container/ # Container runtime
│   └── tests/e2e/                # E2E tests
├── cloudflare_sandbox/           # Yazelix Workers API
├── docs/cloudflare/docs/         # Cloudflare documentation site
│   ├── src/content/              # MDX documentation
│   └── .opencode/                # Agent commands/configs
├── configs/                      # Tool configs (yazi, zellij)
├── nushell/scripts/              # Core Nushell scripts
├── home_manager/                 # Nix Home Manager integration
└── yazelix_default.toml          # Default config template
```

## Key Patterns

### Sandbox SDK Architecture
- **SDK** (`@cloudflare/sandbox`): Public API, client classes
- **Shared** (`@repo/shared`): Types, errors, logging (internal)
- **Container** (`@repo/sandbox-container`): Bun HTTP server (internal)

### Testing Strategy
| Scenario | Test Type |
|----------|-----------|
| Client/service logic | Unit |
| Full execution flow | E2E |
| File/process operations | E2E |

### Code Comments
Write for future readers, not current conversation:
```typescript
// ❌ Bad: references historical context
// Uses tracking to avoid the indexOf bug

// ✅ Good: describes current behavior
// Returns parsed events and remaining content
```

## Documentation

- `CLAUDE.md` - Detailed AI agent instructions
- `cloudflare/sandbox-sdk/AGENTS.md` - SDK-specific guidelines
- `docs/cloudflare/docs/.opencode/agent/docs.md` - Doc writing rules
- `docs/installation.md` - Yazelix setup guide

## Technology Stack

| Component | Technology |
|-----------|------------|
| Yazelix scripting | Nushell |
| Package management | Nix/devenv, npm |
| Sandbox SDK | TypeScript, Turbo, Vitest |
| Docs site | Astro, MDX |
| Core tools | Yazi, Zellij, Helix |

---

For detailed conventions, see `CLAUDE.md` and project-specific AGENTS.md files.
