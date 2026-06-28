# Organization Profile Design

## Goal

Turn the organization from a blind fallback record into a real, editable
organizer profile.

Today, activating organizer mode creates an `organization` with a synthesized
name (`"Organização ${displayName}"`), an empty `metadata`, no logo, and no way
to edit any of it afterward (`convex/functions/viewer/context.ts:285-319`). The
goal of this slice is to:

1. Give the organization a real onboarding flow when the user first activates
   organizer mode.
2. Make the organization profile editable afterward.
3. Route the Settings "Perfil" entry dynamically by the active actor.

This unblocks the organizer experience so that creating leagues and (later)
tournaments attaches to an organization the user actually configured.

## Relationship to Prior Work

This builds directly on the
[Active Actor Architecture](./2026-06-01-active-actor-architecture-design.md):
`user` authenticates, `playerProfile` is the player actor, and `organization`
(Better Auth) is the organizer/business actor. That spec established that the
organization is the natural billing owner and league owner. This slice gives
that actor a real, user-configured profile. It does not change the actor model.

## Non-Goals

- Do not implement payments, plans, or the 15-day trial in this slice. That is
  a separate spec (Phase 2).
- Do not gate league creation by plan or trial in this slice. Any manager can
  still create as many leagues as they want.
- Do not implement member management UI (invite, roles, remove).
- Do not build a public organization profile page or an organization directory.
- Do not let the user edit the `slug` (it stays generated and unique).
- Do not change the signup flow. Signup stays email/password only and defaults
  to the player actor.
- Do not rename `playerProfile`. The asymmetry between `playerProfile` (person)
  and `organization` (business entity) is intentional and correct.

## Data Model

### No new table

The `organization` table already holds everything this slice needs:

- `name` (column) — display name.
- `slug` (column, unique) — generated, not user-editable here.
- `logo` (column) — Convex storage id for the profile picture.
- `metadata` (json column) — already present, currently `{}`.

The organization **is** the organization profile. Do not create
`organizationProfile`. The profiled entity and the business actor are the same
record.

### `metadata` as the typed extension point

All new profile fields live in `organization.metadata` behind a zod schema.
This is the idiom Better Auth expects and avoids touching plugin-managed
columns.

```ts
// convex/domains/organization/contract.ts
const ORGANIZER_TYPES = [
  "academia",
  "clube",
  "liga",
  "condominio",
  "escola",
  "federacao",
  "confederacao",
  "centro_de_treinamento",
  "outro",
] as const;

const PHYSICAL_ORGANIZER_TYPES = [
  "academia",
  "clube",
  "centro_de_treinamento",
  "escola",
  "condominio",
] as const;

const SPORTS = [
  "tenis",
  "beach_tennis",
  "futevolei",
  "volei_de_praia",
  "padel",
  "squash",
  "futebol_society",
  "pickleball",
  "tenis_de_mesa",
  "raquetinha",
  "badminton",
  "volei_de_quadra",
  "outro",
] as const;

const addressSchema = z.object({
  cep: z.string(),
  street: z.string(), // from ViaCEP
  number: z.string(),
  district: z.string().optional(), // from ViaCEP
  city: z.string(), // from ViaCEP
  state: z.string(), // UF, from ViaCEP
  complement: z.string().optional(),
});

const acceptedTermsSchema = z.object({
  version: z.string(),
  acceptedAt: z.string(), // ISO
  userId: z.string(),
});

const organizationMetadataSchema = z.object({
  organizerType: z.enum(ORGANIZER_TYPES).optional(),
  address: addressSchema.optional(),
  sports: z.array(z.enum(SPORTS)).optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  contactEmail: z.string().optional(),
  acceptedTerms: acceptedTermsSchema.optional(),
});
```

Rules:

- Every field in `organizationMetadataSchema` is `optional` because the schema
  models all organizations including legacy ones with `metadata: {}`. Activation
  and upsert have their own stricter input schemas (`activateOrganizationSchema`
  / `upsertOrganizationSchema`) that make `organizerType`, the
  physical-type/address coupling, and (for activation only) `acceptedTerms`
  required. The metadata schema's optionality is about read compatibility, not
  about what activation accepts.
- `organizerType` and `address` are linked by a business rule: when
  `organizerType` is one of `PHYSICAL_ORGANIZER_TYPES`, `address` is required.
  Otherwise `address` must be omitted. Enforce this in zod via a
  superRefine/discriminated check on `organizerType`, not as two separate forms.
