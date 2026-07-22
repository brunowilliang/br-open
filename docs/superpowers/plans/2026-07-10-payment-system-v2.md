# Payment System v2 — Implementation Plan

> Design spec: `docs/superpowers/specs/2026-07-10-payment-system-v2-design.md`
> Read that first — this plan assumes you have.

## Phase 1 — Grace period + proactive renewal cron

**Goal:** Replace the rigid "suspend immediately on overdue" behavior with a
configurable grace period and proactive reminders.
**Complexity:** M · **Dependencies:** None

### 1.1 League fields

| File | Change |
|---|---|
| `convex/domains/league/tables.ts` | Add `gracePeriodDays: integer()`, `reminderDaysBefore: integer()` |
| `convex/domains/league/contract.ts` | Add to `CreateLeagueSchema` + `UpdateLeagueSchema` (optional, default via serializer). Add constants `DEFAULT_GRACE_PERIOD_DAYS = 7`, `DEFAULT_REMINDER_DAYS_BEFORE = 3` |
| `convex/domains/league/contract.ts` | Add `"payment_due"` to `LeagueMembershipStatusOptions` + `LEAGUE_MEMBERSHIP_STATUSES.PAYMENT_DUE` |
| `convex/functions/schema.ts` | No change (composition-only; new fields flow through domain tables) |
| `convex/functions/migrations/` | New migration: add the two columns (nullable). Existing leagues get defaults from serializer |

### 1.2 Fix `canMembershipBeCharged`

| File | Change |
|---|---|
| `convex/domains/payment/rules.ts` | Extend to accept `awaiting_payment`, `suspended`, `payment_due` |
| `convex/domains/payment/tests/rules.test.ts` | Add cases for `suspended` and `payment_due` |

### 1.3 Rewrite renewal cron

| File | Change |
|---|---|
| `convex/functions/payment/charge.ts` | Rewrite `sendRenewalReminders` to implement grace period timeline (D-reminder → D-0 payment_due → D+grace suspended). Read `gracePeriodDays` and `reminderDaysBefore` from league at runtime. Preserve `rankingPosition` on `payment_due` and `suspended` transitions |
| `convex/domains/payment/rules.ts` | Add `shouldSendReminder(nextDueMs, now, reminderDaysBefore)`, `shouldMarkPaymentDue(nextDueMs, now)`, `shouldSuspend(nextDueMs, now, gracePeriodDays)` pure helpers |
| `convex/domains/payment/tests/rules.test.ts` | Cover all three helpers with edge cases (exactly at boundary, 1ms before/after) |

### 1.4 League create/edit form

| File | Change |
|---|---|
| `src/app/(private)/settings/leagues/[mode]/settings.tsx` | Add `gracePeriodDays` (NumberField, "Carência (dias)") and `reminderDaysBefore` (NumberField, "Lembrete antes do vencimento (dias)") to the "Cobrança" section. Only visible when `monthlyPriceCents > 0` |
| `src/lib/leagues/presentation.ts` | Add `formatGracePeriod(days)` → "7 dias de carência" |

### 1.5 Warning banners

| File | Change |
|---|---|
| `src/components/pages/leagues/league-detail-view.tsx` (or wherever the overview renders) | Show warning banner when viewer membership is `payment_due`: "Seu pagamento está atrasado. Pague em até X dias para não ser suspenso." (bg-warning-soft) |

**Validation gate:** `bun run codegen && bun run check && bun test convex`

---

## Phase 2 — Payment notifications

**Goal:** Push notifications for key payment events.
**Complexity:** S · **Dependencies:** Phase 1

### 2.1 Notification events

| File | Change |
|---|---|
| `convex/shared/notifications/protocol.ts` (or `convex/domains/notification/definitions.ts`) | Add events: `league.membership.charge_created`, `league.membership.payment_due`, `league.membership.renewal_reminder` (existing `renewal_due` already exists) |
| `convex/domains/notification/definitions.ts` | Deep-link routes for each new event |

### 2.2 Wire notifications

| File | Change |
|---|---|
| `convex/functions/payment/charge.ts` | After `saveCharge` in `createCharge`: schedule `charge_created` notification. In cron: `renewal_reminder` (Phase 1), `payment_due` (Phase 1), `renewal_due` (Phase 1, already exists) |

**Validation gate:** `bun run check && bun test`

---

## Phase 3a — Organizer dashboard on Home

**Goal:** When the app is in organizer mode, the Home tab shows a revenue
dashboard instead of just a league grid.
**Complexity:** M · **Dependencies:** None (queries read existing data)

