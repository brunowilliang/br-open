/**
 * Recolhimento da parte do organizador quando o estorno FECHA: o
 * estorno integral sai da conta maior, entao a parte que o split depositou na
 * subconta (`organizerCents`) volta por um debito subconta -> conta principal.
 *
 * Mesmo mecanismo e mesmo padrao da taxa do saque (`sweepPendingWithdrawFees`):
 * o `refundRecoveryStatus` da propria cobranca e a chave idempotente local (o
 * endpoint de debit nao aceita correlationID), o debito roda fora da transacao e
 * o sweep de 15 min retenta ate confirmar; a reserva da organizacao segura o
 * valor enquanto `pending`.
 */

import { eq, type InferSelectModel } from "kitcn/orm";
import { z } from "zod";
import { paymentAccountSchema } from "../../domains/payment/contract";
import {
  RECOVERY_STATUS_COLLECTED,
  RECOVERY_STATUS_PENDING,
  isRefundRecoveryDue,
  refundRecoveryKey,
} from "../../domains/payment/rules";
import { paymentCharge } from "../../domains/payment/tables";
import { DEBIT_RECOVERY_DESCRIPTION } from "../../domains/payment/provider-requests";
import { getEnv } from "../../lib/get-env";
import { privateAction, privateMutation, privateQuery } from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, QueryCtx } from "../generated/server";

const recoveryTargetSchema = z.object({
  chargeId: z.string(),
  correlationId: z.string(),
  pixKey: z.string(),
  valueCents: z.number().int().positive(),
});

type RecoveryTarget = z.infer<typeof recoveryTargetSchema>;
type ChargeRecord = InferSelectModel<typeof paymentCharge>;

/** Alvo do recolhimento de uma cobranca: valor que a subconta DE FATO recebeu no
 * split + chave PIX ativa da organizacao. `null` quando nao ha o que recolher
 * (sem split, estorno nao fechado ou conta de pagamento fora do ar). */
async function recoveryTargetOf(
  ctx: QueryCtx,
  row: ChargeRecord
): Promise<RecoveryTarget | null> {
  const valueCents = row.splitConfig?.organizerCents ?? 0;
  if (valueCents <= 0 || !isRefundRecoveryDue(row)) {
    return null;
  }
  const org = await ctx.orm.query.organization.findFirst({
    where: { id: row.organizationId },
  });
  const account = org?.paymentAccount
    ? paymentAccountSchema.safeParse(org.paymentAccount).data
    : null;
  if (account?.status !== "active") {
    return null;
  }
  return {
    chargeId: row.id as string,
    correlationId: row.correlationId,
    pixKey: account.pixKey,
    valueCents,
  };
}

/** Cobranças com recolhimento devido (bounded, mais antigas primeiro). */
export const listPendingRefundRecoveries = privateQuery
  .output(z.array(recoveryTargetSchema))
  .query(async ({ ctx }) => {
    const rows = await ctx.orm.query.paymentCharge.findMany({
      limit: 50,
      orderBy: { updatedAt: "asc" },
      where: { refundRecoveryStatus: RECOVERY_STATUS_PENDING },
    });
    const targets: RecoveryTarget[] = [];
    for (const row of rows) {
      const target = await recoveryTargetOf(ctx, row);
      if (target) {
        targets.push(target);
      }
    }
    return targets;
  });

/**
 * Re-confere UMA cobranca antes do debito (e devolve o alvo): a linha pode ter
 * saido de `pending` por outro caminho, e debitar duas vezes cobraria o mesmo
 * estorno em dobro.
 */
export const getRefundRecoveryTarget = privateQuery
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(recoveryTargetSchema.nullable())
  .query(async ({ ctx, input }) => {
    const row = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });
    return row ? await recoveryTargetOf(ctx, row) : null;
  });

/** Fecha o recolhimento so DEPOIS do debito confirmado, re-conferindo o estado
 * antes de escrever (`pending` e a unica porta para um novo debito). */
export const markRefundRecoveryCollected = privateMutation
  .input(z.object({ chargeId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });
    if (!(row && isRefundRecoveryDue(row))) {
      return { ok: false };
    }
    await ctx.orm
      .update(paymentCharge)
      .set({
        refundRecoveryStatus: RECOVERY_STATUS_COLLECTED,
        updatedAt: new Date(),
      })
      .where(eq(paymentCharge.id, row.id));
    return { ok: true };
  });

/** Recolhe o debito de UMA cobranca: kick imediato no fechamento do estorno e
 * tambem o corpo do sweep, com a mesma re-conferencia antes de debitar. */
export const collectRefundRecovery = privateAction
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(z.object({ collected: z.boolean() }))
  .action(async ({ ctx, input }) => await collectOne(ctx, input.chargeId));

/**
 * Cron entry (15 min): retenta o debito das cobrancas com estorno fechado e
 * recolhimento pendente — falha por saldo (organizador ja sacou) ou provedor
 * instavel nao pode virar prejuizo da plataforma. At-least-once: o estado so
 * vira "collected" DEPOIS do debito ok.
 */
export const sweepPendingRefundRecoveries = privateAction.action(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { swept: 0 };
    }
    const due = await ctx.runQuery(
      internal.payment.recovery.listPendingRefundRecoveries,
      {}
    );
    let swept = 0;
    for (const item of due) {
      const result = await collectOne(ctx, item.chargeId);
      if (result.collected) {
        swept += 1;
      }
    }
    return { swept };
  }
);

async function collectOne(
  ctx: ActionCtx,
  chargeId: string
): Promise<{ collected: boolean }> {
  const target = await ctx.runQuery(
    internal.payment.recovery.getRefundRecoveryTarget,
    { chargeId }
  );
  if (!target) {
    return { collected: false };
  }
  try {
    await ctx.runAction(internal.payment.providerNode.debitSubaccountAction, {
      description: DEBIT_RECOVERY_DESCRIPTION,
      pixKey: target.pixKey,
      valueCents: target.valueCents,
    });
  } catch (error) {
    // Saldo insuficiente ou provedor instavel: a cobranca segue `pending` e a
    // reserva continua segurando o valor ate o proximo tick.
    console.error(
      `[recovery] debito falhou (${refundRecoveryKey(target.correlationId)}):`,
      error
    );
    return { collected: false };
  }
  await ctx.runMutation(internal.payment.recovery.markRefundRecoveryCollected, {
    chargeId,
  });
  return { collected: true };
}
