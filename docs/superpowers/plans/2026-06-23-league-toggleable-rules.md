# League Toggleable Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn four challenge rules into toggleable `{ enabled, value }` rules, rename the scoring option, fix the final-set card structure, and consolidate the settings cards for spots and price.

**Architecture:** The contract schema is the source of truth. A `toggleableRule<T>` wrapper encodes `{ enabled, value }`. Backend consumption resolves the effective value (Infinity when disabled) at call sites, keeping `resolveChallengeCreationRuleError` numeric. A far-future sentinel represents "no deadline" because `responseDeadlineAt` is `notNull`. A single migration wraps the four rules and renames scoring in both `league.ruleConfig` and `leagueChallenge.matchConfigSnapshot`.

**Tech Stack:** Convex + kitcn (schema/migrations), Zod (contract), React Native + react-hook-form + heroui-native (UI), Bun test (tests).

**Spec:** `docs/superpowers/specs/2026-06-23-league-toggleable-rules-design.md`

---

## File Structure

**Backend / contract:**
- `convex/domains/league/contract.ts` — modify: add `toggleableRule` helper, wrap four rules, add `DEFAULT_LEAGUE_RULE_CONFIG`, rename `no_ad` → `no_advantage`, add `resolveRuleValue` + `resolveResponseDeadline`.
- `convex/domains/league/challenge-rules.ts` — modify: export `buildResponseDeadline` stays; nothing else changes here.
- `convex/domains/seed/data.ts` — modify: wrap four rules in `{ enabled, value }`.
- `convex/functions/league/challenges.ts` — modify: three `buildResponseDeadline` call sites use `resolveResponseDeadline`; challenge-creation call uses `resolveRuleValue(..., Infinity)`.
- `convex/functions/seed.ts` — modify: two call sites use `ruleConfig.responseDeadlineHours.value`.
- `convex/functions/_generated/api.ts` — regenerate via `bun run codegen`.
- `convex/functions/migrations/20260623_000001_toggleable_rule_config.ts` — create.
- `convex/functions/migrations/manifest.ts` — modify: register migration.

**Backend / tests:**
- `convex/domains/league/tests/contract.test.ts` — modify: add toggleable + scoring tests.
- `convex/domains/league/tests/challenge-creation-rules.test.ts` — modify: add Infinity cases.

**Frontend:**
- `src/components/pages/leagues/form-schema.ts` — no change expected (inherits contract).
- `src/app/(private)/settings/leagues/[mode]/rules.tsx` — modify: toggleable cards for four rules, move `resultValidationMode` to Result tab, fix FinalSet card, rename scoring option.
- `src/app/(private)/settings/leagues/[mode]/settings.tsx` — modify: consolidate spots + price cards.
- `src/app/(private)/leagues/[leagueId]/index.tsx` — modify: `formatScoringMode` rename.
- `src/lib/leagues/league-details-derived.ts` — modify: `formatScoringMode` rename.

---

## Task 1: Add `toggleableRule` helper and `DEFAULT_LEAGUE_RULE_CONFIG` to contract

**Files:**
- Modify: `convex/domains/league/contract.ts`

- [ ] **Step 1: Add the `toggleableRule` helper and exported types near the top of the file (after the `requiredNumber`/`enumField` imports, before `DEFAULT_LEAGUE_MATCH_CONFIG`)**

Insert after the options constants (after `LeagueScoringModeOptions` declaration, ~line 55):

```ts
export function toggleableRule<T>(value: z.ZodType<T>) {
  return z.object({
    enabled: z.boolean(),
    value,
  });
}

export type ToggleableRule<T> = {
  enabled: boolean;
  value: T;
};
```

- [ ] **Step 2: Add `resolveRuleValue` helper and the `NO_RESPONSE_DEADLINE_HORIZON_YEARS` constant near the toggleableRule helper**

```ts
export function resolveRuleValue<T>(rule: ToggleableRule<T>, fallback: T): T {
  return rule.enabled ? rule.value : fallback;
}

export const NO_RESPONSE_DEADLINE_HORIZON_YEARS = 100;
```

- [ ] **Step 3: Define `DEFAULT_LEAGUE_RULE_CONFIG` constant**

Place it after `DEFAULT_LEAGUE_MATCH_CONFIG` (it references the match config default). Note: only the toggleable rules + the scoring rename are defined here; the full defaults live in the seed. Add:

```ts
export const DEFAULT_LEAGUE_RULE_CONFIG = {
  maxChallengeDistance: { enabled: true, value: 4 } as ToggleableRule<number>,
  maxActiveChallengesPerPlayer: {
    enabled: true,
    value: 1,
  } as ToggleableRule<number>,
  maxChallengesPerMonth: {
    enabled: true,
    value: 4,
  } as ToggleableRule<number>,
  responseDeadlineHours: {
    enabled: true,
    value: 48,
  } as ToggleableRule<number>,
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add convex/domains/league/contract.ts
git commit -m "feat(league): add toggleableRule helper and rule defaults"
```

---

## Task 2: Rename scoring option `no_ad` → `no_advantage` in contract

**Files:**
- Modify: `convex/domains/league/contract.ts`

- [ ] **Step 1: Update `LeagueScoringModeOptions`**

Find (line ~55):

```ts
export const LeagueScoringModeOptions = ["advantage", "no_ad"] as const;
```

Replace with:

```ts
export const LeagueScoringModeOptions = ["advantage", "no_advantage"] as const;
```

The `DEFAULT_LEAGUE_MATCH_CONFIG.scoringMode` stays `"advantage"` — no change needed.

- [ ] **Step 2: Verify typecheck still passes (generated api.ts will mismatch — expected until Task 3 regenerates)**

Run: `bun run typecheck`
Expected: Type errors in `convex/functions/_generated/api.ts` referencing `no_ad`. This is expected; Task 3 regenerates it.

- [ ] **Step 3: Commit**

```bash
git add convex/domains/league/contract.ts
git commit -m "refactor(league): rename scoring option no_ad to no_advantage"
```

---

## Task 3: Wrap the four toggleable rules in `ChallengeRuleConfigSchema` and regenerate codegen

**Files:**
- Modify: `convex/domains/league/contract.ts`
- Regenerate: `convex/functions/_generated/api.ts`

