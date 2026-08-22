# AGENTS.md

`br-open` is an Expo Router + React Native app (Expo SDK 57, React 19.2, RN 0.86)
backed by Convex via the `kitcn` ORM/CRPC layer. The UI uses Uniwind (Tailwind
v4 for RN) and HeroUI Native (OSS + Pro).

## Commands

- Install: `bun install`
- Start app: `bun run dev` (Expo) — for native, build a dev client: `bun run dev:client`
- Typecheck: `bun run typecheck` (app **and** convex) — app only: `bun run typecheck` minus convex, i.e. `tsc --noEmit`
- Lint/format: `bun run check` (runs `ultracite check` **then** `typecheck`) — this is the full gate
- Auto-fix formatting: `bun run fix` (`ultracite fix`)
- Tests: `bun test` (all) · `bun test src`
  - Tests are co-located as `*.test.ts` next to the file under test.
- Diff hygiene: `git diff --check`

CI (`.github/workflows/ci.yml`) runs `typecheck` -> `check` -> `bun test` on Bun 1.2.x.

## Setup gotchas

- `bun install` **requires `HEROUI_AUTH_TOKEN`** (HeroUI Pro is a paid/trusted
  dep: `heroui-native-pro`, `@heroui-pro/react`). CI passes it as a secret;
  locally it must be exported in the environment or a `.npmrc`/env hook.
- Client env: `.env.local` (`CONVEX_DEPLOYMENT`,
  `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`) — gitignored.
  Server-side env (`convex/.env`) and generated `convex/functions/*` output are
  covered by the backend rule (see Architecture → Backend below).

## Architecture

### Frontend (`src/`)
- Routes live in `src/app/`, **not** a root `app/` dir. Split into route groups:
  `src/app/(public)/` and `src/app/(private)/`, with `src/app/_layout.tsx` as
  the root layout and `src/app/+not-found.tsx`.
- `src/components/` (UI, incl. HeroUI-based screens), `src/lib/` (domain logic
  + stores, e.g. `src/lib/leagues/`).
- TS path aliases (`tsconfig.json`): `@/*` -> `src/*`, `@/assets/*` -> `assets/*`,
  `@convex/*` -> `convex/*` (also `convex/shared/*`). Use these, not relative
  paths, when crossing top-level dirs.

### Backend (`convex/`)

Backend code lives in `convex/`. The complete backend guide — kitcn CLI and
commands, directory layout, CRPC builders, domain structure, auth (Better Auth
wiring + auth field codegen), migrations and backend conventions — is owned by
the Backend agent rule. Do not duplicate it here; read the source of truth:

→ **`docs/agents/backend.md`**

## Style & linting (Ultracite / Biome)

- Formatting/linting is enforced by **Ultracite** (a Biome preset): `bun run fix`
  auto-fixes; `bun run check` verifies. Lefthook (`lefthook.yml`) auto-runs
  `ultracite fix` (with `stage_fixed`) + `typecheck` + `bun test` on pre-commit.
- Repo-specific Biome overrides (`biome.jsonc`) that differ from defaults:
  - `useConsistentTypeDefinitions` = **`type`** (use `type` aliases, not `interface`).
  - `noNonNullAssertion` = **off**, `noArrayIndexKey` = **off**,
    `noEmptyBlockStatements` = **off**, `noUselessSwitchCase` = **off**,
    `noNamespaceImport` = **off**, `noExportedImports` = **off**.
  - `src/uniwind-types.d.ts` is generated — formatter disabled there.
- TS: `strict: true` but **`strictFunctionTypes: false`**; `bun-types`.

## Working notes

- Use the names/routes that exist in the current tree. Do not reuse stale
  feature names.
- For UI/form work, preserve the patterns already used in this repo unless
  explicitly changing them.
- The current state of the product — implemented features, architecture and
  decisions per domain — lives in `docs/spec/` (versioned). Read the doc of the
  domain before starting a feature slice and update it in the same step (part
  of done; the orchestrator checks it before closing the task).

## NEVER commit or push without explicit approval

**Hard rule.** Do NOT run `git commit`, `git add -A && git commit`, or `git push`
unless the user explicitly says "commita", "faz o commit", "puxa", or equivalent.
This applies to EVERY change, no matter how small or how clean the diff looks.

After finishing work:
1. Leave changes staged or unstaged in the working tree (do NOT commit).
2. Summarize what changed and point the user to `git diff` / `git diff --cached`.
3. Wait for explicit approval before any commit/push.

If a commit was made by mistake, undo it (`git reset --soft HEAD~1`) and surface
the working tree for review. This instruction overrides any default behavior
about "committing when done" — here, the user reviews before every commit.

## Validation before handoff

Run the checks appropriate to the touched scope (but do NOT commit):

- minimum: `git diff --check`
- usually: `bun run check` (lint + typecheck)
- when logic/contracts changed: `bun test`
- when the change touches backend (schema/functions/contracts): follow `docs/agents/backend.md`
