# Payment System v2 — Design Spec

## Context

Phase 1 shipped one-time PIX charges with Woovi split (organizer + BR-Open
fee). Players pay manually each cycle; a daily cron reminds them and suspends
overdue members.

This spec adds **grace periods, proactive reminders, an organizer dashboard,
per-league financial visibility, and payment reliability** — without migrating
to Woovi Pix Automático subscriptions.

## Goal

Turn the payment system from "blind and rigid" into "visible and humane":

1. **Configurable grace period** so players aren't suspended the day after
   a missed payment.
2. **Proactive renewal reminders** (before due date, not just after).
3. **Organizer dashboard** on the Home screen (organizer mode).
4. **Per-league "Financeiro" tab** with member payment status + transactions.
5. **Reliability**: reconciliation cron + refund webhook handler.
6. **Cleaner player hub** with sections and easy re-payment.

## Non-goals

| Feature | Decision | Rationale |
|---|---|---|
| Pix Automático (subscriptions) | **No** — keep one-time charges | Only supports monthly; bank support limited; current system works |
| Pagamento offline / manual marking | **No** | Bypasses split = BR-Open loses revenue |
| Estender prazo manualmente | **No** | Grace period covers this |
| Pró-rata (join mid-cycle) | **No** | Price is price, regardless of join date |
| Comprovante / recibo | **No** | Payment history in-app is sufficient |
| Dispensar pagamento (bolsa) | **Future** | When BR-Open can control fee waiver |
| Cupom / desconto / free trial | **No** | Scope creep |
| Cartão / boleto | **No** | PIX-only |
| Exportar relatório | **No** | Dashboard covers visibility |
| Mensagem em massa | **No** | Not priority |
| Nota fiscal automática | **No** | PJ organizers use Woovi dashboard |
| Pix card / cover image in org profile | **No** | Avatar only |

## Key decisions (locked)

### D1: One-time PIX charges remain the primary billing mechanism

Woovi Pix Automático (`POST /api/v1/subscriptions` with `type: "PIX_RECURRING"`)
was evaluated and **rejected** as the primary mechanism:

- Only supports `MONTHLY` frequency; br-open supports `week`, `month`,
  `quarter`, `year`, `once`.
- Pix Automático is ~1 year old (Bacen launch June 2025); many banks
  don't support it yet.
- 5-entity state machine (Subscription → PixRecurring → Installment →
  CobR → CobRTry) adds complexity with no proportional value.
- Split on recurring charges is unconfirmed by Woovi.
- The "forgot to pay" problem is solved by **grace period + proactive
  reminders** (Phase 1), not by auto-debit.

### D2: No offline/manual payment marking

Every payment MUST go through the Woovi PIX split. This guarantees BR-Open
receives its platform fee on every transaction. If an organizer wants to let
someone play for free, they create a free league (R$0). A future "waive fee"
feature (where BR-Open explicitly authorizes the waiver) may be added later.

### D3: Grace period is configurable per league

| Field | Default | Description |
|---|---|---|
| `gracePeriodDays` | `7` | Days after billing due date before the membership is suspended |
| `reminderDaysBefore` | `3` | Days before due date to send the first renewal reminder |

Both are set by the organizer at league creation/edit time, in the same
"Cobrança" section where price and approval mode already live.

### D4: Membership status gains `payment_due`

Current statuses: `pending`, `awaiting_payment`, `active`, `suspended`,
`rejected`, `removed`, `left`.

New status: **`payment_due`** — the billing due date has passed but the grace
period has not. The player **can still play** but sees a warning banner.

Transition: `active` → (`paidAt + interval` elapsed) → `payment_due` →
(`+ gracePeriodDays` elapsed) → `suspended`.

### D5: Ranking position preserved on suspension

