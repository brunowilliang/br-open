import { cronJobs } from "convex/server";
import { internal } from "./functions/_generated/api";

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

export default crons;
