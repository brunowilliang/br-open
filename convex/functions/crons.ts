import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep PENDING charges past their `expiresAt` and mark them EXPIRED.
// Mirrors Woovi's OPENPIX:CHARGE_EXPIRED so local state stays consistent even
// if a webhook delivery is missed. Notifies the player to generate a new PIX.
crons.interval(
  "expire-stale-charges",
  { hours: 1 },
  internal.payment.charge.expireStaleCharges,
  {}
);

// Send renewal reminders for paid leagues (manual renewal Phase 1).
// Runs daily: for each PAID charge, computes nextDue = paidAt + interval,
// sends renewal_reminder (≤3 days) or marks membership suspended (past due).
crons.interval(
  "send-renewal-reminders",
  { hours: 24 },
  internal.payment.charge.sendRenewalReminders,
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

// Refresh the cached subaccount balance for every organization with an
// active payment account (DECISAO-003). Queries can't call the provider, so
// the withdraw screen reads a cache that this cron reconciles every 5
// minutes (withdrawals also adjust the cache immediately).
crons.interval(
  "refresh-subaccount-balances",
  { minutes: 5 },
  internal.payment.withdraw.refreshSubaccountBalances,
  {}
);

// Retry the fee debit (subaccount → BR-Open main account) for COMPLETED
// withdrawals whose fee collection is still pending (BUG-0006) — a
// transient debit failure at request time used to mean lost revenue.
// feeStatus flips to "collected" only after the debit returns ok.
crons.interval(
  "sweep-pending-withdraw-fees",
  { minutes: 15 },
  internal.payment.withdraw.sweepPendingWithdrawFees,
  {}
);

export default crons;
