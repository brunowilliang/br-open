# League Edit Slice Design

## Goal

Deliver the first working vertical slice of league editing in `br-open`.

The user should be able to:

1. Open an existing league from `/settings/leagues`
2. Enter an edit route for that league
3. See the same overall screen structure used by create
4. Edit allowed fields
5. Save only at the end
6. Delete the league from the edit flow with explicit confirmation

This slice reuses the create experience as much as possible and intentionally keeps rules visible but locked.

## Product Constraints

- The edit experience must reuse the same screen structure as create.
- The tab naming must be identical in both flows:
  - `Detalhes`
  - `Localização`
  - `Categorias`
  - `Regras`
  - `Configurações`
- `Regras` remains visible in edit, but its fields are disabled.
- Save remains one final submit, same as create.
- `Visibilidade` remains editable.
- `Categorias` remain editable.
- `Capa` and `Avatar` remain editable in UI.
- Delete is real in this slice and must use a confirmation dialog.

## Out of Scope

- Auto-save
- Editing rules after creation
- Membership-aware protection rules
- Soft delete / archive mode
- Public route behavior
- Player participation logic
- Real image picker integration

## Functional Design

### Route Structure

Add a dedicated edit route:

- `/settings/leagues/[leagueId]/edit`

Do not collapse edit behavior into `/settings/leagues/[leagueId]`.

The `[leagueId]` route remains the organizer entry route, but in this slice it should immediately redirect to `/settings/leagues/[leagueId]/edit`.

### Shared Screen Structure

The edit flow should reuse the same screen structure as create:

- `Detalhes`
- `Localização`
- `Categorias`
- `Regras`
- `Configurações`

The UI must feel the same. The only difference is field interactivity and mutation behavior.

### Editable vs Locked Fields

#### Editável

- `Detalhes`
  - `name`
  - `description`
  - `regulation`
  - cover/avatar visual controls remain clickable for now
- `Localização`
  - `city`
  - `state`
  - `locationNotes`
- `Categorias`
  - add
  - edit
  - reorder
  - remove
- `Configurações`
  - `visibility`

#### Bloqueado

- `Regras`
  - visible
  - filled with current values
  - all inputs disabled

The `Regras` tab must remain present in edit exactly as named, with the same visual structure as create.

### Delete Flow

Delete is included in this slice.

Behavior:

1. User opens `Configurações`
2. User taps `Deletar liga`
3. A confirmation dialog opens
4. User confirms delete
5. The app runs delete mutation
6. Managed leagues list is invalidated
7. User is redirected to `/settings/leagues`

### Cover and Avatar Behavior

In edit mode, cover and avatar remain visible and clickable so the UI keeps the same affordance as create.

However, this slice does not implement a real image picker or upload flow yet.

That means:

- the controls stay visually interactive
- no real media replacement is completed yet
- persistence of new image selection is deferred until the image picker slice

### Delete Dialog

The dialog should follow the same interaction pattern already used in the app for simple confirmation dialogs, including the category dialog style direction.

Contents:

- title: `Deletar liga`
- warning text: action is permanent
- primary destructive action
- cancel action

Recommended text:

- title: `Deletar liga`
- description: `Essa ação remove a liga permanentemente e não pode ser desfeita.`

## Backend Design

### API Surface

This slice needs:

- existing `getById`
- new `update`
- new `delete`

### Update Input

Update accepts:

- `leagueId`
- `name`
- `description`
- `regulation`
- `city`
- `state`
- `locationNotes`
- `visibility`
- `categories`
- `coverStorageId`
- `avatarStorageId`

### Update Must Not Accept

- `ruleConfig`
- `mode`
- `managerUserId`

This protects league rules from being changed after creation.

### Delete Input

- `leagueId`

### Authorization

Only the organizer (`managerUserId`) can:

- read league edit data
- update the league
- delete the league

## Frontend State Design

### Reuse Strategy

Do not duplicate the create screen implementation.

Use one shared form container for both flows.

Recommended shape:

- `create` route becomes a thin wrapper
- `edit` route becomes a thin wrapper
- shared component owns the tabbed form body

### Shared Container Responsibilities

The shared screen should accept:

- `mode: "create" | "edit"`
- `initialValues`
- `onSubmit`
- `isSubmitting`
- `isRulesLocked`
- `showDelete`
- `onDelete`

### Create Mode

- title: `Criar Liga`
- save mutation: `create`
- delete hidden
- rules editable

### Edit Mode

- title: `Editar Liga`
- load via `getById`
- save mutation: `update`
- delete visible
- rules locked

## UX Behavior

### Save Behavior

Edit keeps the same save model as create:

- one form
- one final save
- no per-tab save
- no auto-save

### Success Behavior

After update:

- show success toast
- stay in edit flow or return to league page

Recommended for this slice:

- stay in the edit flow after save

Reason:
- user is still managing the league
- avoids unnecessary navigation churn

After delete:

- show success toast
- redirect to `/settings/leagues`

## Validation Rules

Edit validation should match create for editable fields:

- `name`
- `city`
- `state`
- `visibility`
- at least one category

Optional:

- `description`
- `regulation`
- `locationNotes`

`ruleConfig` is displayed but not editable, so edit submit does not depend on changing or validating rule fields from user interaction.

## Failure Handling

### Update Failure

- keep user on the edit screen
- show error toast
- preserve unsaved form state

### Delete Failure

- keep dialog closed or reopen safely
- show error toast
- do not navigate away

## Verification Plan

Minimum verification for this slice:

1. `bun codegen`
2. `bun run typecheck:convex`
3. `bun run typecheck`
4. `git diff --check`
5. Manual flow:
   - create a league
   - open it from `/settings/leagues`
   - enter edit route
   - change editable fields
   - confirm `Regras` is disabled
   - save
   - verify changes persist
   - open delete dialog
   - delete league
   - verify redirect to `/settings/leagues`

## Open Decisions Already Resolved

- edit uses a separate route
- same tab structure as create
- tab name is `Regras` in both flows
- `Regras` stays visible and disabled in edit
- `Categorias` are editable
- `Visibilidade` is editable
- cover/avatar remain editable in UI
- save is still final-only
- delete is real and confirmed by dialog
- `/settings/leagues/[leagueId]` redirects into `/settings/leagues/[leagueId]/edit`
- cover/avatar stay clickable but do not complete real replacement yet
