import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep PENDING charges past their `expiresAt` and mark them EXPIRED.
// Mirrors Woovi's OPENPIX:CHARGE_EXPIRED so local state stays consistent even
// if a webhook delivery is missed (no notification: the app reads the state).
crons.interval(
  "expire-stale-charges",
  { hours: 1 },
  internal.payment.charge.expireStaleCharges,
  {}
);

// Reconcile PENDING charges older than 10 min against the provider API.
// Catches payments that succeeded on the provider side but whose webhook
// delivery was missed. Runs every 30 minutes.
crons.interval(
  "reconcile-charges",
  { minutes: 30 },
  internal.payment.charge.reconcileCharges,
  {}
);

crons.interval(
  "sweep-stale-deliveries",
  { minutes: 1 },
  internal.notification.orchestrator.sweepStaleInProgressDeliveries,
  {}
);

// Refresh the cached subaccount balance of every organization with an active
// payment account: queries can't call the provider, so the withdraw screen reads
// this cache (5 min; withdrawals also adjust it immediately).
crons.interval(
  "refresh-subaccount-balances",
  { minutes: 5 },
  internal.payment.withdraw.refreshSubaccountBalances,
  {}
);

// Retry the fee debit (subaccount → BR-Open main account) for COMPLETED
// withdrawals whose fee collection is still pending — a
// transient debit failure at request time used to mean lost revenue.
// feeStatus flips to "collected" only after the debit returns ok.
crons.interval(
  "sweep-pending-withdraw-fees",
  { minutes: 15 },
  internal.payment.withdraw.sweepPendingWithdrawFees,
  {}
);

// Retry tournament refunds that failed or never confirmed.
// Charges in refundStatus pending/failed get an idempotent provider retry
// (`refund-<correlationId>` key) — same sweep pattern as withdraw fees.
crons.interval(
  "sweep-pending-tournament-refunds",
  { minutes: 15 },
  internal.tournament.lifecycle.sweepPendingRefunds,
  {}
);

// Auto-transicoes de torneio (de hora em hora): quando o PRAZO DE INSCRICAO
// fecha, um torneio publicado SORTEIA SOZINHO e fica `drawn` (a previa do
// organizador); no DIA DE INICIO ele comeca — se ainda nao sorteou, sorteia e
// comeca no mesmo tick.
crons.interval(
  "auto-start-tournaments",
  { hours: 1 },
  internal.tournament.bracket.autoStartTournaments,
  {}
);

export default crons;