- [ ] **Step 1: Rewrite the four toggleable fields in `ChallengeRuleConfigSchema`**

Find the first four fields of `ChallengeRuleConfigSchema` (lines ~352-367):

```ts
    maxChallengeDistance: requiredNumber(
      "Informe a distancia maxima do desafio.",
      "Informe uma distancia maxima valida."
    ),
    maxActiveChallengesPerPlayer: requiredNumber(
      "Informe o limite de desafios ativos por jogador.",
      "Informe um limite de desafios ativos valido."
    ),
    maxChallengesPerMonth: requiredNumber(
      "Informe o limite mensal de desafios.",
      "Informe um limite mensal de desafios valido."
    ),
    responseDeadlineHours: requiredNumber(
      "Informe o prazo de resposta em horas.",
      "Informe um prazo de resposta valido."
    ),
```

Replace with:

```ts
    maxChallengeDistance: toggleableRule(
      requiredNumber(
        "Informe a distancia maxima do desafio.",
        "Informe uma distancia maxima valida."
      )
    ),
    maxActiveChallengesPerPlayer: toggleableRule(
      requiredNumber(
        "Informe o limite de desafios ativos por jogador.",
        "Informe um limite de desafios ativos valido."
      )
    ),
    maxChallengesPerMonth: toggleableRule(
      requiredNumber(
        "Informe o limite mensal de desafios.",
        "Informe um limite mensal de desafios valido."
      )
    ),
    responseDeadlineHours: toggleableRule(
      requiredNumber(
        "Informe o prazo de resposta em horas.",
        "Informe um prazo de resposta valido."
      )
    ),
```

The existing `superRefine` for `hasInactivityPenalty` stays untouched.

- [ ] **Step 2: Run codegen to regenerate `_generated/api.ts`**

Run: `bun run codegen`
Expected: completes without error; `api.ts` now references `{ enabled, value }` and `no_advantage`.

- [ ] **Step 3: Run typecheck — expect failures in consumers that still read scalars (challenges.ts, seed.ts, seed/data.ts)**

Run: `bun run typecheck`
Expected: Type errors in `challenges.ts` (3 call sites reading `responseDeadlineHours`, 3 reading the numeric rules) and `seed.ts` (2 call sites). These are fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add convex/domains/league/contract.ts convex/functions/_generated/
git commit -m "feat(league): wrap challenge rules in toggleableRule"
```

---

## Task 4: Update seed data to the new toggleable shape and scoring rename

**Files:**
- Modify: `convex/domains/seed/data.ts`

- [ ] **Step 1: Update `defaultSeedRuleConfig`**

Find `defaultSeedRuleConfig` (the whole object, lines 1-32). Replace the four scalar fields with `{ enabled, value }`. The full replacement:

```ts
export const defaultSeedRuleConfig = {
  hasInactivityPenalty: false,
  lossBehavior: "stay_put" as const,
  matchConfig: {
    bestOfSets: 3,
    defaultDurationMinutes: 90,
    finalSetGamesPerSet: 6,
    finalSetHasTieBreak: true,
    finalSetMode: "same_as_previous" as const,
    finalSetMustWinByTwoGames: true,
    finalSetScoringMode: "advantage" as const,
    finalSetSuperTieBreakMustWinByTwo: true,
    finalSetSuperTieBreakPoints: 10,
    finalSetTieBreakAtGamesAll: 6,
    finalSetTieBreakMustWinByTwo: true,
    finalSetTieBreakPoints: 7,
    gamesPerSet: 6,
    hasTieBreak: true,
    scoringMode: "advantage" as const,
    setMustWinByTwoGames: true,
    tieBreakAtGamesAll: 6,
    tieBreakMustWinByTwo: true,
    tieBreakPoints: 7,
  },
  maxActiveChallengesPerPlayer: { enabled: true, value: 1 } as const,
  maxChallengeDistance: { enabled: true, value: 4 } as const,
  maxChallengesPerMonth: { enabled: true, value: 4 } as const,
  newPlayerPlacement: "end_of_ranking" as const,
  responseDeadlineHours: { enabled: true, value: 48 } as const,
  walkoverBehavior: "automatic_loss" as const,
  winBehavior: "take_opponent_position" as const,
};
```

Note: `matchConfig.scoringMode` and `finalSetScoringMode` stay `"advantage"` — no rename needed in seed because the default is advantage. The `no_ad` → `no_advantage` rename is only consumed by stored docs (migration) and the UI.

- [ ] **Step 2: Commit**

```bash
git add convex/domains/seed/data.ts
git commit -m "feat(league): update seed rule config to toggleable shape"
```

---

## Task 5: Update seed.ts to read `.value` for responseDeadlineHours

**Files:**
- Modify: `convex/functions/seed.ts`

- [ ] **Step 1: Fix the first call site (~line 1087)**

Find:

```ts
      responseDeadlineHours: ruleConfig.responseDeadlineHours,
```

Replace with:

```ts
      responseDeadlineHours: ruleConfig.responseDeadlineHours.value,
```

- [ ] **Step 2: Fix the second call site (~line 1274)**

Find:

```ts
      responseDeadlineHours: ruleConfig.responseDeadlineHours,
```

Replace with:

```ts
      responseDeadlineHours: ruleConfig.responseDeadlineHours.value,
```

- [ ] **Step 3: Verify seed typecheck**

Run: `bun run typecheck`
Expected: seed.ts no longer errors on `responseDeadlineHours`. The `challenges.ts` errors remain (fixed in Task 6).

- [ ] **Step 4: Commit**

```bash
git add convex/functions/seed.ts
git commit -m "fix(league): read toggleable responseDeadlineHours value in seed"
```

---

## Task 6: Add `resolveResponseDeadline` to challenge-rules.ts

**Files:**
- Modify: `convex/domains/league/challenge-rules.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/domains/league/tests/challenge-rules.test.ts` (inside the existing `describe` block or a new one). First check the import line at the top of the test file and add `resolveResponseDeadline` to it. Then add:

```ts
  it("builds a real deadline when the response deadline rule is enabled", () => {
    const now = new Date("2026-06-23T12:00:00.000Z");
    const deadline = resolveResponseDeadline({
      now,
      rule: { enabled: true, value: 48 },
    });

    expect(deadline.getTime()).toBe(
      new Date("2026-06-25T12:00:00.000Z").getTime()
    );
  });

  it("builds a far-future deadline when the response deadline rule is disabled", () => {
    const now = new Date("2026-06-23T12:00:00.000Z");
    const deadline = resolveResponseDeadline({
      now,
      rule: { enabled: false, value: 48 },
    });

    expect(deadline.getUTCFullYear()).toBe(now.getUTCFullYear() + 100);
  });
