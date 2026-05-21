# League Courts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first working `Quadras` slice to league editing so organizers can register league-owned courts and weekly availability ranges inside the existing edit flow.

**Architecture:** Store courts as a dedicated `league.courts` JSON field, separate from `ruleConfig`. Reuse the existing shared `LeagueScreen` form, add an edit-only `Quadras` tab, and encapsulate the court/day/range UI in a focused `courts.tsx` page component that only emits normalized form values upward.

**Tech Stack:** Expo Router, React Native, HeroUI Native, React Hook Form, Zod, Convex, kitcn, Ultracite.

---

## File Structure

- Modify: `convex/domains/league/contract.ts`
  - Add typed court/day/range schemas and expose them through create, update, and output contracts.
- Modify: `convex/domains/league/tables.ts`
  - Add `courts` as a dedicated league field, kept backward-compatible for existing documents.
- Modify: `convex/functions/league/management.ts`
  - Persist `courts` on create/update and serialize missing legacy values as `[]`.
- Modify: `src/components/pages/leagues/screen.tsx`
  - Extend the shared form schema/values and add the edit-only `Quadras` tab.
- Create: `src/components/pages/leagues/courts.tsx`
  - Render the accordion-by-court and tabs-by-day editor.
- Modify: `src/app/(private)/settings/leagues/new.tsx`
  - Include `courts: []` in shared default values so the shared form shape stays stable.
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`
  - Map `league.courts` into form values and back into update input.

## Task 1: Add Courts to the League Contracts

**Files:**
- Modify: `convex/domains/league/contract.ts`

- [ ] Add shared day keys and a reusable empty availability shape.

```ts
export const LeagueCourtDayKeys = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export const EMPTY_LEAGUE_COURT_AVAILABILITY = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
} as const;
```

- [ ] Add range, availability, and court schemas with the v1 rules.

```ts
const LeagueCourtRangeSchema = z.object({
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const LeagueCourtAvailabilitySchema = z.object({
  mon: z.array(LeagueCourtRangeSchema),
  tue: z.array(LeagueCourtRangeSchema),
  wed: z.array(LeagueCourtRangeSchema),
  thu: z.array(LeagueCourtRangeSchema),
  fri: z.array(LeagueCourtRangeSchema),
  sat: z.array(LeagueCourtRangeSchema),
  sun: z.array(LeagueCourtRangeSchema),
});

export const LeagueCourtSchema = z.object({
  id: z.string().min(1, "Quadra inválida."),
  name: requiredString("Informe o nome da quadra.").pipe(
    z.string().min(1, "Informe o nome da quadra.")
  ),
  availability: LeagueCourtAvailabilitySchema,
});
```

- [ ] Add `superRefine` validations for duplicate court names, `30` minute increments, `startMinute < endMinute`, and no overlaps in the same day.

```ts
const THIRTY_MINUTES = 30;

function hasOverlap(
  ranges: Array<{ startMinute: number; endMinute: number }>
): boolean {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startMinute - right.startMinute
  );

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previousRange = sortedRanges[index - 1];
    const currentRange = sortedRanges[index];

    if (currentRange.startMinute < previousRange.endMinute) {
      return true;
    }
  }

  return false;
}
```

- [ ] Add `courts` to `CreateLeagueSchema`, `UpdateLeagueSchema`, and `leagueSchema`, defaulting missing values to `[]` at the contract layer.

```ts
export const LeagueCourtsSchema = z
  .array(LeagueCourtSchema)
  .default([])
  .catch([]);

export const CreateLeagueSchema = z.object({
  name: requiredString("Informe o nome da liga.").pipe(
    z.string().min(1, "Informe o nome da liga.")
  ),
  description: z.string().trim().optional(),
  city: requiredString("Informe a cidade.").pipe(
    z.string().min(1, "Informe a cidade.")
  ),
  state: requiredString("Informe o estado.").pipe(
    z.string().min(1, "Informe o estado.")
  ),
  locationNotes: z.string().trim().optional(),
  visibility: enumField(
    LeagueVisibilityOptions,
    "Selecione a visibilidade da liga."
  ),
  categories: z
    .array(requiredString("Informe a categoria."))
    .min(1, "Informe pelo menos uma categoria."),
  courts: LeagueCourtsSchema,
  ruleConfig: ChallengeRuleConfigSchema,
});

