# League Toggleable Rules Design

## Goal

Allow league organizers to enable or disable specific challenge rules on the
league rules screen, instead of forcing every rule to be defined.

Today every field in `ChallengeRuleConfigSchema` is required. The organizer
cannot say "I do not want a challenge distance limit" or "I do not want a
monthly challenge cap". This slice turns a defined subset of rules into
toggleable rules while keeping the remaining rules required with a safe
default.

The toggle UI reuses the existing animated `Checkbox` + `RuleExpandableContent`
card pattern already used by `InactivityPenaltySection`, `TieBreakSection`, and
`FinalSetSection`.

## Product Constraints

- Only a defined subset of rules become toggleable.
- The remaining rules stay required with a safe default.
- Toggleable rules preserve their last value when disabled, so re-enabling
  restores the previously configured value.
- A newly created league has all toggleable rules enabled by default.
- The toggle UI uses the existing animated checkbox card pattern.
- There is no separate save action. Rules still save through the existing league
  edit/create flow.
- The rules screen still has the same four tabs: `Desafios`, `Resultado`,
  `Ranking`, `Partidas`.

## Toggleable Rules

Only the following rules become toggleable:

| Tab | Rule | Off behavior |
|-----|------|--------------|
| `Desafios` | `maxChallengeDistance` | No distance limit. Any player can challenge any player above them. |
| `Desafios` | `maxActiveChallengesPerPlayer` | No active challenge limit per player. |
| `Desafios` | `maxChallengesPerMonth` | No monthly challenge cap. |
| `Desafios` | `responseDeadlineHours` | No response deadline. Challenges stay open until the opponent responds. |
| `Ranking` | `hasInactivityPenalty` | No inactivity penalty. Already toggleable today. |

The `hasInactivityPenalty` rule already uses the toggle pattern and is only
listed for completeness. It is the reference shape for the others.

## Required Rules (No Toggle)

The following rules stay required with a safe default and are never disabled:

| Tab | Rule | Reason |
|-----|------|--------|
| `Desafios` | `challengeValidationMode` | A challenge must always be validated (automatic or manual). |
| `Resultado` | `resultValidationMode` | A result must always be validated (automatic or manual). |
| `Resultado` | `winBehavior` | The ranking must always react to a win. |
| `Resultado` | `lossBehavior` | The ranking must always react to a loss. |
| `Resultado` | `walkoverBehavior` | A walkover must always resolve to a defined behavior. |
| `Ranking` | `newPlayerPlacement` | A new player must always enter at a defined position. |
| `Partidas` | `matchConfig.*` | Match structure is mandatory. |

## Out of Scope

- Implementing the inactivity penalty enforcement in the backend. It remains
  configuration-only for now, exactly as today.
- Splitting `matchConfig` into sub-toggleable rules. The `matchConfig` block
  keeps its current internal toggles (`hasTieBreak`, etc.) but is not part of
  this slice.
- New tabs or reordering the existing four tabs.
- Changing how a disabled rule is displayed to the player on the challenge
  screen beyond not blocking the action.

## Tab Reorganization

Today `Validação do resultado` (`resultValidationMode`) lives on the `Desafios`
tab. It belongs on the `Resultado` tab because it controls what happens after a
result is submitted.

This slice moves only that one card:

- `Desafios` keeps: `maxChallengeDistance`, `maxActiveChallengesPerPlayer`,
  `maxChallengesPerMonth`, `responseDeadlineHours`, `challengeValidationMode`.
- `Resultado` gains: `resultValidationMode` plus the existing `winBehavior`,
  `lossBehavior`, `walkoverBehavior`.

No other card changes tab.

## Scoring Mode Rename

The match scoring option `no_ad` is shown in the UI as "No-ad", which is tennis
jargon unfamiliar to most organizers. This slice renames both the displayed
label and the stored value to `sem_vantagem` ("Sem vantagem") so the data model
stays self-explanatory.

Because dev and prod have no active users, the rename ships as a label-plus-value
change with a data migration.

### Source of truth