```

Ensure the import at the top includes `resolveResponseDeadline`:

```ts
import { resolveResponseDeadline, /* existing imports */ } from "../challenge-rules";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/domains/league/tests/challenge-rules.test.ts`
Expected: FAIL with `resolveResponseDeadline is not exported`.

- [ ] **Step 3: Implement `resolveResponseDeadline`**

In `convex/domains/league/challenge-rules.ts`, the file already imports from `./contract`:

```ts
import type { LeagueChallengeScore, LeagueMatchConfig } from "./contract";
```

Replace it with a merged import (keep the existing types, add the helper + constant + type):

```ts
import {
  NO_RESPONSE_DEADLINE_HORIZON_YEARS,
  type LeagueChallengeScore,
  type LeagueMatchConfig,
  type ToggleableRule,
} from "./contract";
```

Then add the function after `buildResponseDeadline`:

```ts
type ResolveResponseDeadlineInput = {
  now: Date;
  rule: ToggleableRule<number>;
};

export function resolveResponseDeadline(
  input: ResolveResponseDeadlineInput
): Date {
  if (!input.rule.enabled) {
    const farFuture = new Date(input.now);
    farFuture.setUTCFullYear(
      farFuture.getUTCFullYear() + NO_RESPONSE_DEADLINE_HORIZON_YEARS
    );
    return farFuture;
  }

  return buildResponseDeadline({
    now: input.now,
    responseDeadlineHours: input.rule.value,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/domains/league/tests/challenge-rules.test.ts`
Expected: PASS, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add convex/domains/league/challenge-rules.ts convex/domains/league/tests/challenge-rules.test.ts
git commit -m "feat(league): add resolveResponseDeadline helper"
```

---

## Task 7: Update the three `buildResponseDeadline` call sites in challenges.ts

**Files:**
- Modify: `convex/functions/league/challenges.ts`

- [ ] **Step 1: Add `resolveResponseDeadline` to the imports from challenge-rules**

Find the import line from `../../domains/league/challenge-rules` (or `@convex/...`). Add `resolveResponseDeadline` to its named imports.

- [ ] **Step 2: Replace call site 1 (challenge creation, ~line 1131)**

Find:

```ts
        responseDeadlineAt: buildResponseDeadline({
          now,
          responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
        }),
```

Replace with:

```ts
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
        }),
```

- [ ] **Step 3: Replace call site 2 (counter-proposal, ~line 1422)**

Find:

```ts
        responseDeadlineAt: buildResponseDeadline({
          now,
          responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
        }),
```

Replace with:

```ts
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
        }),
```

- [ ] **Step 4: Replace call site 3 (reopen challenge, ~line 2582)**

Find:

```ts
      const responseDeadlineAt = buildResponseDeadline({
        now,
        responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
      });
```

Replace with:

```ts
      const responseDeadlineAt = resolveResponseDeadline({
        now,
        rule: currentLeague.ruleConfig.responseDeadlineHours,
      });
```

- [ ] **Step 5: Update the challenge-creation rule call to use `resolveRuleValue` with Infinity**

Add `resolveRuleValue` to the contract import. Find the `resolveChallengeCreationRuleError` call (~line 632). Replace the three rule fields:

```ts
    maxActiveChallengesPerPlayer:
      input.league.ruleConfig.maxActiveChallengesPerPlayer,
    maxChallengeDistance: input.league.ruleConfig.maxChallengeDistance,
    maxChallengesPerMonth: input.league.ruleConfig.maxChallengesPerMonth,
```

Replace with:

```ts
    maxActiveChallengesPerPlayer: resolveRuleValue(
      input.league.ruleConfig.maxActiveChallengesPerPlayer,
      Number.POSITIVE_INFINITY
    ),
    maxChallengeDistance: resolveRuleValue(
      input.league.ruleConfig.maxChallengeDistance,
      Number.POSITIVE_INFINITY
    ),
    maxChallengesPerMonth: resolveRuleValue(
      input.league.ruleConfig.maxChallengesPerMonth,
      Number.POSITIVE_INFINITY
    ),
```

- [ ] **Step 6: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS (all backend type errors resolved).

- [ ] **Step 7: Commit**

```bash
git add convex/functions/league/challenges.ts
git commit -m "feat(league): consume toggleable rules and response deadline in challenges"
```

---

## Task 8: Add Infinity cases to challenge-creation-rules tests

**Files:**
- Modify: `convex/domains/league/tests/challenge-creation-rules.test.ts`

- [ ] **Step 1: Add tests confirming Infinity means "no limit"**

Append inside the `describe` block:

```ts
  it("allows any distance when maxChallengeDistance is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengedPosition: 1,
        challengerPosition: 500,
        maxChallengeDistance: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });

  it("allows any active challenge count when maxActiveChallengesPerPlayer is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerActiveChallengeCount: 99,
        challengedActiveChallengeCount: 99,
        maxActiveChallengesPerPlayer: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });

  it("allows any monthly count when maxChallengesPerMonth is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerCreatedThisMonthCount: 99,
        maxChallengesPerMonth: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test convex/domains/league/tests/challenge-creation-rules.test.ts`
Expected: PASS (all tests, including the three new ones).

- [ ] **Step 3: Commit**

```bash
git add convex/domains/league/tests/challenge-creation-rules.test.ts
git commit -m "test(league): cover Infinity fallback for disabled challenge rules"
```

---

## Task 9: Add contract tests for toggleable rules and scoring rename

**Files:**
- Modify: `convex/domains/league/tests/contract.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the top imports:

```ts
import {
  AdminManageLeagueChallengeSchema,
  ChallengeRuleConfigSchema,
  LeagueScoringModeOptions,
} from "../contract";
```

Append a new describe block:

```ts
describe("ChallengeRuleConfigSchema", () => {
  const validRuleConfig = {
    maxChallengeDistance: { enabled: true, value: 4 },
    maxActiveChallengesPerPlayer: { enabled: true, value: 1 },
    maxChallengesPerMonth: { enabled: true, value: 4 },
    responseDeadlineHours: { enabled: true, value: 48 },
    challengeValidationMode: "automatic",
    resultValidationMode: "automatic",
    winBehavior: "take_opponent_position",
    lossBehavior: "stay_put",
    walkoverBehavior: "automatic_loss",
    newPlayerPlacement: "end_of_ranking",
    matchConfig: {
      bestOfSets: 3,
      gamesPerSet: 6,
      defaultDurationMinutes: 90,
      scoringMode: "advantage",
      setMustWinByTwoGames: true,
      hasTieBreak: true,
      tieBreakAtGamesAll: 6,
      tieBreakPoints: 7,
      tieBreakMustWinByTwo: true,
      finalSetMode: "same_as_previous",
      finalSetGamesPerSet: 6,
      finalSetScoringMode: "advantage",
      finalSetMustWinByTwoGames: true,
      finalSetHasTieBreak: true,
      finalSetTieBreakAtGamesAll: 6,
      finalSetTieBreakPoints: 7,
      finalSetTieBreakMustWinByTwo: true,
      finalSetSuperTieBreakPoints: 10,
      finalSetSuperTieBreakMustWinByTwo: true,
    },
    hasInactivityPenalty: false,
  };

  it("accepts a valid rule config with toggleable rules", () => {
    const result = ChallengeRuleConfigSchema.safeParse(validRuleConfig);
    expect(result.success).toBe(true);
  });

  it("keeps validating the value when a toggleable rule is disabled", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      maxChallengeDistance: { enabled: false, value: 4 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a toggleable rule missing the value", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      maxChallengeDistance: { enabled: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a required enum that is missing", () => {
    const { winBehavior: _omit, ...rest } = validRuleConfig;
    const result = ChallengeRuleConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("LeagueScoringModeOptions", () => {
  it("uses no_advantage instead of no_ad", () => {
    expect(LeagueScoringModeOptions).toContain("no_advantage");
    expect(LeagueScoringModeOptions).not.toContain("no_ad");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test convex/domains/league/tests/contract.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/domains/league/tests/contract.test.ts
git commit -m "test(league): cover toggleable rule config and scoring rename"
```

---

## Task 10: Create the league migration for toggleable rules + scoring rename

**Files:**
- Create: `convex/functions/migrations/20260623_000001_toggleable_rule_config.ts`
- Modify: `convex/functions/migrations/manifest.ts`

Note: `defineMigration` takes a single `up: { table, migrateOne }` step (one table per migration). The challenge snapshot table is migrated separately in Task 10b.

- [ ] **Step 1: Create the league migration file**

Create `convex/functions/migrations/20260623_000001_toggleable_rule_config.ts`:

```ts
import { defineMigration } from "../generated/migrations.gen";

const TOGGLEABLE_RULE_FIELDS = [
  "maxChallengeDistance",
  "maxActiveChallengesPerPlayer",
  "maxChallengesPerMonth",
  "responseDeadlineHours",
] as const;

const SCORING_FIELDS = ["scoringMode", "finalSetScoringMode"] as const;

function isPlainNumber(value: unknown): value is number {
  return typeof value === "number";
}

function wrapToggleableRules(
  ruleConfig: Record<string, unknown>
): Record<string, unknown> | null {
  let changed = false;
  const next: Record<string, unknown> = { ...ruleConfig };

  for (const field of TOGGLEABLE_RULE_FIELDS) {
    const current = next[field];

    // Already migrated: skip.
    if (
      current !== null &&
      typeof current === "object" &&
      "enabled" in (current as Record<string, unknown>)
    ) {
      continue;
    }

    if (isPlainNumber(current)) {
      next[field] = { enabled: true, value: current };
      changed = true;
    }
  }

  return changed ? next : null;
}

export function renameScoringValues(
  matchConfig: unknown
): Record<string, unknown> | null {
  if (matchConfig === null || typeof matchConfig !== "object") {
    return null;
  }

  const next = { ...(matchConfig as Record<string, unknown>) };
  let changed = false;

  for (const field of SCORING_FIELDS) {
    if (next[field] === "no_ad") {
      next[field] = "no_advantage";
      changed = true;
    }
  }

  return changed ? next : null;
}

export const migration = defineMigration({
  id: "20260623_000001_toggleable_rule_config",
  description: "toggleable_rule_config",
  up: {
    table: "league",
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const ruleConfig = record.ruleConfig as
        | Record<string, unknown>
        | undefined;
      if (!ruleConfig) {
        return;
      }

      const nextRuleConfig: Record<string, unknown> = { ...ruleConfig };
      let changed = false;

      const wrapped = wrapToggleableRules(ruleConfig);
      if (wrapped) {
        Object.assign(nextRuleConfig, wrapped);
        changed = true;
      }

      const renamedMatchConfig = renameScoringValues(ruleConfig.matchConfig);
      if (renamedMatchConfig) {
        nextRuleConfig.matchConfig = renamedMatchConfig;
        changed = true;
      }

      if (!changed) {
        return;
      }

      return ctx.db.patch(record._id as Parameters<typeof ctx.db.patch>[0], {
        ruleConfig: nextRuleConfig,
      });
    },
  },
});
```

- [ ] **Step 2: Register the migration in manifest.ts**

Add the import after `migration_6`:

```ts
import { migration as migration_7 } from './20260623_000001_toggleable_rule_config';
```

Add `migration_7` to the `defineMigrationSet` array (after `migration_6,`).

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/functions/migrations/20260623_000001_toggleable_rule_config.ts convex/functions/migrations/manifest.ts
git commit -m "feat(league): add league migration for toggleable rules and scoring"
```

---

## Task 10b: Create the leagueChallenge migration for scoring rename in snapshots

**Files:**
- Create: `convex/functions/migrations/20260623_000002_challenge_scoring_snapshot.ts`
- Modify: `convex/functions/migrations/manifest.ts`

- [ ] **Step 1: Create the challenge snapshot migration file**

Create `convex/functions/migrations/20260623_000002_challenge_scoring_snapshot.ts`:

```ts
import { defineMigration } from "../generated/migrations.gen";
import { renameScoringValues } from "./20260623_000001_toggleable_rule_config";

// Challenge match config snapshots are frozen per challenge, so they must be
// migrated independently of the league rule config. This migration rewrites
// any no_ad scoring values inside the snapshot to no_advantage.
export const migration = defineMigration({
  id: "20260623_000002_challenge_scoring_snapshot",
  description: "challenge_scoring_snapshot",
  up: {
    table: "leagueChallenge",
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const renamedMatchConfig = renameScoringValues(
        record.matchConfigSnapshot
      );
      if (!renamedMatchConfig) {
        return;
      }

      return ctx.db.patch(record._id as Parameters<typeof ctx.db.patch>[0], {
        matchConfigSnapshot: renamedMatchConfig,
      });
    },
  },
});
```

- [ ] **Step 2: Register the migration in manifest.ts**

Add the import after `migration_7`:

```ts
import { migration as migration_8 } from './20260623_000002_challenge_scoring_snapshot';
```

Add `migration_8` to the `defineMigrationSet` array (after `migration_7,`).

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/functions/migrations/20260623_000002_challenge_scoring_snapshot.ts convex/functions/migrations/manifest.ts
git commit -m "feat(league): migrate challenge match config snapshot scoring"
```



---

## Task 11: Move `resultValidationMode` to the Result tab in the rules screen

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/rules.tsx`

- [ ] **Step 1: Remove `resultValidationMode` from the `ChallengeRulesSection`**

In `ChallengeRulesSection`, remove `resultValidationMode` from the `useFormState` name array and the `useWatch` array (lines ~191, ~201). Also remove the entire `RuleCard` for "Validação do resultado" (the `<RuleCard>...</RuleCard>` block around lines 409-445 that renders `resultValidationMode`).

After this, `ChallengeRulesSection` renders only: maxChallengeDistance, maxActiveChallengesPerPlayer, maxChallengesPerMonth, responseDeadlineHours, challengeValidationMode.

- [ ] **Step 2: Add `resultValidationMode` to the `ResultRulesSection`**

In `ResultRulesSection`, add `resultValidationMode` to the `useFormState` and `useWatch` arrays alongside `winBehavior`, `lossBehavior`, `walkoverBehavior`.

Then append the validation segment card at the end of the returned fragment (after the walkover card). Reuse the same `validationModeOptions` already defined at the top of the file:

```tsx
      <RuleCard>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.resultValidationMode)}
          isRequired
        >
          <Label>Validação do resultado</Label>
          <Description className="-mt-1.5 mb-1">
            Define se o resultado confirmado entre os jogadores já vale ou
            precisa da aprovação do admin.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.resultValidationMode",
                nextValue as RuleConfig["resultValidationMode"],
                fieldUpdateOptions
              );
            }}
            value={resultValidationMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {validationModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.resultValidationMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/rules.tsx
git commit -m "refactor(league): move result validation rule to Result tab"
```

---

## Task 12: Convert the four Desafios rule cards to the toggle pattern

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/rules.tsx`

- [ ] **Step 1: Add a `ToggleableRuleCard` shared component**

Add this component near the other helpers (after `RuleExpandableContent`):

```tsx
type ToggleableRuleCardProps<T> = {
  enabled: boolean;
  isDisabled?: boolean;
  description: string;
  label: string;
  onToggle: (nextEnabled: boolean) => void;
  children: ReactNode;
};

function ToggleableRuleCard<T>(props: ToggleableRuleCardProps<T>) {
  const {
    children,
    description,
    enabled,
    isDisabled,
    label,
    onToggle,
  } = props;

  return (
    <RuleCard>
      <PressableFeedback
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled, disabled: isDisabled }}
        className="flex-row items-center gap-3"
        isDisabled={isDisabled}
        onPress={() => onToggle(!enabled)}
      >
        <Checkbox
          className="mt-0.5"
          isDisabled={isDisabled}
          isSelected={enabled}
          pointerEvents="none"
        />
        <View className="flex-1 gap-0" pointerEvents="none">
          <Label>{label}</Label>
          <Description className="-mt-1.5 mb-1">{description}</Description>
        </View>
      </PressableFeedback>

      {enabled ? (
        <RuleExpandableContent>{children}</RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
}
```

- [ ] **Step 2: Convert the `maxChallengeDistance` card to a toggle card**

In `ChallengeRulesSection`, find the first `RuleCard` (the "Pode desafiar quantas posições acima?" NumberStepper). Replace the whole `<RuleCard>...</RuleCard>` block with:

```tsx
      <ToggleableRuleCard
        description="Ative para definir quantas posições acima um jogador pode desafiar."
        enabled={maxChallengeDistance.enabled}
        isDisabled={isDisabled}
        label="Pode desafiar quantas posições acima?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengeDistance.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.maxChallengeDistance?.value)}
          isRequired
        >
          <Label>Pode desafiar quantas posições acima?</Label>
          <Description className="-mt-1.5 mb-1">
            Define quantas posições acima um jogador pode desafiar.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengeDistance.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengeDistance.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengeDistance.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengeDistance?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>
```

- [ ] **Step 3: Convert `maxActiveChallengesPerPlayer` card to a toggle card**

Replace its `RuleCard` with:

```tsx
      <ToggleableRuleCard
        description="Ative para limitar quantos desafios em aberto cada jogador pode ter."
        enabled={maxActiveChallengesPerPlayer.enabled}
        isDisabled={isDisabled}
        label="Máx. desafios ativos por jogador?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxActiveChallengesPerPlayer.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.maxActiveChallengesPerPlayer?.value
          )}
          isRequired
        >
          <Label>Máx. desafios ativos por jogador?</Label>
          <Description className="-mt-1.5 mb-1">
            Limite de desafios em aberto ao mesmo tempo para cada jogador.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={maxActiveChallengesPerPlayer.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxActiveChallengesPerPlayer.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxActiveChallengesPerPlayer.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxActiveChallengesPerPlayer?.value?.message ??
              ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>
```

- [ ] **Step 4: Convert `maxChallengesPerMonth` card to a toggle card**

Replace its `RuleCard` with:

```tsx
      <ToggleableRuleCard
        description="Ative para limitar quantos desafios cada jogador pode abrir por mês."
        enabled={maxChallengesPerMonth.enabled}
        isDisabled={isDisabled}
        label="Máx. desafios por mês?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengesPerMonth.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.maxChallengesPerMonth?.value
          )}
          isRequired
        >
          <Label>Máx. desafios por mês?</Label>
          <Description className="-mt-1.5 mb-1">
            Quantidade máxima de desafios que cada jogador pode abrir no mês.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengesPerMonth.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengesPerMonth.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengesPerMonth.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengesPerMonth?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>
```

- [ ] **Step 5: Convert `responseDeadlineHours` card to a toggle card**

Replace its `RuleCard` with:

```tsx
      <ToggleableRuleCard
        description="Ative para definir um prazo para o adversário responder o desafio."
        enabled={responseDeadlineHours.enabled}
        isDisabled={isDisabled}
        label="Prazo para responder desafio"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.responseDeadlineHours.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.responseDeadlineHours?.value
          )}
          isRequired
        >
          <Label>Prazo para responder desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Tempo que o adversário tem para aceitar ou recusar o desafio.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.responseDeadlineHours.value",
                Number(nextValue),
                fieldUpdateOptions
              );
            }}
            value={String(responseDeadlineHours.value)}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                <Segment.Item value="12">
                  <Segment.Label>12 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="24">
                  <Segment.Label>24 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="48">
                  <Segment.Label>48 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="72">
                  <Segment.Label>3 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="120">
                  <Segment.Label>5 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="168">
                  <Segment.Label>7 dias</Segment.Label>
                </Segment.Item>
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.responseDeadlineHours?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>
```

- [ ] **Step 6: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/rules.tsx
git commit -m "feat(league): toggleable cards for desafios rules"
```

---

## Task 13: Rename the scoring option label in the rules screen

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/rules.tsx`

- [ ] **Step 1: Update `scoringModeOptions`**

Find `scoringModeOptions` (lines ~100-109):

```ts
const scoringModeOptions = [
  {
    label: "Com vantagem",
    value: "advantage" as const,
  },
  {
    label: "No-ad",
    value: "no_ad" as const,
  },
];
```

Replace with:

```ts
const scoringModeOptions = [
  {
    label: "Com vantagem",
    value: "advantage" as const,
  },
  {
    label: "Sem vantagem",
    value: "no_advantage" as const,
  },
];
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/rules.tsx
git commit -m "refactor(league): rename scoring option label to Sem vantagem"
```

---

## Task 14: Update `formatScoringMode` in both consumer files

**Files:**
- Modify: `src/lib/leagues/league-details-derived.ts`
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`

- [ ] **Step 1: Update `formatScoringMode` in `league-details-derived.ts`**

Find (line ~323):

```ts
function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_ad":
      return "No-ad";
    default:
      return "Com vantagem";
  }
}
```

Replace with:

```ts
function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_advantage":
      return "Sem vantagem";
    default:
      return "Com vantagem";
  }
}
```

- [ ] **Step 2: Update `formatScoringMode` in `index.tsx`**

Find (line ~124):

```ts
function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_ad":
      return "sem vantagem";
    default:
      return "com vantagem";
  }
}
```

Replace with:

```ts
function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_advantage":
      return "sem vantagem";
    default:
      return "com vantagem";
  }
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/leagues/league-details-derived.ts src/app/(private)/leagues/[leagueId]/index.tsx
git commit -m "refactor(league): use no_advantage in scoring formatters"
```

---

## Task 15: Fix the FinalSetSection card structure

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/rules.tsx`

- [ ] **Step 1: Restructure `FinalSetSection` to mirror TieBreakSection**

The current `FinalSetSection` renders a standalone `RuleCard` for the `finalSetMode` select, then conditional `RuleExpandableContent` siblings that each contain a nested `RuleCard variant="secondary"`. Replace the entire `FinalSetSection` return with a single `RuleCard` (default variant) that owns the select and the expandable content. The full replacement for the `return (...)` of `FinalSetSection`:

```tsx
  return (
    <RuleCard>
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.finalSetMode)}
      >
        <Label>Formato do último set</Label>
        <Description className="-mt-1.5 mb-1">
          Escolha se o último set segue igual, vira um set próprio ou um super
          tie-break.
        </Description>
        <Select
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            if (nextValue && !Array.isArray(nextValue)) {
              setValue(
                "ruleConfig.matchConfig.finalSetMode",
                nextValue.value as MatchConfig["finalSetMode"],
                fieldUpdateOptions
              );
            }
          }}
          selectionMode={"single"}
          value={getSelectedOption(finalSetModeOptions, finalSetMode)}
        >
          <Select.Trigger className="bg-surface-secondary">
            <Select.Value
              className="font-normal"
              numberOfLines={1}
              placeholder="Escolha uma opção"
            />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              <Select.ListLabel className="mb-2">
                Escolha uma opção
              </Select.ListLabel>
              {finalSetModeOptions.map((option) => (
                <SelectOptionItem
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.finalSetMode?.message ?? ""}
        </FieldError>
      </TextField>

      {finalSetMode === "custom_set" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetGamesPerSet
            )}
            isRequired
          >
            <Label>Quantos games no último set?</Label>
            <Description className="-mt-1.5 mb-1">
              Quantidade padrão de games para o último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetGamesPerSet}
              isDisabled={isDisabled}
              maxValue={12}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetGamesPerSet",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetGamesPerSet}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetGamesPerSet?.message ??
                ""}
            </FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetScoringMode
            )}
          >
            <Label>Pontuação do último set</Label>
            <Description className="-mt-1.5 mb-1">
              Escolha se o último set usa vantagem ou no-ad.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  setValue(
                    "ruleConfig.matchConfig.finalSetScoringMode",
                    nextValue.value as MatchConfig["finalSetScoringMode"],
                    fieldUpdateOptions
                  );
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(
                scoringModeOptions,
                finalSetScoringMode
              )}
            >
              <Select.Trigger className="bg-surface-secondary">
                <Select.Value
                  className="font-normal"
                  numberOfLines={1}
                  placeholder="Escolha uma opção"
                />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover" width="trigger">
                  <Select.ListLabel className="mb-2">
                    Escolha uma opção
                  </Select.ListLabel>
                  {scoringModeOptions.map((option) => (
                    <SelectOptionItem
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetScoringMode?.message ??
                ""}
            </FieldError>
          </TextField>

          <PressableFeedback
            accessibilityLabel="Vencer o último set por 2 games"
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: finalSetMustWinByTwoGames,
              disabled: isDisabled,
            }}
            className="flex-row items-center gap-3"
            isDisabled={isDisabled}
            onPress={() => {
              setValue(
                "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
                !finalSetMustWinByTwoGames,
                fieldUpdateOptions
              );
            }}
          >
            <Checkbox
              className="mt-0.5"
              isDisabled={isDisabled}
              isSelected={finalSetMustWinByTwoGames}
              pointerEvents="none"
            />
            <View className="flex-1 gap-0" pointerEvents="none">
              <Label>Vencer o último set por 2 games</Label>
              <Description className="-mt-1.5 mb-1">
                Ative para exigir dois games de diferença no último set.
              </Description>
            </View>
          </PressableFeedback>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetMustWinByTwoGames
              ?.message ?? ""}
          </FieldError>

          <PressableFeedback
            accessibilityLabel="Tie-break no último set"
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: finalSetHasTieBreak,
              disabled: isDisabled,
            }}
            className="flex-row items-center gap-3"
            isDisabled={isDisabled}
            onPress={() => {
              setValue(
                "ruleConfig.matchConfig.finalSetHasTieBreak",
                !finalSetHasTieBreak,
                fieldUpdateOptions
              );
            }}
          >
            <Checkbox
              className="mt-0.5"
              isDisabled={isDisabled}
              isSelected={finalSetHasTieBreak}
              pointerEvents="none"
            />
            <View className="flex-1 gap-0" pointerEvents="none">
              <Label>Tie-break no último set</Label>
              <Description className="-mt-1.5 mb-1">
                Ative para configurar tie-break também no último set.
              </Description>
            </View>
          </PressableFeedback>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetHasTieBreak?.message ??
              ""}
          </FieldError>

          {finalSetHasTieBreak ? (
            <RuleExpandableContent>
              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                )}
                isRequired
              >
                <Label>Em qual placar entra o tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Exemplo: informe 6 para tie-break final em 6x6.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakAtGamesAll}
                  isDisabled={isDisabled}
                  maxValue={12}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakAtGamesAll}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                )}
                isRequired
              >
                <Label>Quantos pontos no tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Pontuação padrão do tie-break no último set.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakPoints}
                  isDisabled={isDisabled}
                  maxValue={30}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakPoints",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakPoints}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <PressableFeedback
                accessibilityLabel="Vencer o tie-break do último set por 2 pontos"
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: finalSetTieBreakMustWinByTwo,
                  disabled: isDisabled,
                }}
                className="flex-row items-center gap-3"
                isDisabled={isDisabled}
                onPress={() => {
                  setValue(
                    "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
                    !finalSetTieBreakMustWinByTwo,
                    fieldUpdateOptions
                  );
                }}
              >
                <Checkbox
                  className="mt-0.5"
                  isDisabled={isDisabled}
                  isSelected={finalSetTieBreakMustWinByTwo}
                  pointerEvents="none"
                />
                <View className="flex-1 gap-0" pointerEvents="none">
                  <Label>Vencer o tie-break final por 2 pontos</Label>
                  <Description className="-mt-1.5 mb-1">
                    Ative para exigir dois pontos de diferença no tie-break do
                    último set.
                  </Description>
                </View>
              </PressableFeedback>
              <FieldError>
                {errors.ruleConfig?.matchConfig?.finalSetTieBreakMustWinByTwo
                  ?.message ?? ""}
              </FieldError>
            </RuleExpandableContent>
          ) : null}
        </RuleExpandableContent>
      ) : null}

      {finalSetMode === "super_tiebreak" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
            )}
            isRequired
          >
            <Label>Quantos pontos no super tie-break?</Label>
            <Description className="-mt-1.5 mb-1">
              Pontuação padrão do super tie-break no lugar do último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetSuperTieBreakPoints}
              isDisabled={isDisabled}
              maxValue={30}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetSuperTieBreakPoints}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
                ?.message ?? ""}
            </FieldError>
          </TextField>

          <PressableFeedback
            accessibilityLabel="Vencer o super tie-break por 2 pontos"
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: finalSetSuperTieBreakMustWinByTwo,
              disabled: isDisabled,
            }}
            className="flex-row items-center gap-3"
            isDisabled={isDisabled}
            onPress={() => {
              setValue(
                "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
                !finalSetSuperTieBreakMustWinByTwo,
                fieldUpdateOptions
              );
            }}
          >
            <Checkbox
              className="mt-0.5"
              isDisabled={isDisabled}
              isSelected={finalSetSuperTieBreakMustWinByTwo}
              pointerEvents="none"
            />
            <View className="flex-1 gap-0" pointerEvents="none">
              <Label>Vencer o super tie-break por 2 pontos</Label>
              <Description className="-mt-1.5 mb-1">
                Ative para exigir dois pontos de diferença no super tie-break.
              </Description>
            </View>
          </PressableFeedback>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakMustWinByTwo
              ?.message ?? ""}
          </FieldError>
        </RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