### 3a.1 Dashboard query

| File | Change |
|---|---|
| `convex/functions/payment/dashboard.ts` (NEW) | `getOverview` authQuery — requires active manager. Returns: `{ receivedThisMonthCents, receivedLastMonthCents, activeSubscribers, overdueCount, paymentsThisMonth, projectedMonthlyCents, recentCharges[], paidLeagues[] }`. Single round-trip. Joins `playerProfile` for names in recent charges (or uses snapshot after 3b migration) |
| `convex/domains/payment/contract.ts` | Add `dashboardOverviewSchema`, `dashboardRecentChargeSchema` zod schemas |

### 3a.2 Home screen upgrade (organizer mode)

| File | Change |
|---|---|
| `src/app/(private)/(tabs)/index.tsx` | Branch: organizer mode → render dashboard (hero KPI, KPI grid, recent activity, then existing league grid below). Player mode → unchanged |
| `src/components/pages/payments/dashboard-overview.tsx` (NEW) | Reusable component: hero KPI card + 2×2 KPI grid + recent activity list. Used by Home |
| `src/lib/payments/format.ts` (NEW or extend `presentation.ts`) | `formatCurrency(cents)`, `formatTrendPercent(current, previous)` → "+12%" or "-5%" or "Novo" |

### 3a.3 Empty/gate states

| Condition | Render |
|---|---|
| Woovi not connected | Onboarding CTA card only (inline, not settings page) |
| Connected, 0 paid leagues | Empty state "Nenhuma liga com cobrança" + CTA → league settings |
| Connected, 0 charges ever | KPIs show 0, recent activity shows "Nenhum pagamento ainda" |

**Validation gate:** `bun run check`

---

## Phase 3b — League "Financeiro" tab

**Goal:** A new tab in the league detail for paid leagues showing member
payment status + transaction history.
**Complexity:** M · **Dependencies:** 3a.1 (dashboard queries), Phase 1
(payment_due status for member list)

### 3b.1 Snapshot migration (performance)

| File | Change |
|---|---|
| `convex/domains/payment/tables.ts` | Add `leagueId: text()`, `leagueName: text()`, `playerName: text()` to `paymentCharge` |
| `convex/functions/payment/charge.ts` | Populate in `resolveSourceForCharge` return + `saveCharge` input (already loads league + playerProfile there) |
| `convex/functions/migrations/` | Backfill migration: join existing charges → league + playerProfile, populate snapshots |
| `convex/domains/payment/contract.ts` | Extend `myPaymentItemSchema` / `checkoutContextSchema` if needed (they already have sourceLabel) |

### 3b.2 League finance queries

| File | Change |
|---|---|
| `convex/functions/payment/dashboard.ts` | Add `getLeagueFinance({ leagueId })` authQuery — requires manager of the league's org. Returns: `{ receivedThisMonthCents, activeMembers, overdueMembers, averageTicketCents, members[], billingSummary }`. `members[]` includes: name, avatar, status, price, lastPaymentDate, nextDueDate |
| `convex/functions/payment/dashboard.ts` | Add `listLeagueTransactions({ leagueId, status, cursor, limit })` authQuery — paginated. Returns: `{ items[], nextCursor, hasMore, summary }`. Items: playerName, amountCents, organizerCents, status, paidAt/createdAt |

### 3b.3 Financeiro tab UI

| File | Change |
|---|---|
| `src/app/(private)/leagues/[leagueId]/financeiro.tsx` (NEW) | New tab screen. Sections: revenue hero, KPI mini-row, member status segment + list, transaction list (with status filter + pagination), billing summary card |
| `src/app/(private)/leagues/[leagueId]/_layout.tsx` | Add "Financeiro" tab. Conditional: only render when `isLeaguePaid(league)`. Tab icon: `Wallet01Icon` or `ChartIcon` |
| `src/components/pages/payments/finance-member-row.tsx` (NEW) | Reusable member row: avatar, name, league·interval, status chip, price, last payment, next due |
| `src/components/pages/payments/finance-transaction-row.tsx` (NEW) | Reusable transaction row: player name, amount, organizer share, status chip, date |
| `src/components/payments/payment-status-chip.tsx` (NEW) | Shared status → chip component: PAID→success "Pago", PENDING→warning "Pendente", EXPIRED→danger "Expirado", REFUNDED→default "Reembolsado", FAILED→danger "Falhou". Also membership: active→success "Em dia", payment_due→warning "Atrasado", suspended→danger "Suspenso" |

**Validation gate:** `bun run check`

---