- `acceptedTerms.version`/`acceptedAt`/`userId` records who accepted which
  terms version. It is required for activation and read-only afterward: the
  `upsert` input schema does not accept `acceptedTerms`, so editing the profile
  never re-prompts for terms. If a future ToS version requires re-acceptance,
  that is a separate flow, not part of profile edit.
- In Phase 2 (members), promote terms to a dedicated
  `termsAcceptance(userId, version, acceptedAt)` table and migrate the value.
- All reads parse `metadata` with `organizationMetadataSchema` and fall back to
  `{}` when `metadata` is `null`/`undefined` (legacy orgs with `metadata: {}`).

### Compat with existing organizations

Organizations created before this slice have `metadata: {}`. That is valid:
`organizationMetadataSchema` makes every field optional, so they parse cleanly
and render an "incomplete profile" the user can finish editing. No migration is
required to read them. The onboarding flow only runs when there is no
organization yet; existing orgs go straight to the edit screen.

## Backend Design

### New domain: `convex/domains/organization/`

Mirrors the structure of `convex/domains/player/`:

- `contract.ts` — zod schemas above plus `upsertOrganizationSchema` and
  `activateOrganizationSchema` (the rich input that replaces the current
  name-only activation). Also exports `isPhysicalOrganizationType(type)`,
  `PHYSICAL_ORGANIZER_TYPES`, and the enum const arrays for the client.
- `identity.ts` — `serializeOrganization(org)` returns the client shape with
  `logoUrl` resolved (mirrors the `playerProfile` avatar serialization) and
  `metadata` parsed; `buildOrganizationDisplayName` for fallback rendering.

Tables stay owned by `convex/domains/auth/tables.ts` because the
`organization` table is Better Auth-managed. The organization domain only owns
schemas, serialization, and functions. Do not duplicate the table definition.

### New functions: `convex/functions/organization/profile.ts`

Registered in `convex/shared/api.ts` as `organization.profile.*`:

- `organization.profile.get` (`authQuery`) — loads the active organization via
  `requireActiveOrganization` and returns it serialized. Output is
  `organizationSchema.nullable()`.
- `organization.profile.upsert` (`authMutation`, guarded by
  `requireActiveManager`) — updates `name`, `logo`, and the allowed
  `metadata` fields. Re-validates the physical-type/address rule server-side.
  Collects and deletes the replaced logo storage id (mirrors
  `collectReplacedPlayerAvatarStorageIds`).
- `organization.profile.generateUploadUrl` (`authMutation`, guarded by
  `requireActiveManager`) — returns a Convex upload URL for the logo.

### Refactor `viewer.context.activateOrganization`

Replace the current name-only activation
(`convex/functions/viewer/context.ts:285-319`) with a richer input that accepts
the onboarding payload: `name`, optional `logo`, `organizerType`, optional
`address` (required when type is physical), optional `sports`, and the
`acceptedTerms` object. The mutation keeps the same post-conditions:

1. Insert the `organization` with `metadata` built from the typed schema
   (instead of `metadata: {}`).
2. Insert the `member` row with `role: "owner"`.
3. Upsert `userPreference` to activate the new organization.

The slug stays generated by `createOrganizationSlug`. Do not expose slug as an
input.

Server-side re-validation is mandatory: even though the client hides the
address fields for non-physical types, the mutation must reject an address when
the type is not physical, and must require an address when the type is physical.

### Backend rules summary

- Only the active organization's profile can be read/edited.
- Only an `owner`/`admin` member (`requireActiveManager`) can edit.
- The physical-type/address coupling is enforced in zod on both input shapes
  (activation and upsert).
- Terms acceptance is recorded on activation and is required for activation.

## Frontend Design

### New routes under `src/app/(private)/settings/organization/`

- `onboarding.tsx` — the activation flow. Shown when the user turns on
  organizer mode and has no organization. Dedicated screen, not a modal, so
  Phase 2 can add a payment step here without restructuring.
- `profile.tsx` — the edit screen for the active organization profile. Mirrors
  `settings/player/profile.tsx`.

### Dynamic "Perfil" entry in Settings

`src/app/(private)/settings/index.tsx` currently always shows "Perfil do
jogador" -> `/settings/player/profile`. Change the menu entry to be driven by
the active actor from `viewer.context.get`:

- Active actor `player` -> "Perfil do jogador" -> `/settings/player/profile`.
- Active actor `organization` -> "Perfil da organização" ->
  `/settings/organization/profile`.

### Onboarding form (field order is significant)

The field order exists so that the type selection gates the address section:

1. Foto (logo) — optional. Reuse the player avatar picker + `ImageCropper` at
   `1:1` (mirror `PLAYER_AVATAR_CROP_TARGET`).