```

Key change: a single `RuleCard` (default variant) wraps the select and both conditional `RuleExpandableContent` blocks. The nested `RuleCard variant="secondary"` is removed.

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/rules.tsx
git commit -m "fix(league): restructure final-set card to single expandable card"
```

---

## Task 16: Consolidate the "Entrada na liga" settings card

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/settings.tsx`

- [ ] **Step 1: Invert the toggle helper and derived flag**

Find (lines ~101, ~117-119):

```ts
  const hasUnlimitedSpots = maxPlayers === null;
```

```ts
  function toggleUnlimitedSpots() {
    setValue("maxPlayers", hasUnlimitedSpots ? 20 : null, fieldUpdateOptions);
  }
```

Replace with:

```ts
  const hasLimitedSpots = maxPlayers !== null;
```

```ts
  function toggleLimitedSpots() {
    setValue("maxPlayers", hasLimitedSpots ? null : 20, fieldUpdateOptions);
  }
```

- [ ] **Step 2: Replace the card block (lines ~212-276) with the consolidated card**

Find the `AnimatedSurface` block for "Entrada na liga" (starts with `<AnimatedSurface className="gap-4" layout={AccordionLayoutTransition}>` and the `<View>` with `<Text weight="medium">Entrada na liga</Text>`). Replace the entire block down to its closing `</AnimatedSurface>` with:

```tsx
          <AnimatedSurface className="gap-4" layout={AccordionLayoutTransition}>
            <PressableFeedback
              accessibilityLabel="Limitar vagas"
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: hasLimitedSpots,
                disabled: isDisabled,
              }}
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={toggleLimitedSpots}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={hasLimitedSpots}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Limitar vagas</Label>
                <Description className="-mt-1.5">
                  Ative para definir quantos jogadores podem entrar na liga.
                </Description>
              </View>
            </PressableFeedback>

            {hasLimitedSpots ? (
              <Animated.View
                entering={SETTINGS_CONTENT_ENTERING}
                exiting={SETTINGS_CONTENT_EXITING}
                layout={AccordionLayoutTransition}
              >
                <TextField isInvalid={Boolean(maxPlayersError)} isRequired>
                  <Label>Quantidade de vagas</Label>
                  <Description className="-mt-1.5 mb-1">
                    Número máximo de jogadores ativos na liga.
                  </Description>
                  <NumberStepper
                    className="self-start"
                    defaultValue={maxPlayers ?? 20}
                    isDisabled={isDisabled}
                    maxValue={500}
                    minValue={1}
                    onValueChange={(nextValue) => {
                      setValue("maxPlayers", nextValue, fieldUpdateOptions);
                    }}
                    step={1}
                    value={maxPlayers ?? 20}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                  <FieldError>{maxPlayersError ?? ""}</FieldError>
                </TextField>
              </Animated.View>
            ) : null}
          </AnimatedSurface>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/settings.tsx
