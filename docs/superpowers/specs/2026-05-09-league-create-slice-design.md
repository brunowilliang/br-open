# League Create Slice Design

## Goal

Deliver the first working vertical slice of league creation in `br-open`.

The user should be able to:

1. Open `/settings/leagues/new`
2. Fill every tab in a single form
3. Save only at the end
4. Persist the league in Convex
5. See it in the managed leagues list
6. Navigate to the created league detail route

This slice is intentionally limited to creation only. It does not include league memberships, player participation, live ranking, or challenge execution.

## Product Constraints

- League mode is fixed to `Desafios` in this first slice.
- The creator is the league organizer only, not a participating player.
- Cover and avatar must exist in the persisted payload from day one.
- Real image picking is out of scope for now; Convex storage defaults will be used.
- The form must submit only once, at the end, after validating all tabs.

## Out of Scope

- Player membership in the league
- Organizer auto-joining as player
- Ranking calculation and ranking history
- Challenge lifecycle, acceptance, and results
- Delete flow implementation
- Edit flow implementation
- Public league routes
- Image picker integration

## Functional Design

### Create Screen Structure

The existing create screen stays tabbed, with one save flow and one final submit:

- `Detalhes`
- `Localização`
- `Categorias`
- `Desafios`
- `Configurações`

The tabs are presentation only. They must not own independent submit flows.

### Fields Included In This Slice

#### Detalhes

- `coverStorageId` (visual default now, real upload later)
- `avatarStorageId` (visual default now, real upload later)
- `name`
- `description`
- `regulation`

#### Localização

- `city`
- `state`
- `locationNotes`

`locationNotes` represents the local complement / instructions field already discussed in the UI.

#### Categorias

- `categories: string[]`

At least one category is required.

#### Desafios

The league mode is fixed internally to `challenges`, but its rule configuration is user-defined.

Required fields:

- `maxChallengeDistance`
- `maxActiveChallengesPerPlayer`
- `maxChallengesPerMonth`
- `responseDeadlineHours`
- `winBehavior`
- `lossBehavior`
- `walkoverBehavior`
- `newPlayerPlacement`
- `hasInactivityPenalty`

Conditionally required when inactivity penalty is enabled:

- `inactivityPenaltyType`
- `inactivityPenaltyDays`

#### Configurações

- `visibility`

The delete action can remain visible in UI if desired, but it is non-functional and excluded from this slice.

## Backend Design

### Table Scope

Only the `league` table is reintroduced now.

Do not reintroduce these tables in this slice:

- `leagueMembership`
- `leagueChallenge`
- `leagueRankingEvent`
- `leagueSeason`

### Required League Fields

The `league` table should persist:

- `managerUserId`
- `name`
- `description`
- `regulation`
- `city`
- `state`
- `locationNotes`
- `visibility`
- `categories`
- `mode`
- `ruleConfig`
- `coverStorageId`
- `avatarStorageId`
- `createdAt`
- `updatedAt`

### Field Rules

Required in persisted data:

- `managerUserId`
- `name`
- `city`
- `state`
- `visibility`
- `categories`
- `mode`
- `ruleConfig`
- `coverStorageId`
- `avatarStorageId`
- `createdAt`
- `updatedAt`

Optional in persisted data:

- `description`
- `regulation`
- `locationNotes`

### Backend-Owned Defaults

The backend, not the screen, owns these defaults:

- `mode = "challenges"`
- `coverStorageId = default Convex storage file id`
- `avatarStorageId = default Convex storage file id`
- timestamps
- `managerUserId = authenticated user`

This keeps the frontend simpler and prevents the create screen from hardcoding persistence defaults.

## Contract Design

### Create Input

The frontend should send only user-authored form data:

- `name`
- `description`
- `regulation`
- `city`
- `state`
- `locationNotes`
- `visibility`
- `categories`
- `ruleConfig`

### Create Output

The backend should return the created league document in its persisted form, including:

- generated id
- organizer id
- default storage ids
- normalized `mode`
- normalized `ruleConfig`

## Frontend State Design

### Recommended Approach

Use one `useForm` in [new.tsx](/Users/brunogarcia/Documents/Dev/projects/br-open/src/app/(private)/settings/leagues/new.tsx).

Each tab component should become controlled by the parent screen rather than storing its own creation state.

This is required because:

- the create flow has one final submit
- the payload spans all tabs
- validation must work across sections
- the future edit screen will reuse the same field shape

### Ownership

`new.tsx` owns:

- form initialization
- default values
- final validation
- mutation execution
- save button enable/disable state
- redirect after success

Section components own only local presentation concerns, such as modal open state for category editing.

### Component Changes Needed

#### Details

Convert to controlled fields for:

- `name`
- `description`
- `regulation`

Cover and avatar remain visual placeholders for now but must map to eventual form state when picker integration is added.

#### Location

Convert to controlled fields for:

- `city`
- `state`
- `locationNotes`

#### Categories

Stop storing the categories array as local source of truth.

Keep local dialog state if useful, but category creation, edition, deletion, and ordering must update the parent form field.

#### Rules

Stop storing rule configuration as local source of truth.

All values must update the parent form field for `ruleConfig`.

#### Settings

Convert `visibility` to controlled form state.

Delete button remains presentational only for now.

## API Design

The first slice needs only `league/management`:

- `create`
- `listMine`
- `getById`

### `create`

Responsibilities:

- require auth
- build final persisted values
- inject defaults
- insert league
- return created league

### `listMine`

Responsibilities:

- return leagues owned by `managerUserId`
- drive `/settings/leagues`

### `getById`

Responsibilities:

- fetch a league by id for the organizer
- prepare the next step after creation and future edit reuse

## Navigation Flow

On successful create:

1. invalidate managed leagues query
2. navigate to `/settings/leagues/[leagueId]`

This route can start as a minimal placeholder page if needed. It does not need full edit behavior yet.

## Validation Rules

The first slice should block submit unless all required fields are valid:

- `name`
- `city`
- `state`
- `visibility`
- at least one category
- complete challenge `ruleConfig`

Optional fields do not block submit:

- `description`
- `regulation`
- `locationNotes`

## Failure Handling

### Frontend

- Show field errors for validation failures
- Disable save while submitting
- Prevent partial submit by tab
- Show toast on success
- Show toast on create failure

### Backend

- Reject unauthenticated create
- Reject invalid payload shape
- Never trust frontend defaults for mode or storage ids

## Verification Plan

Minimum verification for this slice:

1. `bun codegen`
2. `bun run typecheck:convex`
3. `bun run typecheck`
4. `git diff --check`
5. Manual flow:
   - open create screen
   - fill all tabs
   - save once
   - confirm league appears in `/settings/leagues`
   - confirm redirect to `/settings/leagues/[leagueId]`

## Implementation Order

1. Reintroduce minimal `league` contract and table
2. Re-enable schema and required auth relation
3. Implement `league/management.create`, `listMine`, and `getById`
4. Run codegen and backend typecheck
5. Convert `new.tsx` to a single controlled form
6. Convert tab sections to feed the parent form state
7. Wire mutation, invalidation, and redirect
8. Run verification

## Open Decisions Already Resolved

The following are intentionally fixed for this slice:

- save only at the end
- creator is organizer only
- mode is fixed to `Desafios`
- cover/avatar use Convex storage defaults for now
- delete is not part of the working create flow
