# League Editor Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the shared league editor so each section owns its form slice through React Hook Form context, while `LeagueScreen` becomes a thin layout shell.

**Architecture:** Keep server state and route-level submit/delete orchestration where they already live in `new.tsx` and `edit.tsx`. Move the shared schema/types into a dedicated module, wrap the editor tree in `FormProvider`, and convert the section components to consume `useFormContext`, `useController`, and `useWatch` directly. Preserve the current functional behavior and avoid mixing this refactor with the separate public league details/challenges flow in `src/app/(private)/leagues/[leagueId]/index.tsx`.

**Tech Stack:** Expo Router, React Native, HeroUI Native, React Hook Form, Zod, TypeScript, Bun test, Ultracite.

---

## File Structure

- Create: `src/components/pages/leagues/form-schema.ts`
  - Hold the shared `LeagueSchema` and `LeagueScreenValues` type so route files and section files can import them without a circular dependency on `screen.tsx`.
- Create: `src/components/pages/leagues/form-defaults.ts`
  - Hold route-safe blank defaults such as `createLeagueDefaultValues` in a pure module that tests and routes can both import without evaluating Expo route code.
- Create: `src/components/pages/leagues/form-schema.test.ts`
  - Cover the shared schema with a small Bun test that checks both the expected blank-form invalid state and one valid filled payload.
- Modify: `src/components/pages/leagues/screen.tsx`
  - Keep only layout, tab state, `useForm`, `FormProvider`, and submit/menu orchestration.
- Modify: `src/app/(private)/settings/leagues/new.tsx`
  - Import the shared form type from `form-schema.ts`.
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`
  - Import the shared form type from `form-schema.ts`.
- Modify: `src/components/pages/leagues/details.tsx`
  - Read `name` and `description` from RHF context instead of receiving controlled props.
- Modify: `src/components/pages/leagues/location.tsx`
  - Read `city`, `state`, and `locationNotes` from RHF context instead of receiving controlled props.
- Modify: `src/components/pages/leagues/categories.tsx`
  - Read and update `categories` through RHF context while keeping local dialog/drag state local.
- Modify: `src/components/pages/leagues/rules.tsx`
  - Read and update `ruleConfig` through RHF context while keeping the inner tab state local.
- Modify: `src/components/pages/leagues/courts.tsx`
  - Read and update `courts` through RHF context while keeping dialog/accordion state local.
- Modify: `src/components/pages/leagues/settings.tsx`
  - Read and update `visibility` through RHF context while keeping delete-dialog state local.

## Task 1: Extract the Shared League Form Contract

**Files:**
- Create: `src/components/pages/leagues/form-schema.ts`
- Create: `src/components/pages/leagues/form-defaults.ts`
- Create: `src/components/pages/leagues/form-schema.test.ts`
- Modify: `src/components/pages/leagues/screen.tsx`
- Modify: `src/app/(private)/settings/leagues/new.tsx`
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`

- [ ] **Step 1: Write the failing schema smoke test**

```ts
import { describe, expect, it } from "bun:test";

import { createLeagueDefaultValues } from "./form-defaults";
import { LeagueSchema } from "./form-schema";

describe("LeagueSchema", () => {
  it("keeps the create-league defaults aligned with the expected blank-form validation state", () => {
    const result = LeagueSchema.safeParse(createLeagueDefaultValues);

    expect(result.success).toBe(false);
  });

  it("accepts a valid filled league payload", () => {
    const result = LeagueSchema.safeParse({
      ...createLeagueDefaultValues,
      name: "Liga Centro",
      city: "Florianopolis",
      state: "SC",
      categories: ["A"],
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/pages/leagues/form-schema.test.ts`  
Expected: FAIL because `src/components/pages/leagues/form-schema.ts` does not exist yet.

- [ ] **Step 3: Create the shared schema module**

```ts
import { z } from "zod";

import {
  CreateLeagueSchema,
  LeagueMatchConfigSchema,
} from "@convex/domains/league/contract";

export const LeagueSchema = z.object({
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

export type LeagueScreenValues = z.infer<typeof LeagueSchema>;
```

- [ ] **Step 4: Create the pure defaults module**

```ts
import type { LeagueScreenValues } from "./form-schema";
import {
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MATCH_CONFIG,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
} from "@convex/domains/league/contract";

export const createLeagueDefaultValues: LeagueScreenValues = {
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
    challengeValidationMode: DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
    resultValidationMode: DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    hasInactivityPenalty: false,
    matchConfig: {
      ...DEFAULT_LEAGUE_MATCH_CONFIG,
    },
  },
};
```

- [ ] **Step 5: Repoint shared type/default imports**

```ts
import { LeagueSchema, type LeagueScreenValues } from "@/components/pages/leagues/form-schema";
```

