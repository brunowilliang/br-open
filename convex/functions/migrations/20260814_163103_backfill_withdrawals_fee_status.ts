import { defineMigration } from "../generated/migrations.gen";

// Mirrors the WITHDRAW_FEE_STATUS_* constants in
// convex/domains/payment/withdraw-rules.ts (kept literal so the migration
// stays self-contained, same as 20260711_000002).
const FEE_STATUS_COLLECTED = "collected";
const FEE_STATUS_NOT_OWED = "not_owed";
const FEE_STATUS_PENDING = "pending";

type LegacyWithdrawalDoc = {
  failureReason?: null | string;
  feeCents?: number;
  feeStatus?: null | string;
  status?: null | string;
};

export const migration = defineMigration({
  description: "backfill withdrawals feeStatus (BUG-0006)",
  id: "20260814_163103_backfill_withdrawals_fee_status",
  up: {
    migrateOne: (_ctx, doc) => {
      const withdrawal = doc as LegacyWithdrawalDoc;

      if (withdrawal.feeStatus) {
        // Post-deploy rows already carry an explicit value.
        return;
      }

      // Free-tier withdrawals and anything not completed owe no fee: a
      // failed/never-executed PIX out never debits the fee, and only
      // completed rows ever did.
      if (!withdrawal.feeCents || withdrawal.status !== "completed") {
        return { feeStatus: FEE_STATUS_NOT_OWED };
      }

      // On completed rows `failureReason` is set exclusively by the failed
      // fee-debit path in requestWithdraw: a note means the debit failed and
      // the sweep (sweepPendingWithdrawFees) must retry it; no note means
      // the inline debit succeeded.
      return {
        feeStatus: withdrawal.failureReason
          ? FEE_STATUS_PENDING
          : FEE_STATUS_COLLECTED,
      };
    },
    table: "withdrawals",
  },
});