export const leagueSchema = z.object({
  id: leagueIdSchema,
  managerUserId: z.string().min(1, "Gestor inválido."),
  name: z.string(),
  description: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  locationNotes: z.string().nullable().optional(),
  visibility: z.enum(LeagueVisibilityOptions),
  categories: z.array(z.string()),
  mode: z.literal(DEFAULT_LEAGUE_MODE),
  courts: LeagueCourtsSchema,
  ruleConfig: ChallengeRuleConfigSchema,
});
```

- [ ] Export the new types used by the frontend and management layer.

```ts
export type LeagueCourt = z.infer<typeof LeagueCourtSchema>;
export type LeagueCourtAvailability = z.infer<
  typeof LeagueCourtAvailabilitySchema
>;
export type LeagueCourtRange = z.infer<typeof LeagueCourtRangeSchema>;
```

- [ ] Run code generation to propagate the contract changes.

Run: `bun run codegen`  
Expected: `Convex api ready!` and generated artifacts updated.

## Task 2: Persist Courts in League Storage and Management

**Files:**
- Modify: `convex/domains/league/tables.ts`
- Modify: `convex/functions/league/management.ts`

- [ ] Add a dedicated `courts` field to the league table, kept backward-compatible for existing documents.

```ts
export const league = convexTable(
  "league",
  {
    managerUserId: id("user")
      .notNull()
      .references(() => authTables.user.id),
    name: text().notNull(),
    description: text(),
    city: text().notNull(),
    state: text().notNull(),
    locationNotes: text(),
    visibility: text().notNull(),
    categories: json<string[]>().notNull(),
    courts: json<Record<string, unknown>[]>(),
    mode: text().notNull(),
    ruleConfig: json<Record<string, unknown>>().notNull(),
    coverStorageId: text().notNull(),
    avatarStorageId: text().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (league) => [index("managerUserId").on(league.managerUserId)]
);
```

- [ ] Normalize missing legacy values before parsing output in `management.ts`.

```ts
function serializeLeague(record: LeagueRecord) {
  return leagueSchema.parse({
    ...record,
    courts: record.courts ?? [],
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}
```

- [ ] Persist `courts` on league creation.

```ts
const [createdLeague] = await ctx.orm
  .insert(league)
  .values({
    ...input,
    courts: input.courts,
    managerUserId: ctx.userId,
    mode: DEFAULT_LEAGUE_MODE,
    coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
    avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
    createdAt: now,
    updatedAt: now,
  })
  .returning();
```

- [ ] Persist `courts` on league update.

```ts
const [updatedLeague] = await ctx.orm
  .update(league)
  .set({
    name: input.name,
    description: input.description,
    city: input.city,
    state: input.state,
    locationNotes: input.locationNotes,
    visibility: input.visibility,
    categories: input.categories,
    courts: input.courts,
    ruleConfig: input.ruleConfig,
    coverStorageId: input.coverStorageId,
    avatarStorageId: input.avatarStorageId,
    updatedAt: now,
  })
  .where(
    and(
      eq(league.id, currentLeague.id),
      eq(league.managerUserId, currentLeague.managerUserId)
    )!
  )
  .returning();
```

- [ ] Run typecheck after backend changes.

Run: `bun run typecheck`  
Expected: TypeScript passes for app and Convex projects.

## Task 3: Extend the Shared League Form With Courts

**Files:**
- Modify: `src/components/pages/leagues/screen.tsx`
- Modify: `src/app/(private)/settings/leagues/new.tsx`
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`

- [ ] Extend the shared `LeagueSchema` and `LeagueScreenValues` to include `courts`.

```ts
const LeagueSchema = z.object({
  name: CreateLeagueSchema.shape.name,
  description: CreateLeagueSchema.shape.description,
  city: CreateLeagueSchema.shape.city,
  state: CreateLeagueSchema.shape.state,
  locationNotes: CreateLeagueSchema.shape.locationNotes,
  visibility: CreateLeagueSchema.shape.visibility,
  categories: CreateLeagueSchema.shape.categories,
  courts: CreateLeagueSchema.shape.courts,
  ruleConfig: CreateLeagueSchema.shape.ruleConfig.safeExtend({
    matchConfig: LeagueMatchConfigSchema,
  }),
});
```

- [ ] Add `courts: []` to the create defaults so the shared form shape stays stable even though the create flow will not expose the tab yet.

```ts
const defaultValues: LeagueScreenValues = {
  name: "",
  description: "",
  city: "",
  state: "",
  locationNotes: "",
  visibility: "private",
  categories: [],
  courts: [],
  ruleConfig: {
    maxChallengeDistance: 4,
    maxActiveChallengesPerPlayer: 1,
    maxChallengesPerMonth: 4,
    responseDeadlineHours: 48,
    winBehavior: "take_opponent_position",
    lossBehavior: "stay_put",
    walkoverBehavior: "automatic_loss",
    newPlayerPlacement: "end_of_ranking",
    hasInactivityPenalty: false,
    matchConfig: {
      ...DEFAULT_LEAGUE_MATCH_CONFIG,
    },
  },
};
```

- [ ] Map courts from league output into edit form values.

```ts
function toLeagueScreenValues(league: League): LeagueScreenValues {
  return {
    name: league.name,
    description: league.description ?? "",
    city: league.city,
    state: league.state,
    locationNotes: league.locationNotes ?? "",
    visibility: league.visibility,
    categories: league.categories,
    courts: league.courts ?? [],
    ruleConfig: league.ruleConfig,
  };
}
```

- [ ] Include courts in the update payload mapping.

```ts
function toUpdateLeagueInput(
  leagueId: string,
  currentLeague: League,
  values: LeagueScreenValues
): UpdateLeagueInput {
  return {
    leagueId,
    name: values.name,
    description: values.description,
    city: values.city,
    state: values.state,
    locationNotes: values.locationNotes,
    visibility: values.visibility,
    categories: values.categories,
    courts: values.courts,
    ruleConfig: values.ruleConfig,
    coverStorageId: currentLeague.coverStorageId,
    avatarStorageId: currentLeague.avatarStorageId,
  };
}
```

- [ ] Run typecheck to verify the shared form shape still compiles through create and edit wrappers.

Run: `bun run typecheck`  
Expected: No `LeagueScreenValues` or `CreateLeagueInput` mismatches.

## Task 4: Build the `Quadras` Editor Component

**Files:**
- Create: `src/components/pages/leagues/courts.tsx`

- [ ] Create a focused `Courts` component with the same page-module pattern used by `details.tsx`, `location.tsx`, `rules.tsx`, and `settings.tsx`.

```ts
type CourtsProps = {
  error?: string;
  isDisabled?: boolean;
  onChange: (value: LeagueCourt[]) => void;
  value: LeagueCourt[];
};

export function Courts(props: CourtsProps) {
  const { error, isDisabled, onChange, value } = props;
  // local draft state for new court name and day-range entry
}
```

- [ ] Add the court-creation input and append a new empty court with all week keys initialized.

```ts
const EMPTY_AVAILABILITY = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
} as const;

const nextCourt: LeagueCourt = {
  id: String(Date.now()),
  name: courtName.trim(),
  availability: {
    ...EMPTY_AVAILABILITY,
  },
};
```

- [ ] Render courts as an accordion and days as tabs inside each accordion item.

```tsx
<Accordion>
  {value.map((court) => (
    <Accordion.Item key={court.id} title={court.name}>
      <Tabs value={activeDayByCourt[court.id] ?? "mon"}>
        <Tabs.List>
          <Tabs.Trigger value="mon">
            <Tabs.Label>Seg</Tabs.Label>
          </Tabs.Trigger>
          {/* other day tabs */}
        </Tabs.List>
      </Tabs>
    </Accordion.Item>
  ))}
</Accordion>
```

- [ ] Generate half-hour time options locally and use them for `hora inicial` and `hora final`.

```ts
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return {
    label: `${hours}:${minutes}`,
    value: totalMinutes,
  };
});
```

- [ ] Support add/remove range actions for the selected day and keep day ranges sorted after insertion.

```ts
const nextRanges = [...currentRanges, nextRange].sort(
  (left, right) => left.startMinute - right.startMinute
);

onChange(
  value.map((court) =>
    court.id === courtId
      ? {
          ...court,
          availability: {
            ...court.availability,
            [dayKey]: nextRanges,
          },
        }
      : court
  )
);
```

- [ ] Use `EmptyState` when there are no courts or no ranges in the selected day.

```tsx
{value.length ? null : <EmptyState message="Nenhuma quadra cadastrada." />}
```

- [ ] Run typecheck after adding the new component.

Run: `bun run typecheck`  
Expected: The new component compiles without unresolved HeroUI or league-contract types.

## Task 5: Wire the `Quadras` Tab Into the Edit Screen

**Files:**
- Modify: `src/components/pages/leagues/screen.tsx`

- [ ] Import the new `Courts` page component.

```ts
import { Courts } from "@/components/pages/leagues/courts";
```

- [ ] Add an edit-only `Quadras` tab trigger in the same tab strip that already handles `Solicitações` and `Ranking`.

```tsx
{mode === "edit" ? (
  <Tabs.Trigger value="courts">
    <Tabs.Label>Quadras</Tabs.Label>
  </Tabs.Trigger>
) : null}
```

- [ ] Render the `Courts` tab content inside the existing scrollable area and connect it to the shared form.

```tsx
{mode === "edit" ? (
  <Tabs.Content className="gap-4" value="courts">
    <Courts
      error={errors.courts?.message}
      isDisabled={isSubmitPending}
      onChange={(nextCourts) => {
        form.setValue("courts", nextCourts, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }}
      value={values.courts}
    />
  </Tabs.Content>
) : null}
```

- [ ] Keep `Quadras` out of the ranking-only `Page.View` branch so it follows the standard keyboard-aware layout.

```ts
const isRankingTabActive = activeTab === "ranking";
```

- [ ] Run the repo checks for the full UI/backend slice.

Run:

```bash
bun run codegen
bun run typecheck
git diff --check
```

Expected:

- codegen updates artifacts cleanly
- typecheck passes
- diff check returns exit code `0`

## Task 6: Verification Pass

**Files:**
- Modify: `src/components/pages/leagues/courts.tsx` if small fixes are needed
- Modify: `src/components/pages/leagues/screen.tsx` if tab/layout fixes are needed

- [ ] Verify this exact happy path manually in the edit flow:

1. open `/settings/leagues/[leagueId]/edit`
2. open `Quadras`
3. add `Quadra 1`
4. add `Seg` ranges `12:00-16:00` and `18:00-22:00`
5. save the league
6. re-open edit
7. confirm the saved ranges render again

- [ ] Verify the invalid cases are blocked:

1. duplicate court name differing only by case/trim
2. range with same start and end
3. range with non-ordered times
4. overlapping ranges in the same day

- [ ] Run the final quality gates before handoff.

Run:

```bash
bun run check
bun run typecheck
git diff --check
```

Expected:

- `bun run check` passes, or if it fails only because `src/uniwind-types.d.ts` regenerated again, record that explicitly
- `bun run typecheck` passes
- `git diff --check` passes

## Definition of Done

- edit flow shows a dedicated `Quadras` tab
- organizer can add a court using only a name
- organizer can configure multiple weekly availability ranges per day
- empty days remain unavailable
- duplicate court names are blocked
- overlapping ranges are blocked
- touching ranges are allowed
- all court data saves in the same league edit mutation