Apply this import move in:
- `src/components/pages/leagues/screen.tsx`
- `src/app/(private)/settings/leagues/new.tsx`
- `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`

- [ ] **Step 6: Re-run the schema test**

Run: `bun test src/components/pages/leagues/form-schema.test.ts`  
Expected: PASS

- [ ] **Step 7: Run typecheck after the extraction**

Run: `bun run typecheck`  
Expected: PASS

## Task 2: Turn `LeagueScreen` Into a Form Shell

**Files:**
- Modify: `src/components/pages/leagues/screen.tsx`
- Modify: `src/components/pages/leagues/details.tsx`
- Modify: `src/components/pages/leagues/location.tsx`

- [ ] **Step 1: Make `screen.tsx` fail at compile time by removing field props from `Details` and `Location` usage**

```tsx
<Tabs.Content className="gap-4" value="details">
  <Details isDisabled={isSubmitPending} />
</Tabs.Content>

<Tabs.Content className="gap-4" value="location">
  <Location isDisabled={isSubmitPending} />
</Tabs.Content>
```

- [ ] **Step 2: Run typecheck to verify the red state**

Run: `bun run typecheck`  
Expected: FAIL because `Details` and `Location` still require prop-level field values and handlers.

- [ ] **Step 3: Add RHF provider ownership to `screen.tsx`**

```tsx
import { FormProvider, useForm } from "react-hook-form";

const form = useForm<LeagueScreenValues>({
  defaultValues,
  mode: "onBlur",
  reValidateMode: "onChange",
  resolver: zodResolver(LeagueSchema),
});

return (
  <FormProvider {...form}>
    <Tabs
      className="flex-1"
      onValueChange={setActiveTab}
      value={activeTab}
      variant="primary"
    >
      <Page>{/* existing layout */}</Page>
    </Tabs>
  </FormProvider>
);
```

- [ ] **Step 4: Convert `Details` to read its own fields from form context**

```tsx
import { useController, useFormContext } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";

type DetailsProps = {
  isDisabled?: boolean;
};

export const Details = ({ isDisabled }: DetailsProps) => {
  const { control } = useFormContext<LeagueScreenValues>();
  const {
    field: nameField,
    fieldState: nameState,
  } = useController({
    control,
    name: "name",
  });
  const {
    field: descriptionField,
    fieldState: descriptionState,
  } = useController({
    control,
    name: "description",
  });

  return (
    <>
      <TextField isInvalid={Boolean(nameState.error?.message)} isRequired>
        <Label>Nome da liga</Label>
        <Input
          editable={!isDisabled}
          onBlur={nameField.onBlur}
          onChangeText={nameField.onChange}
          placeholder="Nome da liga"
          value={nameField.value}
        />
        <FieldError>{nameState.error?.message ?? ""}</FieldError>
      </TextField>
      <TextField isInvalid={Boolean(descriptionState.error?.message)}>
        <Label>Descrição da liga</Label>
        <TextArea
          editable={!isDisabled}
          onBlur={descriptionField.onBlur}
          onChangeText={descriptionField.onChange}
          placeholder="Apresente a proposta da liga"
          value={descriptionField.value ?? ""}
        />
        <FieldError>{descriptionState.error?.message ?? ""}</FieldError>
      </TextField>
    </>
  );
};
```

- [ ] **Step 5: Convert `Location` to read its own fields from form context**

```tsx
const {
  field: cityField,
  fieldState: cityState,
} = useController({
  control,
  name: "city",
});

const {
  field: stateField,
  fieldState: stateState,
} = useController({
  control,
  name: "state",
});

const {
  field: locationNotesField,
  fieldState: locationNotesState,
} = useController({
  control,
  name: "locationNotes",
});
```

- [ ] **Step 6: Re-run typecheck to verify the green state**

Run: `bun run typecheck`  
Expected: PASS

## Task 3: Move Collection Sections to RHF Context

**Files:**
- Modify: `src/components/pages/leagues/screen.tsx`
- Modify: `src/components/pages/leagues/categories.tsx`
- Modify: `src/components/pages/leagues/rules.tsx`
- Modify: `src/components/pages/leagues/courts.tsx`
- Modify: `src/components/pages/leagues/settings.tsx`

- [ ] **Step 1: Remove section-level value/error/onChange plumbing from `screen.tsx`**

```tsx
<Tabs.Content className="gap-4" value="categories">
  <Categories isDisabled={isSubmitPending} />
</Tabs.Content>

<Tabs.Content className="gap-4" value="rules">
  <Rules isDisabled={isSubmitPending || isRulesLocked} isLocked={isRulesLocked} />
</Tabs.Content>

<Tabs.Content className="gap-4" value="courts">
  <Courts isDisabled={isSubmitPending} />
</Tabs.Content>

<Tabs.Content className="gap-4" value="settings">
  <Settings
    isDisabled={isSubmitPending}
    onDelete={onDelete}
    showDelete={mode === "edit" && (showDelete ?? true)}
  />
</Tabs.Content>
```

