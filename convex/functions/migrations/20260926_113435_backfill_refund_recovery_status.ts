import { defineMigration } from "../generated/migrations.gen";

// Literais espelhando RECOVERY_STATUS_* de convex/domains/payment/rules.ts
// (a migration fica autocontida, como a 20260814).
const RECOVERY_STATUS_NOT_OWED = "not_owed";
const RECOVERY_STATUS_PENDING = "pending";

type LegacyChargeDoc = {
  refundRecoveryStatus?: null | string;
  refundStatus?: null | string;
  splitConfig?: { organizerCents?: number } | null;
};

/**
 * A coluna `refundRecoveryStatus` nasce agora. Linha pre-migration
 * sem valor: so a cobranca com estorno FECHADO deve dinheiro de volta — e so
 * quando o split creditou a subconta (sem split nao houve credito, logo nao ha
 * recolhimento).
 */
export const migration = defineMigration({
  description: "backfill refundRecoveryStatus",
  id: "20260926_113435_backfill_refund_recovery_status",
  up: {
    migrateOne: (_ctx, doc) => {
      const charge = doc as LegacyChargeDoc;

      if (charge.refundRecoveryStatus) {
        // Post-deploy rows already carry an explicit value.
        return;
      }

      if (charge.refundStatus !== "refunded") {
        return { refundRecoveryStatus: RECOVERY_STATUS_NOT_OWED };
      }

      return {
        refundRecoveryStatus:
          (charge.splitConfig?.organizerCents ?? 0) > 0
            ? RECOVERY_STATUS_PENDING
            : RECOVERY_STATUS_NOT_OWED,
      };
    },
    table: "paymentCharge",
  },
});
