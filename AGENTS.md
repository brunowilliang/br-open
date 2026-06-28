# AGENTS.md

`br-open` is an Expo Router + React Native app (Expo SDK 56, React 19, RN 0.85)
backed by Convex via the `kitcn` ORM/CRPC layer. The UI uses Uniwind (Tailwind
v4 for RN) and HeroUI Native (OSS + Pro).

## Commands

- Install: `bun install`
- Start app: `bun run dev` (Expo) — for native, build a dev client: `bun run dev:client`
- Convex + kitcn codegen loop: `bun convex:dev` (alias for `bunx kitcn dev`)
- Regenerate kitcn artifacts: `bun run codegen`
- Typecheck (app **and** convex): `bun run typecheck`
  - app only: `bun run typecheck` minus convex, i.e. `tsc --noEmit`
  - convex only: `bun run typecheck:convex`
- Lint/format: `bun run check` (runs `ultracite check` **then** `typecheck`) — this is the full gate
- Auto-fix formatting: `bun run fix` (`ultracite fix`)
- Tests: `bun test` (all) · `bun test convex` (`bun run test:convex`) · `bun test src`
  - Tests are co-located as `*.test.ts` next to the file under test.
- Diff hygiene: `git diff --check`

CI (`.github/workflows/ci.yml`) runs `typecheck` -> `check` -> `bun test` on Bun 1.2.x.

## Setup gotchas

- `bun install` **requires `HEROUI_AUTH_TOKEN`** (HeroUI Pro is a paid/trusted
  dep: `heroui-native-pro`, `@heroui-pro/react`). CI passes it as a secret;
  locally it must be exported in the environment or a `.npmrc`/env hook.
- Two env files: `.env.local` (client: `CONVEX_DEPLOYMENT`,
  `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`) and `convex/.env`
  (server: `SITE_URL`, `BETTER_AUTH_SECRET`, plus Apple OAuth vars). Both are
  gitignored and must exist for `bun convex:dev` to run.
- `convex/functions/generated/` (kitcn CRPC layer) and
  `convex/functions/_generated/` (raw Convex codegen) are generated. Never
  hand-edit; regenerate via `bun run codegen` / `bun convex:dev`.

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
- **Functions** live in `convex/functions/<domain>/*.ts` and are written with
  the kitcn **CRPC** builders from `convex/lib/crpc.ts`, not raw Convex
  `query`/`mutation`. Available builders: `authQuery`/`authMutation`/`authAction`
  (require login, inject `ctx.user`/`ctx.userId`), `optionalAuthQuery`/
  `optionalAuthMutation`, `publicQuery`/`publicMutation`/`publicAction`, and
  HTTP routes `publicRoute`/`authRoute`/`optionalAuthRoute`. Throw `CRPCError`
  for auth/expected errors.
- **Domains** (`convex/domains/*`) are the source of truth for data and rules.
  Each owns at minimum `tables.ts` + `relations.ts`, plus domain logic
  (commonly `contract.ts` with zod schemas + rules) and a `tests/` dir. Current
  domains: `auth`, `league`, `notification`, `player`, `seed`.
- `convex/functions/schema.ts` is **composition-only**: it imports domain
  tables/relations and combines them. Keep it that way.
- `convex/lib/` (env, CRPC, auth helpers), `convex/shared/` (cross-domain
  shared code), `convex/utils/` (e.g. `contract.zod.ts`).
- **Auth**: Better Auth wired through kitcn (`defineAuth` from
  `convex/functions/generated/auth`, configured in `convex/functions/auth.ts`),
  with `@better-auth/expo`, the organization plugin (orgs + teams), and
  Apple/Google social login. Default locale `pt-BR`.

## Convex schema & kitcn auth workflow

- The preferred auth ownership path is `convex/domains/auth/`.
- `bunx kitcn add auth --schema --yes` may inject auth tables/relations
  directly into `convex/functions/schema.ts`. Do **not** keep that inline block.
- Reconciliation flow:
  1. Diff generated auth tables/relations in `schema.ts` against
     `convex/domains/auth/tables.ts` and `relations.ts`.
  2. Copy only useful deltas (new indexes, org/team relations) into the domain
     files.
  3. Reject generated regressions: `text().references(...)` replacing
     `id(...).references(...)`, weakened nullability, `json(...)` downgraded to
     `text()`, duplicate auth tables.
  4. Delete the inline generated block; leave `schema.ts` composition-only.
  5. Re-run `bun run codegen` then `bun run typecheck`.
- `convex/functions/plugins.lock.json` may still claim auth ownership lives at
  `convex/functions/schema.ts`. Treat it as generated/internal; preserve the
  domain-first structure and verify outputs after cleanup.

## Data & migrations

- Migrations live in `convex/functions/migrations/` (filenaming convention is
  relaxed for these in `biome.jsonc`).
- When changing table shapes, account for legacy documents already in the
  deployment. Prefer migrations for field removal/renames/data reshaping.
- If old docs would fail schema validation on boot, keep schema compatibility
  temporarily until a migration clears the old fields.

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
- Feature plans and design specs are tracked under `docs/superpowers/`
  (`plans/` and `specs/`, dated). Check there before starting a feature slice.

## Validation before handoff

Run the checks appropriate to the touched scope:

- minimum: `git diff --check`
- usually: `bun run check` (lint + typecheck)
- when logic/contracts changed: `bun test`
- when Convex schema/contracts changed: `bun run codegen` then `bun run check`