- [ ] **Step 2: Run typecheck to verify the red state**

Run: `bun run typecheck`  
Expected: FAIL because the section components still require prop-managed field values.

- [ ] **Step 3: Convert `Categories` to `useWatch` + `setValue`**

```tsx
import { useFormContext, useWatch } from "react-hook-form";

const { control, formState, setValue } = useFormContext<LeagueScreenValues>();
const categories = useWatch({
  control,
  name: "categories",
}) ?? [];

const categoryItems = useMemo(
  () =>
    categories.map((category, index) => ({
      id: String(index + 1),
      name: category,
      index,
    })),
  [categories]
);

function updateCategories(nextCategories: CategoryItem[]) {
  setValue(
    "categories",
    nextCategories.map((category) => category.name),
    {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    }
  );
}
```

- [ ] **Step 4: Convert `Rules` to own `ruleConfig` and error access through context**

```tsx
const { control, formState, setValue } = useFormContext<LeagueScreenValues>();
const value = useWatch({
  control,
  name: "ruleConfig",
});
const errors = formState.errors.ruleConfig;

function updateRuleConfig(patch: Partial<LeagueScreenValues["ruleConfig"]>) {
  setValue(
    "ruleConfig",
    {
      ...value,
      ...patch,
    },
    {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    }
  );
}
```

- [ ] **Step 5: Convert `Courts` to own `courts` and its error through context**

```tsx
const { control, formState, setValue } = useFormContext<LeagueScreenValues>();
const value = useWatch({
  control,
  name: "courts",
}) ?? [];
const error =
  typeof formState.errors.courts?.message === "string"
    ? formState.errors.courts.message
    : undefined;

function updateCourts(nextCourts: LeagueCourt[]) {
  setValue("courts", nextCourts, {
    shouldDirty: true,
    shouldTouch: true,
    shouldValidate: true,
  });
}
```

- [ ] **Step 6: Convert `Settings` to own `visibility` through context**

```tsx
const { control, formState, setValue } = useFormContext<LeagueScreenValues>();
const value = useWatch({
  control,
  name: "visibility",
});
const visibilityError = formState.errors.visibility?.message;

function updateVisibility(nextValue: LeagueScreenValues["visibility"]) {
  setValue("visibility", nextValue, {
    shouldDirty: true,
    shouldTouch: true,
    shouldValidate: true,
  });
}
```

- [ ] **Step 7: Re-run typecheck**

Run: `bun run typecheck`  
Expected: PASS

## Task 4: Verify That the Refactor Preserved Behavior and Reduced Screen Coupling

**Files:**
- Modify: `src/components/pages/leagues/screen.tsx`
- Modify: `src/components/pages/leagues/details.tsx`
- Modify: `src/components/pages/leagues/location.tsx`
- Modify: `src/components/pages/leagues/categories.tsx`
- Modify: `src/components/pages/leagues/rules.tsx`
- Modify: `src/components/pages/leagues/courts.tsx`
- Modify: `src/components/pages/leagues/settings.tsx`

- [ ] **Step 1: Remove dead prop types and dead helper code from `screen.tsx`**

```tsx
export function LeagueScreen(props: LeagueScreenProps) {
  const { defaultValues, isPending, isRulesLocked, mode, onDelete, onSubmit, showDelete, title } = props;
  const [activeTab, setActiveTab] = useState("details");

  const form = useForm<LeagueScreenValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(LeagueSchema),
  });

  const isSubmitPending = isPending || form.formState.isSubmitting;

  const submitForm = form.handleSubmit(async (input) => {
    await onSubmit(input);
  });
```

- [ ] **Step 2: Run formatting/lint validation**

Run: `bun run check`  
Expected: PASS

- [ ] **Step 3: Run final typecheck**

Run: `bun run typecheck`  
Expected: PASS

- [ ] **Step 4: Run diff hygiene**

Run: `git diff --check`  
Expected: PASS

- [ ] **Step 5: Manual verification on the two editor routes**

Run: `bun run dev`  
Verify in app:
- `Criar Liga` still edits all tabs and submits.
- `Editar Liga` still loads existing values, updates fields, and keeps the delete dialog working.
- Category, court, and rules interactions still behave exactly as before the refactor.

## Notes for the Next Plan

- Do not mix the public league details route refactor into this slice.
- After this plan lands, write a second plan dedicated to `src/app/(private)/leagues/[leagueId]/index.tsx`.
- That follow-up plan should extract data/presenter/action boundaries without disturbing the new challenges behavior already being developed on this branch.