## Phase 4 — PIX key as profile card + cleanup

**Goal:** Move Woovi onboarding into org profile, delete the standalone
payments settings page.
**Complexity:** S · **Dependencies:** 3a (dashboard no longer needs settings page)

### 4.1 Profile card

| File | Change |
|---|---|
| `src/app/(private)/settings/organization/profile.tsx` | Add "Pagamentos" card (3 states: not connected / connected / pending). Reuses `onboarding.start` mutation, `onboarding.getStatus` query, `@/lib/payments/pix-key` validation. Same `react-hook-form` + zod pattern |
| `src/app/(private)/settings/organization/payments.tsx` | **Delete file** |
| `src/app/(private)/settings/index.tsx` | Remove "Pagamentos" item from the sections array (organizer section). The profile link already exists |

### 4.2 Backend cleanup

| File | Change |
|---|---|
| No backend changes | `onboarding.start` and `onboarding.getStatus` stay exactly as-is — just called from profile instead of a dedicated page |

**Validation gate:** `bun run check`

---

## Phase 5 — Reliability (reconciliation + refund webhook)

**Goal:** Catch missed webhooks and handle dashboard-initiated refunds.
**Complexity:** M · **Dependencies:** None (independent)

### 5.1 Reconciliation cron

| File | Change |
|---|---|
| `convex/functions/payment/providerNode.ts` | Add `getChargeStatusAction` (privateAction, `"use node"`) — calls `GET /api/v1/charge/{correlationId}` on Woovi. Returns normalized status |
| `convex/functions/payment/charge.ts` | Add `reconcileCharges` privateMutation. Finds PENDING charges older than 10 min, calls `getChargeStatusAction` for each, dispatches to `applyPaidCharge` or `markChargeExpired` based on Woovi response |
| `convex/crons.ts` | Add `reconcile-charges` interval (30 min) |

### 5.2 Refund webhook

| File | Change |
|---|---|
| `convex/domains/payment/webhook-events.ts` | Add `OPENPIX_CHARGE_REFUNDED` event constant + payload schema (confirm exact event name with Woovi docs/dashboard) |
| `convex/functions/payment/webhook.ts` | Add dispatch: `OPENPIX:CHARGE_REFUNDED` → `markChargeRefunded` (existing privateMutation, already handles membership → left + notification) |

**Validation gate:** `bun run check && bun test`

---

## Phase 6 — Player hub improvements

**Goal:** Cleaner payment hub with sections and easy re-payment.
**Complexity:** S · **Dependencies:** Phase 1 (payment_due status)

### 6.1 Hub upgrade

| File | Change |
|---|---|
| `src/app/(private)/settings/player/payments.tsx` | Restructure: "Cobranças pendentes" section (PENDING, tappable → checkout) + "Histórico" section (PAID/EXPIRED/REFUNDED, not tappable). Hide empty sections. Only show EmptyState when fully empty |
| `src/app/(private)/settings/player/payments.tsx` | Add "Gerar novo PIX" button on expired charges → calls `createCharge` with same `{sourceType, sourceId}` → navigates to new checkout |

**Validation gate:** `bun run check`

---

## Execution order

```
Phase 1 (grace period + cron)         ← foundation, nothing else works without this
  ↓
Phase 2 (notifications)               ← quick, depends on Phase 1 statuses
  ↓
Phase 3b.1 (snapshot migration)       ← performance prerequisite for 3a + 3b
  ↓
Phase 3a (dashboard on Home)          ┐
Phase 3b (Financeiro tab)             ┘ ← can be done in parallel after migration
  ↓
Phase 4 (profile card + cleanup)     ← remove old payments page after 3a is live
  ↓
Phase 5 (reliability)                 ← independent, can slot in anywhere after Phase 1
  ↓
Phase 6 (player hub)                  ← polish, last
```

## Risk matrix

| Risk | Severity | Mitigation |
|---|---|---|
| `payment_due` status breaks existing UI checks | Medium | Grep all status checks in `src/` and `convex/` for exhaustive switch/if chains; ensure `payment_due` is handled (it should fall through to "can play" in most cases) |
| Snapshot migration is slow for many charges | Low | Backfill in batches of 100; charges table is small (<10k rows expected) |
| Reconciliation cron hits Woovi rate limit | Low | 30-min interval, batch size small; Woovi REST has generous limits |
| Refund webhook event name unknown | Low | Confirm via Woovi dashboard test refund; add handler once confirmed |
| Home screen branching makes player-organizer switching jarring | Medium | Use the same Page scaffold; only the content area changes; test the mode switch transition |
