# League Payment — Woovi Split Design

## Goal

Turn the league's `monthlyPriceCents` from a display-only field into a real,
collected subscription fee, split automatically between the organizer and
BR-Open at the moment the player pays.

Today a player taps "Quero participar" and a `leagueMembership` is created in
`pending`, then an organizer approves it to `active` (`convex/functions/league/
membership.ts:328`, `:491`). The `monthlyPriceCents`/`priceBillingInterval`
columns exist but only render in the join footer
(`src/components/pages/leagues/league-join-footer.tsx`) and the league edit
form. No money is ever collected.

The goal of this slice is to:

1. Onboard each organization as a Woovi **subaccount** (split recipient).
2. When a player joins a paid league, create a PIX charge through Woovi with a
   split rule (organizer + BR-Open).
3. Confirm payment via an authenticated, idempotent webhook and promote the
   membership to `active`.
4. Remind the player to renew before the next billing cycle.

The split happens inside Woovi. BR-Open never touches the player's money and is
not the payment intermediary; Woovi is the regulated PSP.

## Relationship to Prior Work

This builds on the
[Active Actor Architecture](./2026-06-01-active-actor-architecture-design.md),
which designated `organization` as the billing owner and `leagueMembership` as
the player's entitlement surface, and on the
[Organization Profile](./2026-06-28-organization-profile-design.md), which made
the organization a real, editable actor with `metadata.contactEmail`/`phone`
we can reuse as the onboarding anchor for the Woovi subaccount.

The spec calls out a new `payment` domain that mirrors the structure of
`league/` (`tables.ts` + `contract.ts` + `relations.ts` + `tests/`).

## Non-Goals

- Do not implement automatic recurring charges (Woovi `PIX_AUTOMATIC_*`) in this
  slice. The first cycle is a single charge; renewal is a manual charge with a
  push reminder. Auto-recurrence is a separate spec.
- Do not gate the **organizer** with a paid plan or trial. Organizer use of
  BR-Open stays free in this slice; the only fee collected is the player's
  league fee, split to the organizer.
- Do not refund, charge back, or partial-refund in this slice. Only `paid` and
  `expired` states are handled. Refunds go through Woovi's dashboard and are
  reconciled manually later.
- Do not expose split configuration to the organizer in this slice. The
  BR-Open fee is a single platform-level setting.
- Do not cover free leagues (`monthlyPriceCents === 0`). They keep the current
  `requestJoin` -> `approve` -> `active` flow untouched.
- Do not migrate or backfill `monthlyPriceCents`. Existing leagues keep their
  declared price; nothing changes until a player pays.
- Do not use Apple IAP. The PIX QR code is presented as information and the
  payment is completed in the player's own bank, outside the app. BR-Open is
  not the merchant of record.

## Regulatory Context (June 2026)

This design is grounded in the current Brazilian and App Store landscape:

- **Banco Central / CADE.** Apple and CADE reached a binding cease-and-desist
  in Dec 2025/Jan 2026; as of **June 20, 2026**, iOS apps in Brazil may offer
  alternative in-app payments and link out to web checkouts
  ([Apple Newsroom](https://www.apple.com/newsroom/2026/06/apple-announces-changes-to-ios-in-brazil/),
  [Reuters](https://www.reuters.com/world/americas/apple-allows-alternative-app-stores-payments-brazil-after-deal-with-regulator-2026-06-18/)).
- **Woovi as the PSP.** Split of PIX between two or more receivers is a
  supported, regulated feature of Woovi (formerly OpenPix). Woovi is the
  payment intermediary of record; BR-Open integrates as a marketplace via the
  Subaccount + Split APIs (`POST /api/v1/subaccount`, charge with `splits`,
  `PIX_RECEIVED`/`BRPIX_RECEIVED` webhooks).
- **Apple.** BR-Open does not process the payment and is not the merchant, so
  no IAP is required and no External Purchase Link Entitlement is needed for
  this slice.

## Data Model

### New domain: `convex/domains/payment/`

Mirrors `convex/domains/league/` (`tables.ts`, `contract.ts`, `relations.ts`,
`tests/`). Registered in `convex/functions/schema.ts` (composition-only).

### Table: `organizationWooviAccount`

Onboards an organization as a Woovi split recipient (subaccount).

```
organizationWooviAccount
  organizationId:   id("organization")        // unique, cascade
  wooviAccountId:   text                       // ID returned by Woovi
  wooviWalletId:    text?                      // walletId used in split rules
  status:           text                       // "pending" | "active" | "rejected"
  onboardedAt:      timestamp?
  createdAt:        timestamp
  updatedAt:        timestamp?

  index by organizationId (unique)
```

Rules:

- One row per organization. The `(organizationId)` index is unique.
- `status` is driven by Woovi:
  - `pending` immediately after `POST /api/v1/subaccount` (KYC running).
  - `active` when Woovi fires `ACCOUNT_REGISTER_APPROVED`.
  - `rejected` if Woovi denies KYC. A paid league cannot create charges while
    the org is not `active`.
- `wooviWalletId` is the value used as the recipient in a charge's `splits`
  array. It may equal `wooviAccountId` on Woovi; stored separately so the split
  code never assumes the two are identical.

### Table: `leaguePayment`

One row per charge per billing cycle for a membership.

```
leaguePayment
  leagueId:            id("league")
  leagueMembershipId:  id("leagueMembership")
  organizationId:      id("organization")
  playerProfileId:     id("playerProfile")

  // Woovi identifiers (idempotency)
  wooviChargeId:       text                     // unique
  correlationId:       text                     // our correlationID sent to Woovi

  // Charge payload snapshot
  amountCents:         integer                  // total charged to the player
  billingInterval:     text                     // "week" | "month" | "quarter" | "year"
  splitConfig:         json                     // snapshot: { recipient, percent, brOpenCents, organizerCents }

  // PIX artifacts returned by Woovi (so the client can re-render without a re-call)
  pixBrCode:           text?                    // "copia e cola"
  pixQrCodeUrl:        text?                    // QR image URL

  // Lifecycle
  status:              text                     // see enum below
  paidAt:              timestamp?
  expiresAt:           timestamp?
  createdAt:           timestamp
  updatedAt:           timestamp

  index by (leagueMembershipId, status)
  index by (playerProfileId, status)
  index by wooviChargeId (unique)
```

`status` options (`leaguePaymentStatusOptions` in `contract.ts`):

- `pending_payment` — charge created, waiting for the player to pay.
- `paid` — Woovi webhook confirmed receipt.
- `expired` — charge passed `expiresAt` unpaid (Woovi returns the charge as
  expired; we mirror it).
- `failed` — charge creation or capture failed at Woovi. Kept for diagnostics;
  the player can retry, which creates a new `leaguePayment`.

Rules:

- `wooviChargeId` is unique. The webhook uses it as the idempotency key: a
  second delivery for the same charge must not flip anything twice.
- `splitConfig` is a snapshot of how the split was computed at charge time, so
  historical payments stay correct even if the platform fee changes later. It
  is informational; the actual split is enforced by Woovi from the charge
  payload.
- A membership may have multiple `leaguePayment` rows over time (one per
  cycle). The "currently entitled" payment is the most recent `paid` one whose
  `expiresAt` is in the future.

### Membership gate (no new status)

`leagueMembership.status` is **not** extended. A paid league simply keeps the
membership in `pending` until the webhook promotes it:

- `requestJoin` on a paid league creates `leagueMembership.status = "pending"`
  **and** a `leaguePayment.status = "pending_payment"`. The membership stays
  `pending`; the player is not in the ranking yet.
- On `PIX_RECEIVED`/`BRPIX_RECEIVED` for that charge, the webhook flips
  `leaguePayment.status = "paid"` and then promotes the membership using the
  existing approval path (`resolveApprovedMembershipRankingPosition` +
  `status = "active"`).
- On `expired`, the membership stays `pending` and the player is nudged to
  retry.

Free leagues (`monthlyPriceCents === 0`) keep the current flow unchanged: no
`leaguePayment` is ever created for them.

## Backend Design

### Config / env (`convex/lib/get-env.ts`)

Add three server-side variables (all `readOptionalRuntimeEnv`, validated by the
existing `envSchema`):

```
WOOVI_APP_ID          // Basic auth user for all Woovi API calls
WOOVI_APP_SECRET      // Basic auth password
WOOVI_WEBHOOK_SECRET  // HMAC secret to verify inbound webhooks
```

Add a single platform setting:

```
WOOVI_PLATFORM_FEE_PERCENT  // e.g. 10 -> organizer gets 90%, BR-Open gets 10%
```

### Woovi client (`convex/domains/payment/woovi-client.ts`)

A thin server-side action wrapper around `fetch` to `https://api.woovi.com/`
with `Authorization: Basic <base64(appId:appSecret)>`. Exposes:

- `createSubaccount({ name, email, phone, taxId })` -> `{ accountId, walletId }`.
- `createChargeWithSplit({ correlationId, amountCents, comment, recipientWalletId, brOpenPercent, expiresAt })`
  -> `{ chargeId, brCode, pixQrCodeUrl, status }`.
- `getCharge(chargeId)` -> `{ status, value, paidAt }` (used by a reconcile
  poller, not the happy path).

No SDK dependency. Woovi ships a Node SDK (`@woovi/node-sdk`) but a raw
`fetch` keeps Convex actions dependency-free and matches how the rest of the
backend talks to external HTTP services.

### Onboarding mutation — `convex/functions/payment/onboarding.ts`

Registered in `convex/shared/api.ts` as `payment.onboarding.start`:

- `authMutation`, guarded by `requireActiveManager`.
- Requires the active organization to have a completed profile
  (`metadata.contactEmail` and `metadata.phone`), since Woovi KYC needs them.
  If missing, throws `CRPCError({ code: "PRECONDITION_FAILED" })` with a
  message pointing the user to finish the org profile first.
- Calls `createSubaccount`, then inserts `organizationWooviAccount` with
  `status = "pending"` and the returned IDs. Re-calling `start` when a row
  already exists is a no-op (returns the current status).

### Charge mutation — `convex/functions/payment/charge.ts`

Registered as `payment.charge.createForMembership`:

- `authMutation`. The caller is the **player** (active actor `player`).
- Inputs: `{ leagueMembershipId }`.
- Server-side checks (in order):
  1. The membership exists, belongs to the caller's `playerProfile`, and is
     `pending`.
  2. The league is paid (`monthlyPriceCents > 0`).
  3. The league's organization has `organizationWooviAccount.status ===
     "active"`. If not, throw `CRPCError({ code: "PRECONDITION_FAILED" })`
     telling the user the league is not ready to accept paid sign-ups yet.
  4. No existing `pending_payment` `leaguePayment` for this membership is
     still valid (`expiresAt` in the future). If one exists, return it instead
     of creating a duplicate.
- Builds the charge:
  - `amountCents = league.monthlyPriceCents` (normalized per
    `priceBillingInterval`).
  - `correlationId = `${leagueMembershipId}:${cycleAnchor}`` — deterministic
    per cycle so retries are idempotent.
  - `splitConfig` snapshot with `brOpenCents` and `organizerCents` derived
    from `WOOVI_PLATFORM_FEE_PERCENT`.
  - `expiresAt = now + 30 min` (PIX charges are short-lived by design).
- Calls `createChargeWithSplit`, inserts `leaguePayment` with
  `status = "pending_payment"`, and returns the PIX artifacts
  (`pixBrCode`, `pixQrCodeUrl`, `expiresAt`) to the client.

### Webhook — `convex/functions/payment/webhook.ts`

A `publicRoute` (no auth; identity is proved by the HMAC signature)
registered in `convex/functions/http.ts` under the `__KITCN_HTTP_ROUTES__`
marker at `/api/webhooks/woovi`.

Handler:

1. Read the raw body and the signature header. Verify HMAC-SHA256 against
   `WOOVI_WEBHOOK_SECRET`. On mismatch, return 401.
2. Parse the event. Only two shapes are handled here:
   - `BRPIX_RECEIVED` / `PIX_RECEIVED` -> payment confirmed.
   - `CHARGE_EXPIRED` (Woovi event for an unpaid, expired charge) -> mark
     `expired`.
   Any other event returns 200 and is ignored (do not 4xx; Woovi retries on
   non-2xx).
3. Load `leaguePayment` by `wooviChargeId` (idempotency key). If not found,
   return 200 (we created the charge; if Woovi sends an event for a charge we
   don't know, it's not ours).
4. If already `paid`, return 200 without re-running side effects.
5. On payment:
   - `leaguePayment.status = "paid"`, `paidAt = now`.
   - Promote `leagueMembership` to `active` via the existing
     `resolveApprovedMembershipRankingPosition` path (same code `approve`
     uses), so ranking stays consistent.
   - Fire a "Pagamento confirmado" notification to the player.
6. On expiry:
   - `leaguePayment.status = "expired"`. Leave the membership `pending`.
   - Fire a "Pagamento expirado" notification offering to retry.

The webhook handler must not trust fields the client can tamper with. It only
trusts `wooviChargeId` (matched to a row we created) and the signature.

### Renewal reminder — scheduled job

A Convex cron (`convex/functions/payment/cron.ts`) runs daily:

- For each `leaguePayment` with `status = "paid"`, compute the next due date
  from `paidAt + billingInterval`.
- When that date is within 3 days, send a push reminder.
- When the date has passed and no newer `paid` payment exists for that
  membership, mark the membership `suspended` (a status that already exists in
  `leagueMembershipStatusOptions`) and notify the player. Re-instating
  requires a new paid cycle.

### Rules summary

- Only a `player` actor can create a charge for their own `pending` membership.
- Only an `active` Woovi subaccount can receive splits.
- The webhook is the single source of truth for `paid`/`expired`. The client
  never marks a payment paid.
- Free leagues never touch the payment domain.

## Frontend Design

### Join flow change (`src/components/pages/leagues/league-join-footer.tsx`)

Today the footer calls `league.membership.requestJoin` unconditionally. Branch
on the league's pricing:

- `monthlyPriceCents === 0` -> current behavior (`requestJoin` -> `pending` ->
  organizer approves).
- `monthlyPriceCents > 0` -> still call `requestJoin` to create the `pending`
  membership, then navigate to a new checkout route
  `/leagues/[id]/checkout?membershipId=...`.

### New route: `src/app/(private)/leagues/[id]/checkout.tsx`

The PIX checkout screen:

1. On mount, call `payment.charge.createForMembership`. If a valid
   `pending_payment` charge already exists, reuse it.
2. Render:
   - The amount and what it covers (`Inscrição — R$50,00 / mês`).
   - The PIX QR code image (`pixQrCodeUrl`).
   - A "Copia e cola" block with a copy button.
   - A countdown to `expiresAt`.
   - A plain informational line: *"Abra o app do seu banco e pague este
     PIX."* No deep link, no in-app browser to a checkout — the payment is
     completed in the player's own bank.
3. Subscribe to the `leaguePayment` row (Convex live query). When it flips to
   `paid`, navigate to a success state and back to the league. When it flips
   to `expired`, show a "Gerar novo PIX" button that calls
   `createForMembership` again.

### Organizer onboarding card (`src/app/(private)/settings/organization/profile.tsx`)

Add a "Pagamentos" card to the existing organization profile screen (the one
from the Organization Profile spec). It shows the Woovi subaccount status:

- No row yet -> "Conectar conta de pagamento" button. Disabled unless the org
  profile has `contactEmail` and `phone` (the subaccount needs them). Tapping
  it calls `payment.onboarding.start` and shows the `pending` state.
- `pending` -> "Validando conta na Woovi…" with a small explainer that KYC
  takes a few minutes/hours.
- `active` -> "Conta conectada" with the masked tax id.
- `rejected` -> "Conta rejeitada" with a retry.

This card is the only organizer-facing surface in this slice. There is no
organizer-facing payment dashboard, transactions list, or payout view; those
live in the Woovi dashboard.

### Player renewal state

On the player's league list / league detail, a membership whose latest paid
`leaguePayment` is past due shows a "Renovar inscrição" banner that re-enters
the checkout flow. This reuses the checkout route — there is no separate
renewal screen.

## Error Handling

- Webhook signature mismatch -> 401, log the raw event id if present.
- Webhook for an unknown `wooviChargeId` -> 200, ignored (not ours).
- `createForMembership` when org subaccount is not `active` ->
  `PRECONDITION_FAILED` with a user-facing message; the checkout screen shows
  "Esta liga ainda não está recebendo pagamentos" and offers to notify the
  organizer.
- `createSubaccount` failure -> the onboarding card shows the error and a
  retry; no `organizationWooviAccount` row is written.
- Charge creation failure (Woovi 4xx/5xx) -> `leaguePayment` is written with
  `status = "failed"` (no `wooviChargeId`), the checkout screen shows "Tentar
  novamente".
- Race: two webhook deliveries for the same charge -> the second is a no-op
  because of the `status === "paid"` short-circuit.
- Race: player taps "pay" twice fast -> `createForMembership` returns the
  existing valid `pending_payment` charge instead of creating a second one.

## Security

- The webhook verifies HMAC before any DB write. Unauthenticated webhooks are
  rejected before parsing business fields.
- `createForMembership` re-checks ownership server-side (membership belongs to
  the caller) on every call; the client route param is never trusted alone.
- The split recipient (`wooviWalletId`) is read from
  `organizationWooviAccount`, never from the client. The player cannot
  redirect their payment.
- `WOOVI_*` secrets live only in `convex/.env` and are never shipped to the
  client. The Woovi client runs only inside Convex actions/mutations.

## Testing Strategy

Backend tests (`convex/domains/payment/tests/`):

- `createForMembership` on a free league is rejected (no payment for free
  leagues).
- `createForMembership` on a paid league whose org subaccount is `pending` is
  rejected with `PRECONDITION_FAILED`.
- `createForMembership` for a membership that is not the caller's is rejected.
- `createForMembership` returns an existing valid `pending_payment` charge
  instead of creating a duplicate.
- Split snapshot math: with `WOOVI_PLATFORM_FEE_PERCENT = 10` and
  `amountCents = 5000`, `brOpenCents = 500` and `organizerCents = 4500`.
- Webhook: valid signature + `BRPIX_RECEIVED` flips `leaguePayment` to `paid`
  and membership to `active`.
- Webhook: valid signature + duplicate delivery does not double-promote.
- Webhook: invalid signature returns 401 and writes nothing.
- Webhook: event for unknown `wooviChargeId` returns 200 and writes nothing.
- Webhook: `CHARGE_EXPIRED` flips `leaguePayment` to `expired` and leaves the
  membership `pending`.

Frontend / manual checks:

- Paid league join goes through the checkout screen; QR and copia e cola
  render; status flips to paid without a manual refresh (live query).
- Free league join is unchanged.
- Organizer profile "Pagamentos" card walks through pending -> active.
- Expired charge shows "Gerar novo PIX" and a new charge is created.

## Phasing

- **Phase 1 (this spec):** subaccount onboarding + single charge + webhook +
  manual renewal with reminder. One paid cycle at a time.
- **Phase 2 (separate spec):** automatic recurrence via Woovi
  `PIX_AUTOMATIC_*`, so the player's bank pays the next cycle automatically
  and the webhook re-entitles without a manual retry.
- **Phase 3 (separate spec):** organizer-facing transactions/payouts view and
  configurable per-league fee override (today the fee is a single platform
  percent).

## Validation Before Handoff

- `bun run codegen` (new `payment.*` functions registered in `api.ts`).
- `bun run check` (lint + typecheck).
- `bun test convex` (payment domain tests + existing league tests still
  green).
- Manual end-to-end against the Woovi sandbox with a test organization and a
  test player.
- `git diff --check`.

## Success Criteria

- An organization owner can connect a Woovi subaccount from the organization
  profile and reach `active`.
- A player joining a paid league is taken to a PIX checkout (QR + copia e
  cola) instead of being instantly pending-then-approved.
- When the player pays in their bank, the webhook promotes the membership to
  `active` within seconds, with the split landing in both the organizer's and
  BR-Open's Woovi accounts.
- Free leagues are unaffected.
- No IAP, no External Purchase Link Entitlement, and no money passes through
  BR-Open's own accounts.