- `convex/domains/league/contract.ts`:
  - `LeagueScoringModeOptions`: `["advantage", "no_ad"]` →
    `["advantage", "sem_vantagem"]`.
  - `DEFAULT_LEAGUE_MATCH_CONFIG.scoringMode`: stays `"advantage"` (no change
    needed; the default is unaffected).
- `convex/domains/seed/data.ts`: seed default stays `"advantage"`.

### Generated code

`convex/functions/_generated/api.ts` references the option across ~26 type
positions. It regenerates from the contract via `bun run codegen`, so it needs
no manual edit beyond running codegen.

### UI consumers

- `src/app/(private)/settings/leagues/[mode]/rules.tsx`:
  - `scoringModeOptions`: change the `no_ad` option label from "No-ad" to "Sem
    vantagem" and its `value` from `"no_ad"` to `"sem_vantagem"`. This option is
    reused for both the regular and final-set scoring selects.
- `src/app/(private)/leagues/[leagueId]/index.tsx` and
  `src/lib/leagues/league-details-derived.ts`:
  - `formatScoringMode`: update the branch that maps the stored value to the
    display string so `sem_vantagem` renders as "Sem vantagem".

### Migration

The same migration file as the toggleable rules
(`20260623_000001_toggleable_rule_config.ts`) handles the scoring rename, since
both rewrite `ruleConfig`. The migration must transform every stored scoring
value in two places:

1. `league.ruleConfig.matchConfig.scoringMode`
2. `league.ruleConfig.matchConfig.finalSetScoringMode`
3. `leagueChallenge.matchConfigSnapshot.scoringMode`
4. `leagueChallenge.matchConfigSnapshot.finalSetScoringMode`

Transform rule: `"no_ad"` → `"sem_vantagem"`. Leave `"advantage"` untouched.
The migration must be idempotent (skip values already migrated).

## Data Design

### Shape

Each toggleable rule becomes an object `{ enabled: boolean; value: T }`. The
`value` is always present, even when `enabled` is `false`, so the last
configured value is preserved.

`hasInactivityPenalty` keeps its current shape because it does not wrap a
single scalar value (it gates `inactivityPenaltyType` and
`inactivityPenaltyDays`). Only the four `Desafios` rules change shape.

A helper encodes the wrapper so the contract and form stay in sync:

```ts
function toggleableRule<T>(value: z.ZodType<T>) {
  return z.object({
    enabled: z.boolean(),
    value,
  });
}

type ToggleableRule<T> = z.infer<ReturnType<typeof toggleableRule<T>>>;
```

### Updated `ChallengeRuleConfigSchema`

```ts
export const ChallengeRuleConfigSchema = z
  .object({
    maxChallengeDistance: toggleableRule(
      requiredNumber(
        "Informe a distância máxima do desafio.",
        "Informe uma distância máxima válida."
      ).min(1, "Informe uma distância máxima válida.")
    ),
    maxActiveChallengesPerPlayer: toggleableRule(
      requiredNumber(
        "Informe o limite de desafios ativos por jogador.",
        "Informe um limite de desafios ativos válido."
      ).min(1, "Informe um limite de desafios ativos válido.")
    ),
    maxChallengesPerMonth: toggleableRule(
      requiredNumber(
        "Informe o limite mensal de desafios.",
        "Informe um limite mensal de desafios válido."
      ).min(1, "Informe um limite mensal de desafios válido.")
    ),
    responseDeadlineHours: toggleableRule(
      requiredNumber(
        "Informe o prazo de resposta em horas.",
        "Informe um prazo de resposta válido."
      )
    ),
    challengeValidationMode: z.enum(LeagueChallengeValidationModeOptions),
    resultValidationMode: z.enum(LeagueResultValidationModeOptions),
    winBehavior: z.enum(LeagueWinBehaviorOptions),
    lossBehavior: z.enum(LeagueLossBehaviorOptions),
    walkoverBehavior: z.enum(LeagueWalkoverBehaviorOptions),
    newPlayerPlacement: z.enum(LeagueNewPlayerPlacementOptions),
    matchConfig: LeagueMatchConfigSchema.default(
      DEFAULT_LEAGUE_MATCH_CONFIG
    ).catch(DEFAULT_LEAGUE_MATCH_CONFIG),
    hasInactivityPenalty: z.boolean(),
    inactivityPenaltyType: z
      .enum(LeagueInactivityPenaltyTypeOptions)
      .optional(),
    inactivityPenaltyDays: z.number().int().positive().optional(),
  })
  .superRefine(/* existing inactivity penalty validation, unchanged */);
```