When a membership goes `active` → `suspended` (or `payment_due`), the
`rankingPosition` is **not** cleared. The challenge system naturally lets
other players move past (suspended members can't challenge or be challenged).
On reactivation (new payment → `active`), the player returns to their last
position, which may have drifted.

This matches real-world sports leagues: temporary absence doesn't reset
your seed.

Refund still clears `rankingPosition: null` (the player left the league).

### D6: Grandfathering on price changes

When the organizer changes `monthlyPriceCents`, existing members who already
paid the current cycle are **not** retroactively charged. Their next charge
(created at renewal) uses the **new** price.

This is already how it works: `resolveSourceForCharge` reads
`currentLeague.monthlyPriceCents` at charge creation time. The snapshot
(`paymentCharge.amountCents`) preserves the historical amount. No change
needed — just document the behavior.

### D7: Dashboard is on Home (organizer mode); finances are a league tab

The settings/organization/payments.tsx page is **eliminated**. Its only
remaining function (PIX key onboarding) moves into the organization profile
as a "Pagamentos" card.

New architecture:
- **Home (organizer mode)** = dashboard with KPIs + recent activity + league
  grid (with per-league revenue mini-display).
- **League detail** = new "Financeiro" tab (paid leagues only) with member
  payment status + transaction history + billing settings summary.
- **Settings → Perfil da organização** = "Pagamentos" card (PIX key
  connect/edit).

### D8: PIX key onboarding as a profile card

The organization profile page (`settings/organization/profile.tsx`) gains a
"Pagamentos" card (same visual pattern as other profile cards) with 3 states:
not connected (CTA button), connected (status + masked key + edit menu),
pending (spinner). The standalone `settings/organization/payments.tsx` route
is deleted.

## Data model changes

### League table — 2 new fields

```ts
// convex/domains/league/tables.ts
gracePeriodDays: integer(),       // default 7 (applied in serializer)
reminderDaysBefore: integer(),    // default 3 (applied in serializer)
```

Migration: add columns (nullable); existing leagues get defaults via
serializer fallback (same pattern as `approvalMode`).

### LeagueMembership — 1 new status value

```ts
// convex/domains/league/contract.ts
LeagueMembershipStatusOptions = [
  "pending",
  "awaiting_payment",
  "active",
  "payment_due",      // ← NEW
  "suspended",
  "rejected",
  "removed",
  "left",
] as const;
```

No schema migration needed (status is `text()`). Existing memberships are
unaffected — the new status is only set by the improved renewal cron.

### PaymentCharge — add `leagueId` snapshot (performance)

```ts
// convex/domains/payment/tables.ts
leagueId: text(),          // snapshot at charge time (from resolveSourceForCharge)
leagueName: text(),        // snapshot (same as sourceLabel but explicit)
playerName: text(),        // snapshot at charge time (from playerProfile)
```

Migration: backfill existing charges by joining `sourceId → leagueMembership
→ league` and `playerProfileId → playerProfile`. New charges populate these
in `resolveSourceForCharge` (already loads both entities).

This eliminates N+1 joins in the Financeiro tab's transaction list and
member status list.

## Feature specs

### F1: Grace period + proactive renewal (replaces `sendRenewalReminders`)

The existing daily cron (`sendRenewalReminders` in `charge.ts`) is rewritten
to implement the grace period timeline:

```
D-reminderDaysBefore    D-0 (due)         D+gracePeriodDays
       │                   │                     │
   "vence em X dias"   "venceu"             "suspenso"
   → renewal_reminder  → payment_due        → suspended
   push notification   → status change       → renewal_due
                                              push notification
```

Logic per PAID charge (per membership, per league):
1. Compute `nextDue = paidAt + billingInterval`.
2. If `nextDue - now <= reminderDaysBefore * 86400000` and `> 0`:
   - Send `renewal_reminder` (deduped 24h via `lastRenewalReminderSentAt`).
3. If `nextDue <= now`:
   - Check if there's a newer PAID charge for this membership.
   - If yes: skip (player renewed).
   - If no and membership is `active`: set to `payment_due`.
4. If `nextDue + gracePeriodDays * 86400000 <= now`:
   - Check newer PAID charge again.
   - If no and membership is `payment_due` or `active`: set to `suspended`.
   - Send `renewal_due` notification.

The cron still runs daily. The `reminderDaysBefore` and `gracePeriodDays`
are read from the league at runtime (not snapshotted — organizer can adjust).

### F2: Proactive payment notifications

New notification events (extend the existing protocol):

| Event | Trigger | Recipient | Deep-link |
|---|---|---|---|
| `league.membership.renewal_reminder` | `reminderDaysBefore` before due | player | league detail |
| `league.membership.payment_due` | Due date reached, grace starts | player | league detail |
| `league.membership.renewal_due` | Grace expired → suspended | player | checkout (generate new charge) |
| `league.membership.charge_created` | New charge created | player | checkout |

### F3: Organizer dashboard on Home (organizer mode)

The Home tab (`(tabs)/index.tsx`) in organizer mode shows:

1. **Greeting** (existing, kept).
2. **Hero KPI**: "Recebido este mês" (sum of `organizerCents` from PAID
   charges this month for the org's leagues).
3. **KPI grid** (2×2): Assinantes ativos (count), Em atraso (count, danger
   highlight if > 0), Pagamentos no mês (count), Receita prevista/mês (sum
   of active memberships × monthly price, labeled as estimate).
4. **Atividade recente** (last 5 charges, any status, any league).
5. **Minhas ligas** grid (existing, enhanced with per-league revenue mini-badge).

If Woovi account not connected: only show the onboarding CTA card (same as
current behavior, but inline instead of a settings page).

Single CRPC query: `payment.dashboard.getOverview` (one round-trip).

### F4: League "Financeiro" tab

New tab in `leagues/[leagueId]/financeiro.tsx`, visible only when
`isLeaguePaid(league)`.

Sections (top → bottom):
1. **Revenue hero**: "Recebido este mês" for this league.
2. **KPI mini-row**: Membros ativos, Em atraso, Ticket médio.
3. **Membros**: status segment ([Em dia] [Atrasado] [Suspenso]) + list with
   avatar, name, status chip, price, last payment, next due.
4. **Transações**: [Todas | Pagas | Pendentes | Expiradas] + list with
   player name, amount, organizer share, status chip, date. Paginated.
5. **Cobrança**: read-only summary of price, interval, grace, approval mode.
   "Editar" links to existing league settings.

CRPC queries:
- `payment.dashboard.getLeagueFinance({ leagueId })` — hero + KPIs + members.
- `payment.dashboard.listLeagueTransactions({ leagueId, status, cursor })` —
  paginated transaction list.

### F5: PIX key onboarding as profile card

Move the onboarding form from `settings/organization/payments.tsx` into a
"Pagamentos" card on `settings/organization/profile.tsx`. Same components
(Select for key type, Input for key value, `react-hook-form` + zod), same
mutations (`onboarding.start`, `onboarding.getStatus`), same pix-key
validation (`@/lib/payments/pix-key`).

Delete `settings/organization/payments.tsx`. Remove the "Pagamentos" item
from the settings menu (the profile card replaces it).

### F6: Reconciliation cron

New cron (`reconcile-charges`, every 30 minutes):

```
1. Find PENDING paymentCharge rows older than 10 minutes.
2. For each, GET /api/v1/charge/{correlationId} from Woovi.
3. If Woovi says COMPLETED → applyPaidCharge (idempotent).
4. If Woovi says EXPIRED → markChargeExpired (idempotent).
5. If Woovi says ACTIVE → leave as-is (still pending).
```

Requires a new `getChargeAction` in `providerNode.ts` (calls Woovi REST).

Gate: `DEPLOY_ENV === "production"` (same as other crons).

### F7: Refund webhook handler

Extend `webhook-events.ts` with the refund event Woovi fires when a charge
is refunded via their dashboard. Extend `webhook.ts` dispatch:

```
OPENPIX:CHARGE_REFUNDED (or equivalent — confirm exact name with Woovi)
  → markChargeRefunded (existing privateMutation)
```

The existing `markChargeRefunded` already handles: status → REFUNDED,
membership → left, rankingPosition → null, notification. No domain change
needed — just wire the webhook.

### F8: Player hub improvements

Upgrade `settings/player/payments.tsx`:
- Section "Cobranças pendentes" (PENDING charges, tappable → checkout).
- Section "Histórico" (PAID, EXPIRED, REFUNDED — chronological, not tappable).
- Empty state only when both sections are empty.
- "Gerar novo PIX" button on expired charges (calls createCharge with same
  source, navigates to new checkout).

## Edge cases

| Scenario | Handling |
|---|---|
| Grace period changed while a player is in `payment_due` | New grace applies on next cron run (grace is computed from due date + current `gracePeriodDays`, not snapshotted) |
| League price increased mid-cycle | Player keeps current cycle at old price; next charge uses new price (D6) |
| Player in 3 paid leagues, 1 overdue | Each membership is independent — 1 suspended, 2 active |
| Webhook arrives after charge already expired locally | `canChargeBePaid` guard rejects (only PENDING → PAID); reconciliation cron catches real payments |
| Player pays after suspension | `createCharge` works (membership is `suspended` → `canMembershipBeCharged` returns false). **Fix needed**: extend `canMembershipBeCharged` to also accept `suspended` and `payment_due` |
| Refund webhook arrives for an already-REFUNDED charge | `canChargeBeRefunded` guard accepts PAID + EXPIRED; REFUNDED → no-op |
| Cron overlap (reminder + reconcile) | Each is idempotent via status guards |

### Critical fix: `canMembershipBeCharged` must accept `suspended` and `payment_due`

Current rule (`convex/domains/payment/rules.ts:83`):
```ts
export function canMembershipBeCharged(membership: MembershipLike): boolean {
  return membership.status === LEAGUE_MEMBERSHIP_STATUSES.AWAITING_PAYMENT;
}
```

This blocks suspended and payment_due members from generating a new charge.
It must be extended:
```ts
const CHARGEABLE_STATUSES = new Set([
  "awaiting_payment",
  "suspended",
  "payment_due",
]);
export function canMembershipBeCharged(membership: MembershipLike): boolean {
  return CHARGEABLE_STATUSES.has(membership.status);
}
```

Without this fix, a suspended player cannot re-pay to reactivate.

## Relationship to existing specs

- Supersedes the "Phase 2 (automatic recurrence)" and "Phase 3 (organizer
  dashboard)" sections of `2026-06-28-league-payment-woovi-split-design.md`.
- The original Phase 1 (one-time charges, webhook, split) is the foundation
  — this spec builds on it, not replaces it.
- The Woovi PoC results (`2026-07-02-woovi-poc-results.md`) remain valid for
  the one-time charge API. Pix Automático PoC is deferred indefinitely.