git commit -m "refactor(league): consolidate entrada na liga card with active toggle"
```

---

## Task 17: Consolidate the "Preço" settings card

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/settings.tsx`

- [ ] **Step 1: Invert the toggle helper and derived flag**

Find (lines ~102, ~121-127):

```ts
  const isFree = (monthlyPriceCents ?? 0) <= 0;
```

```ts
  function toggleFreePrice() {
    setValue(
      "monthlyPriceCents",
      isFree ? DEFAULT_PAID_PRICE_CENTS : 0,
      fieldUpdateOptions
    );
  }
```

Replace with:

```ts
  const hasPaidPrice = (monthlyPriceCents ?? 0) > 0;
```

```ts
  function togglePaidPrice() {
    setValue(
      "monthlyPriceCents",
      hasPaidPrice ? 0 : DEFAULT_PAID_PRICE_CENTS,
      fieldUpdateOptions
    );
  }
```

- [ ] **Step 2: Replace the card block (lines ~278-...) with the consolidated card**

Find the `AnimatedSurface` block for "Preço" (starts with `<Text weight="medium">Preço</Text>`). Replace the entire block down to its closing `</AnimatedSurface>` with:

```tsx
          <AnimatedSurface className="gap-4" layout={AccordionLayoutTransition}>
            <PressableFeedback
              accessibilityLabel="Cobrança"
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: hasPaidPrice,
                disabled: isDisabled,
              }}
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={togglePaidPrice}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={hasPaidPrice}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Cobrança</Label>
                <Description className="-mt-1.5">
                  Ative para definir uma mensalidade para a liga.
                </Description>
              </View>
            </PressableFeedback>

            {hasPaidPrice ? (
              <Animated.View
                className="gap-4"
                entering={SETTINGS_CONTENT_ENTERING}
                exiting={SETTINGS_CONTENT_EXITING}
                layout={AccordionLayoutTransition}
              >
                <NumberField
                  formatOptions={{
                    currency: "BRL",
                    style: "currency",
                  }}
                  isDisabled={isDisabled}
                  isInvalid={Boolean(monthlyPriceCentsError)}
                  isRequired
                  minValue={0}
                  onChange={(nextValue) => {
                    setValue(
                      "monthlyPriceCents",
                      Math.max(0, Math.round(nextValue * 100)),
                      fieldUpdateOptions
                    );
                  }}
                  step={5}
                  value={(monthlyPriceCents ?? 0) / 100}
                >
                  <Label>Valor</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input keyboardType="decimal-pad" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>Valor cobrado no período escolhido.</Description>
                  <FieldError>{monthlyPriceCentsError ?? ""}</FieldError>
                </NumberField>

                <TextField
                  isInvalid={Boolean(priceBillingIntervalError)}
                  isRequired
                >
                  <Label>Cobrança</Label>
                  <Segment
                    isDisabled={isDisabled}
                    onValueChange={(nextValue) => {
                      if (nextValue) {
                        setValue(
                          "priceBillingInterval",
                          nextValue as LeagueScreenValues["priceBillingInterval"],
                          fieldUpdateOptions
                        );
                      }
                    }}
                    value={priceBillingInterval}
                  >
                    <Segment.Group>
                      <Segment.ScrollView>
                        <Segment.Indicator />
                        {priceBillingIntervalOptions.map((option) => (
                          <Segment.Item key={option.value} value={option.value}>
                            <Segment.Label>{option.label}</Segment.Label>
                          </Segment.Item>
                        ))}
                      </Segment.ScrollView>
                    </Segment.Group>
                  </Segment>
                  <FieldError>{priceBillingIntervalError ?? ""}</FieldError>
                </TextField>
              </Animated.View>
            ) : null}
          </AnimatedSurface>
```

Note: the `Text` import from `@/components/core/text` may become unused after removing the section titles. If so, remove it from the imports to satisfy the linter.

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/settings.tsx
git commit -m "refactor(league): consolidate preço card with active toggle"
```

---

## Task 18: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 3: Run ultracite check**

Run: `bun x ultracite check`
Expected: No errors.

- [ ] **Step 4: Run git diff check**

Run: `git diff --check`
Expected: No whitespace errors.

- [ ] **Step 5: Manual smoke check of codegen freshness**

Run: `bun run codegen && git status --short`
Expected: no changes (codegen output is already committed and current).

If changes appear, commit them:

```bash
git add convex/functions/_generated/
git commit -m "chore(league): refresh generated api for toggleable rules"
```