### Defaults

A new constant defines the default toggleable rules, all enabled:

```ts
export const DEFAULT_LEAGUE_RULE_CONFIG = {
  maxChallengeDistance: { enabled: true, value: 4 },
  maxActiveChallengesPerPlayer: { enabled: true, value: 1 },
  maxChallengesPerMonth: { enabled: true, value: 4 },
  responseDeadlineHours: { enabled: true, value: 48 },
  // ...remaining required rules with their existing defaults
} as const;
```

The default values match the current `defaultSeedRuleConfig` so new leagues
behave exactly as today until an organizer disables a rule.

### Toggleable Rule Helpers

Centralize read access so the backend never reaches into `.value.enabled`
ad hoc:

```ts
function isRuleEnabled<T>(rule: ToggleableRule<T>): rule is ToggleableRule<T> {
  return rule.enabled;
}

function resolveRuleValue<T>(rule: ToggleableRule<T>, fallback: T): T {
  return rule.enabled ? rule.value : fallback;
}
```

The `fallback` for "off" matches the Off behavior table above. For the four
toggleable rules the fallbacks are sentinel-style safe values:

- `maxChallengeDistance` off → treat as `Infinity`.
- `maxActiveChallengesPerPlayer` off → treat as `Infinity`.
- `maxChallengesPerMonth` off → treat as `Infinity`.
- `responseDeadlineHours` off → no deadline is computed; the challenge stays
  open with no expiry.

These fallbacks live next to the rule helpers, not inline in call sites.

## Backend Consumption

### Challenge creation rules

`resolveChallengeCreationRuleError` currently receives raw numbers. It must
receive the effective values, taking `enabled` into account.

Two options:

1. Pass resolved values from the caller (caller decides `Infinity` when off).
2. Pass the full `ToggleableRule` objects and let the rule helper resolve.

Recommended: option 1. Keep `resolveChallengeCreationRuleError` pure and
numeric, and resolve the toggleable values in `challenges.ts` before calling
it. This keeps the shared domain rule testable without rule-config knowledge.

The call site in `challenges.ts` becomes:

```ts
const ruleError = resolveChallengeCreationRuleError({
  // ...
  maxActiveChallengesPerPlayer: resolveRuleValue(
    ruleConfig.maxActiveChallengesPerPlayer,
    Number.POSITIVE_INFINITY
  ),
  maxChallengeDistance: resolveRuleValue(
    ruleConfig.maxChallengeDistance,
    Number.POSITIVE_INFINITY
  ),
  maxChallengesPerMonth: resolveRuleValue(
    ruleConfig.maxChallengesPerMonth,
    Number.POSITIVE_INFINITY
  ),
});
```

The existing `resolveChallengeCreationRuleError` comparison operators
(`>`, `>=`) already work with `Infinity`, so no logic change is needed inside
the helper.

### Response deadline

`buildResponseDeadline` currently takes a number of hours and returns a `Date`.
The `leagueChallengeProposal.responseDeadlineAt` column is
`timestamp().notNull()`, so the stored value cannot be `null`. Because of this
constraint, "no deadline" is represented as a far-future timestamp rather than
a nullable field.

When `responseDeadlineHours.enabled === false`, the caller must store a
far-future sentinel instead of calling `buildResponseDeadline`. A shared helper
encodes the sentinel so the value stays consistent:

```ts
const NO_RESPONSE_DEADLINE_HORIZON_YEARS = 100;

function resolveResponseDeadline(input: {
  now: Date;
  rule: ToggleableRule<number>;
}): Date {
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

There are three `buildResponseDeadline` call sites in `challenges.ts`:

1. Challenge creation (proposal insert, ~line 1131).
2. Counter-proposal insert (~line 1422).
3. Reopen challenge proposal patch (~line 2582).

All three must be replaced with `resolveResponseDeadline({ now, rule:
ruleConfig.responseDeadlineHours })`.

The client serialization (`serializeProposal`) exposes `responseDeadlineAt` as
a number. The challenge detail client must treat a far-future value as "no
deadline" when rendering the countdown. That display change belongs to the
challenge detail work and is called out here only for awareness; it is not
part of the rules screen slice itself.

### Match config

`matchConfig` and `matchConfigSnapshot` are unaffected. They remain required
and are not toggleable in this slice.

### Seed data

`defaultSeedRuleConfig` in `convex/domains/seed/data.ts` must be updated to the
new `{ enabled, value }` shape for the four toggleable rules. The two seed
call sites that read `ruleConfig.responseDeadlineHours` must use
`ruleConfig.responseDeadlineHours.value` (the seed always enables rules, so
the `enabled` check is not needed there).

## Frontend

### Schema form

`src/components/pages/leagues/form-schema.ts` already extends the contract
schema, so it automatically inherits the new toggleable shape. No change is
expected beyond confirming the `superRefine` for `bestOfSets` still applies.

### Rules screen

The four `Desafios` toggleable rules move from a plain `RuleCard` with a
`NumberStepper`/`Segment` to the existing toggle card pattern:

```
[Checkbox] Label
           Description
           ── when enabled ──
           (existing NumberStepper / Segment) inside RuleExpandableContent
```

This reuses the exact structure from `InactivityPenaltySection`:

- `PressableFeedback` with `accessibilityRole="checkbox"` toggles the rule.
- The row toggles `ruleConfig.<rule>.enabled`.
- When enabled, `RuleExpandableContent` shows the existing input, bound to
  `ruleConfig.<rule>.value`.
- When disabled, the input is hidden and the value is preserved.

A small shared component avoids duplicating the toggle header four times:

```ts
function ToggleableRuleCard<T>(props: {
  enabledName: keyof RuleConfig; // "maxChallengeDistance"
  valueName: keyof RuleConfig;   // same rule, used by the inner input
  label: string;
  description: string;
  isDisabled?: boolean;
  children: (value: T, setValue: (next: T) => void) => ReactNode;
}) { /* ... */ }
```

The inner input (`NumberStepper`/`Segment`) is passed as a render child so each
rule keeps its own options without the wrapper knowing about steppers.

### Disabled state

When a rule is disabled, its card shows the checkbox unchecked and collapses
the inner input. The card remains in the list so the organizer can re-enable
it. Disabled rules do not show a `FieldError`.

### Result tab

`resultValidationMode` is rendered on the `Resultado` tab instead of the
`Desafios` tab. The card itself is unchanged (still a required `Segment`).

### Final-set format card fix

The `FinalSetSection` on the `Partidas` tab is structurally inconsistent with
the other expandable cards (`InactivityPenaltySection`, `TieBreakSection`).
Today the expandable content is rendered as a sibling of the `RuleCard`, and the
expanded fields live inside a nested `RuleCard variant="secondary"`. This causes
two visible problems:

1. The accordion layout animation does not own the expanded content, so the
   card does not grow/shrink as a single unit like the other toggle cards.
2. The nested card uses `variant="secondary"`, which does not match the default
   surface used by the other cards.

The fix restructures `FinalSetSection` to mirror `TieBreakSection`: a single
`RuleCard` (default variant) that contains both the `finalSetMode` select and
the conditional `RuleExpandableContent`. The nested `RuleCard variant="secondary"`
is removed. The `custom_set` and `super_tiebreak` branches each render their
fields directly inside the `RuleExpandableContent`, exactly as `TieBreakSection`
renders its expanded fields.

Target structure:

```
RuleCard (default)
 ├─ Select (finalSetMode)
 └─ RuleExpandableContent (when finalSetMode is custom_set | super_tiebreak)
      └─ fields directly, no nested card