2. Nome * — required.
3. Tipo * — required. Label: **"Sua organização é um(a):"**. Selector over
   `ORGANIZER_TYPES`.
4. Endereço * (only when type is physical) — Label: **"Endereço da sede"**.
   CEP first; `number` typed; optional `complement`. Street, district, city,
   and state are auto-filled from ViaCEP and shown read-only after lookup.
   - For non-physical types, this whole section is hidden, not disabled.
5. Esportes — optional, multi-select. Label: **"Quais modalidades sua
   organização atende?"** over `SPORTS`.
6. Termos e condições * — required checkbox. Links to the ToS. Records
   `{ version, acceptedAt, userId }`.

Submit calls `viewer.context.activateOrganization` with the typed payload,
then invalidates actor-scoped queries the same way the current toggle handler
does (`invalidateActorScopedQueries` in `settings/index.tsx`).

### Edit screen

Same fields as onboarding plus the extra metadata fields that do not belong in
activation:

- `metadata.description` (bio curta)
- `metadata.website`
- `metadata.contactEmail`

Calls `organization.profile.upsert`. Changing the type re-runs the physical/
address rule: switching from a physical type to a non-physical one clears the
address; switching to a physical type reveals the address section as required.

### CEP autocomplete

Client-side lookup against ViaCEP (`https://viacep.com.br/ws/{cep}/json/`).
On success, fill `street`, `district`, `city`, `state` and mark them
read-only. On failure (CEP not found), show an inline error and let the user
re-type the CEP. The server still stores whatever the client sends; ViaCEP is
a UX convenience, not a source of truth the backend trusts blindly.

### Toggle behavior change

Today the toggle in `settings/index.tsx:158-178` calls
`activateOrganization.mutate({ name })` with a fallback name when there is no
organization. Change it so that when there is no organization, turning the
toggle on navigates to `/settings/organization/onboarding` instead of creating
an org inline. When an organization already exists, the toggle keeps the
current behavior (`setActiveActor` to switch into it).

## Phase 2 Hook

This slice deliberately leaves the plan/trial boundary undefined so Phase 2
can add it additively. The seam is `buildViewerCapabilities`
(`convex/domains/auth/actor-context.ts:64-80`): today `canCreateLeague` is
`true` for any organization manager. Phase 2 will extend that to also require
`hasActivePlan || inTrialWindow`. No change is made in this slice; the seam is
documented here so Phase 2 does not refactor.

## Error Handling

- Activation with an invalid physical-type/address combination is rejected
  server-side with `CRPCError({ code: "BAD_REQUEST" })`. The form's zod schema
  mirrors the rule so the user normally never sees it.
- Terms not accepted -> the submit button stays disabled; the mutation also
  rejects missing `acceptedTerms`.
- Logo upload failure -> show a danger toast, keep the previous logo (none on
  first activation), keep the form state.
- ViaCEP lookup failure -> inline field error, user can retype or cancel.
- Reading an org with unparseable `metadata` -> fall back to `{}` and log; the
  edit screen still renders so the user can repair the data.

## Testing Strategy

Backend tests (`convex/domains/organization/tests/`):

- Activation with a non-physical type and no address succeeds.
- Activation with a non-physical type and an address is rejected.
- Activation with a physical type and no address is rejected.
- Activation with a physical type and a full address succeeds.
- Activation without `acceptedTerms` is rejected.
- `upsert` by an `owner`/`admin` updates `name`/`logo`/metadata.
- `upsert` by a bare `member` is rejected.
- `get` serializes `logoUrl` and parses `metadata` with `{}` fallback.
- Switching type from physical to non-physical clears the address on upsert.

Frontend / manual checks:

- Toggle on with no org navigates to onboarding instead of creating an org.
- Onboarding hides the address section for non-physical types.
- Onboarding shows the address section as required for physical types.
- CEP lookup fills and locks street/district/city/state.
- Settings "Perfil" entry reflects the active actor.
- Edit screen round-trips all fields including description/website/contactEmail.

## Validation Before Handoff

- `bun run codegen` (new functions registered in `api.ts`).
- `bun run check` (lint + typecheck).
- `bun test convex` (organization domain tests).
- `git diff --check`.

## Success Criteria

- Turning on organizer mode with no organization opens a dedicated onboarding
  screen.
- Completing onboarding creates an organization with the user's chosen name,
  type, logo, address (when applicable), sports, and recorded terms
  acceptance.
- The organization profile is editable afterward at
  `/settings/organization/profile`.
- The Settings "Perfil" entry is dynamic by active actor.
- Existing organizations with `metadata: {}` still read and render.
- No payment, plan, trial, member-management, or public-profile work lands in
  this slice.