```

No behavior change beyond layout/animation and the surface variant.

## Validation Rules

### Toggleable value validation

- The wrapped `value` must always satisfy the inner schema, even when
  `enabled === false`. This is what preserves the last configured value on
  save.
- A disabled rule with an invalid `value` must still fail validation so
  re-enabling never restores an invalid state. In practice the value is
  validated on input while enabled, so this is a safety net.

### Required rules

- The six required enums (`challengeValidationMode`,
  `resultValidationMode`, `winBehavior`, `lossBehavior`,
  `walkoverBehavior`, `newPlayerPlacement`) keep their existing required
  validation.
- `matchConfig` keeps its existing required validation and `bestOfSets`
  superRefine.

### Inactivity penalty

The existing `superRefine` that pairs `hasInactivityPenalty` with
`inactivityPenaltyType` / `inactivityPenaltyDays` is unchanged.

## Migration

There are no active users in dev or prod. A Convex migration is still the
correct path per repo conventions so stored documents conform to the new shape.

### Migration scope

- `convex/functions/migrations/20260623_000001_toggleable_rule_config.ts`
- Registered in `convex/functions/migrations/manifest.ts`

### Migration behavior

The migration rewrites rule config in two document types:

**`league` documents** — transform `ruleConfig`:

1. For each of the four toggleable rules, read the existing scalar value and
   wrap it as `{ enabled: true, value: <existing> }`. `enabled` defaults to
   `true` because today every rule is active.
2. Apply the scoring rename (see Scoring Mode Rename): rewrite
   `matchConfig.scoringMode` and `matchConfig.finalSetScoringMode` from
   `"no_ad"` to `"sem_vantagem"`.
3. Leave all other `ruleConfig` fields untouched.
4. Leave `challengeValidationMode` / `resultValidationMode` handling alone if
   a legacy document is missing them; the existing fallback logic in
   `serializeLeague` already provides defaults.

**`leagueChallenge` documents** — transform `matchConfigSnapshot`:

1. Apply the scoring rename to `matchConfigSnapshot.scoringMode` and
   `matchConfigSnapshot.finalSetScoringMode`. The snapshot is frozen per
   challenge, so it must be migrated independently of the league.

Example transform (league):

```ts
{
  maxChallengeDistance: 4,
  matchConfig: { scoringMode: "no_ad", /* ... */ },
  // ...
}
// becomes
{
  maxChallengeDistance: { enabled: true, value: 4 },
  matchConfig: { scoringMode: "sem_vantagem", /* ... */ },
  // ...
}
```

If a document already has the new shape and the new scoring value
(idempotency), the migration must skip it.

## Testing

- `convex/domains/league/tests/challenge-rules.test.ts` and
  `challenge-creation-rules.test.ts` keep using plain numbers because
  `resolveChallengeCreationRuleError` stays numeric. Add cases where the
  caller passes `Infinity` to confirm no limit is enforced.
- Add contract-level tests for `ChallengeRuleConfigSchema`:
  - toggleable rules accept `{ enabled, value }`
  - disabled rules still validate `value`
  - required rules still reject missing values
  - the `resultValidationMode` move is covered by the schema staying a single
    source of truth.
- Add a test asserting `LeagueScoringModeOptions` contains `sem_vantagem`
  (not `no_ad`) and that `formatScoringMode` renders "Sem vantagem" for it.

## Success Criteria

- Organizer can disable and re-enable each of the four `Desafios` toggleable
  rules from the rules screen.
- Re-enabling a rule restores the previously entered value.
- Disabling `maxChallengeDistance` lets a player challenge any player above
  them in the ranking.
- Disabling `maxActiveChallengesPerPlayer` removes the active challenge cap.
- Disabling `maxChallengesPerMonth` removes the monthly cap.
- Disabling `responseDeadlineHours` lets a challenge stay open with no expiry.
- A newly created league has all toggleable rules enabled with the existing
  default values.
- `Validação do resultado` appears on the `Resultado` tab.
- The existing animated checkbox card pattern is reused, not reinvented.
- The final-set format card expands/collapses with the same accordion animation
  as the other expandable cards, on the default surface variant (no nested
  `secondary` card).
- The scoring option previously shown as "No-ad" (`no_ad`) is shown and stored
  as "Sem vantagem" (`sem_vantagem`); legacy `"no_ad"` documents are migrated.
- Seed leagues conform to the new shape and boot without validation errors.
- `bun run typecheck` and `bun test` pass after the change.
