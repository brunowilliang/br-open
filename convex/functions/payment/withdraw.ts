/**
 * Organizer withdrawals. Queries can't call the provider, so `getBalance` serves a
 * cached balance (5-min cron + adjustment after a withdrawal). `requestWithdraw`
 * checks the REAL balance, RESERVES a row with a unique `idempotencyKey` BEFORE the
 * PIX out (the endpoint accepts no correlationID, so retries dedupe locally), then
 * PIXes out the LIQUID amount and the tiered fee in a separate debit.
 */

import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { getEnv } from "../../lib/get-env";
import {
  paymentAccountSchema,
  requestWithdrawOutputSchema,
  withdrawBalanceSchema,
  withdrawStatusSchema,
  type WithdrawStatus,
} from "../../domains/payment/contract";
import { maskPixKey } from "../../domains/payment/pix-key";
import { subaccountBalance, withdrawals } from "../../domains/payment/tables";
import {
  authAction,
  authQuery,
  privateAction,
  privateMutation,
  privateQuery,
} from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireActiveManager } from "../viewer/context";
import {
  FREE_WITHDRAW_FROM_CENTS,
  MIN_WITHDRAW_CENTS,
  WITHDRAW_FEE_STATUS_COLLECTED,
  WITHDRAW_FEE_STATUS_PENDING,
  WITHDRAW_FEE_TIERS,
  WITHDRAW_STATUS_COMPLETED,
  canCompleteWithdrawal,
  canFailWithdrawal,
  computeLiquidAmountCents,
  computeWithdrawFee,
  feeStatusAfterFailure,
  generateWithdrawIdempotencyKey,
  initialFeeStatus,
  isFeeCollectionDue,
  resolveWithdrawalReservation,
} from "../../domains/payment/withdraw-rules";

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Cached subaccount balance + withdrawal rules for the active organization, mirroring
 * `src/lib/withdraw/contract.ts`. ≤5 min stale after payments; 0 until the first refresh.
 */
export const getBalance = authQuery
  .output(withdrawBalanceSchema)
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);

    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });
    const account = org?.paymentAccount
      ? paymentAccountSchema.safeParse(org.paymentAccount).data
      : null;
    if (account?.status !== "active") {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Conta de pagamento não configurada. Conecte a chave PIX no perfil da organização.",
      });
    }

    const cache = await ctx.orm.query.subaccountBalance.findFirst({
      where: { organizationId },
    });

    return {
      // Destination shown straight from here — no onboarding.getStatus call.
      accountName: account.accountName,
      balanceCents: cache?.balanceCents ?? 0,
      feeTiers: WITHDRAW_FEE_TIERS.map((tier) => ({
        feeCents: tier.feeCents,
        upToCents: tier.upToCents,
      })),
      freeFromCents: FREE_WITHDRAW_FROM_CENTS,
      minWithdrawCents: MIN_WITHDRAW_CENTS,
      pixKey: maskPixKey(account.pixKey),
    };
  });

/**
 * Withdraws part of the subaccount to its own PIX key: real provider balance,
 * tiered fee, local reservation holding the idempotency key BEFORE any provider
 * call, the PIX out of the LIQUID amount and the separate fee debit.
 */
export const requestWithdraw = authAction
  .input(
    z.object({
      amountCents: z.number().int().positive(),
      // Optional; generated server-side when absent. Keep it stable on retries.
      idempotencyKey: z.string().min(1).max(128).optional(),
    })
  )
  .output(requestWithdrawOutputSchema)
  .action(async ({ ctx, input }) => {
    const { organizationId } = await ctx.runMutation(
      internal.payment.charge.resolveActiveManagerOrg,
      { userId: ctx.userId }
    );
    const account = await ctx.runMutation(
      internal.payment.charge.resolvePaymentAccount,
      { organizationId }
    );

    if (input.amountCents < MIN_WITHDRAW_CENTS) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: `O valor mínimo de saque é ${formatBRL(MIN_WITHDRAW_CENTS)}.`,
      });
    }

    const balance = await ctx.runAction(
      internal.payment.providerNode.getSubaccountBalanceAction,
      { pixKey: account.pixKey }
    );
    if (balance.withdrawBlocked) {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Saque bloqueado para esta conta: a chave PIX está inválida ou restrita.",
      });
    }
    if (input.amountCents > balance.balanceCents) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "O valor não pode ser maior que o saldo disponível na subconta.",
      });
    }

    const feeCents = computeWithdrawFee(input.amountCents);
    const liquidAmountCents = computeLiquidAmountCents(
      input.amountCents,
      feeCents
    );

    // Reserve BEFORE the provider call: money never moves without a local row,
    // and a retry can never double-POST.
    const idempotencyKey =
      input.idempotencyKey ?? generateWithdrawIdempotencyKey(organizationId);
    const reservation = await ctx.runMutation(
      internal.payment.withdraw.reserveWithdrawal,
      {
        amountCents: input.amountCents,
        feeCents,
        idempotencyKey,
        liquidAmountCents,
        organizationId,
      }
    );
    if (!reservation.created) {
      // Replay of an in-flight withdrawal — never POST again.
      if (reservation.status === "failed") {
        throw new CRPCError({
          code: "CONFLICT",
          message:
            reservation.failureReason ??
            "O saque anterior falhou; tente novamente.",
        });
      }
      return {
        feeCents: reservation.feeCents,
        liquidAmountCents: reservation.liquidAmountCents,
        status: reservation.status,
      };
    }

    // 1) PIX out the LIQUID amount — on failure the reserved row is marked failed.
    let wooviWithdrawId: string | null;
    try {
      const withdrawal = await ctx.runAction(
        internal.payment.providerNode.withdrawSubaccountAction,
        {
          pixKey: account.pixKey,
          valueCents: liquidAmountCents,
        }
      );
      wooviWithdrawId = withdrawal.transactionId;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível solicitar o saque.";
      await ctx.runMutation(internal.payment.withdraw.failWithdrawal, {
        failureReason: message,
        idempotencyKey,
      });
      throw error;
    }

    // 2) Collect the tiered fee (subaccount → main account debit). If it fails the
    // organizer was already paid: the row stays COMPLETED, `feeStatus` stays "pending"
    // and the fee sweep retries with the row as the local idempotency guard.
    let feeCollected = false;
    let failureReason: string | null = null;
    if (feeCents > 0) {
      try {
        await ctx.runAction(
          internal.payment.providerNode.debitSubaccountAction,
          {
            pixKey: account.pixKey,
            valueCents: feeCents,
          }
        );
        feeCollected = true;
      } catch (error) {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "erro desconhecido";
        failureReason = `Saque executado, mas a coleta da taxa (${formatBRL(feeCents)}) para a BR-Open falhou: ${detail}.`;
        console.error(
          `[withdraw] coleta de taxa falhou (${idempotencyKey}):`,
          error
        );
      }
    }

    await ctx.runMutation(internal.payment.withdraw.completeWithdrawal, {
      balanceAfterCents: Math.max(balance.balanceCents - input.amountCents, 0),
      failureReason,
      feeCollected,
      idempotencyKey,
      wooviWithdrawId,
    });

    return {
      feeCents,
      liquidAmountCents,
      status: "pending",
    };
  });

const reserveWithdrawalInput = z.object({
  amountCents: z.number().int().positive(),
  feeCents: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1).max(128),
  liquidAmountCents: z.number().int().nonnegative(),
  organizationId: z.string().min(1),
});

/**
 * Reserves the local `withdrawals` row BEFORE any provider call. Replay lives in
 * `resolveWithdrawalReservation`: the same `idempotencyKey` replays that row, and
 * so does a row still IN-FLIGHT for the org (pending, no provider id), which
 * blocks a second concurrent withdrawal. The unique index on `idempotencyKey`
 * backstops concurrent same-key inserts.
 */
export const reserveWithdrawal = privateMutation
  .input(reserveWithdrawalInput)
  .output(
    z.object({
      created: z.boolean(),
      failureReason: z.string().nullable(),
      feeCents: z.number().int().nonnegative(),
      liquidAmountCents: z.number().int().nonnegative(),
      status: withdrawStatusSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const byKey = await ctx.orm.query.withdrawals.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    const pendingForOrg = await ctx.orm.query.withdrawals.findFirst({
      where: {
        organizationId: input.organizationId as Id<"organization">,
        status: "pending",
      },
    });
    const replay = resolveWithdrawalReservation({ byKey, pendingForOrg });
    if (replay) {
      return {
        created: false,
        failureReason: replay.failureReason,
        feeCents: replay.feeCents,
        liquidAmountCents: replay.liquidAmountCents,
        status: replay.status as WithdrawStatus,
      };
    }

    const now = new Date();
    await ctx.orm.insert(withdrawals).values({
      amountCents: input.amountCents,
      createdAt: now,
      feeCents: input.feeCents,
      // A tiered fee starts pending; the sweep only retries completed rows.
      feeStatus: initialFeeStatus(input.feeCents),
      idempotencyKey: input.idempotencyKey,
      liquidAmountCents: input.liquidAmountCents,
      organizationId: input.organizationId as Id<"organization">,
      status: "pending",
      updatedAt: now,
    });
    return {
      created: true,
      failureReason: null,
      feeCents: input.feeCents,
      liquidAmountCents: input.liquidAmountCents,
      status: "pending",
    };
  });

const completeWithdrawalInput = z.object({
  balanceAfterCents: z.number().int().nonnegative(),
  failureReason: z.string().nullable(),
  feeCollected: z.boolean(),
  idempotencyKey: z.string().min(1).max(128),
  wooviWithdrawId: z.string().nullable(),
});

/**
 * Finalizes a reserved withdrawal after the provider accepted the PIX out: the row
 * goes `completed` (it must NOT stay pending and gate future withdrawals as
 * "in flight"). A later `MOVEMENT_FAILED` webhook can still flip it to `failed`.
 */
export const completeWithdrawal = privateMutation
  .input(completeWithdrawalInput)
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.withdrawals.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!(row && canCompleteWithdrawal(row.status))) {
      console.warn(
        `[withdraw] completeWithdrawal sem linha pending (${input.idempotencyKey})`
      );
      return { ok: false };
    }

    const now = new Date();
    await ctx.orm
      .update(withdrawals)
      .set({
        failureReason: input.failureReason ?? row.failureReason ?? undefined,
        // The debit already moved the money → "collected"; else keep "pending".
        feeStatus: input.feeCollected
          ? WITHDRAW_FEE_STATUS_COLLECTED
          : initialFeeStatus(row.feeCents),
        status: WITHDRAW_STATUS_COMPLETED,
        updatedAt: now,
        ...(input.wooviWithdrawId
          ? { wooviWithdrawId: input.wooviWithdrawId }
          : {}),
      })
      .where(eq(withdrawals.id, row.id));

    const existing = await ctx.orm.query.subaccountBalance.findFirst({
      where: { organizationId: row.organizationId },
    });
    if (existing) {
      await ctx.orm
        .update(subaccountBalance)
        .set({
          balanceCents: input.balanceAfterCents,
          updatedAt: now,
        })
        .where(eq(subaccountBalance.id, existing.id));
    } else {
      await ctx.orm.insert(subaccountBalance).values({
        balanceCents: input.balanceAfterCents,
        organizationId: row.organizationId,
        updatedAt: now,
      });
    }

    return { ok: true };
  });

const failWithdrawalInput = z.object({
  failureReason: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128),
});

/**
 * Marks a reserved withdrawal failed when the provider rejected the PIX out (no
 * money moved). The balance cache is untouched — the 5-min cron reconciles it.
 */
export const failWithdrawal = privateMutation
  .input(failWithdrawalInput)
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.withdrawals.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!(row && canFailWithdrawal(row.status))) {
      return { ok: false };
    }
    const now = new Date();
    await ctx.orm
      .update(withdrawals)
      .set({
        failureReason: input.failureReason,
        // A pending fee is no longer owed; an already-collected one is untouched.
        ...(feeStatusAfterFailure(row.feeStatus)
          ? { feeStatus: feeStatusAfterFailure(row.feeStatus) }
          : {}),
        status: "failed",
        updatedAt: now,
      })
      .where(eq(withdrawals.id, row.id));
    return { ok: true };
  });

export const upsertBalanceCache = privateMutation
  .input(
    z.object({
      balanceCents: z.number().int().nonnegative(),
      organizationId: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const existing = await ctx.orm.query.subaccountBalance.findFirst({
      where: { organizationId: input.organizationId as Id<"organization"> },
    });
    if (existing) {
      await ctx.orm
        .update(subaccountBalance)
        .set({
          balanceCents: input.balanceCents,
          updatedAt: now,
        })
        .where(eq(subaccountBalance.id, existing.id));
    } else {
      await ctx.orm.insert(subaccountBalance).values({
        balanceCents: input.balanceCents,
        organizationId: input.organizationId as Id<"organization">,
        updatedAt: now,
      });
    }
    return { ok: true };
  });

/** Organizations with a connected (active) payment account (balance cron). */
export const listActivePaymentOrgs = privateQuery
  .output(
    z.array(
      z.object({
        organizationId: z.string(),
        pixKey: z.string(),
      })
    )
  )
  .query(async ({ ctx }) => {
    const orgs = await ctx.orm.query.organization.findMany({ limit: 100 });
    const active: { organizationId: string; pixKey: string }[] = [];
    for (const org of orgs) {
      const account = org.paymentAccount
        ? paymentAccountSchema.safeParse(org.paymentAccount).data
        : null;
      if (account?.status === "active") {
        active.push({
          organizationId: org.id as Id<"organization">,
          pixKey: account.pixKey,
        });
      }
    }
    return active;
  });

/**
 * Cron entry: refreshes the cached balance of every organization with an active
 * payment account (production only). 5 minutes.
 */
export const refreshSubaccountBalances = privateAction.action(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { refreshed: 0 };
    }
    const orgs = await ctx.runQuery(
      internal.payment.withdraw.listActivePaymentOrgs,
      {}
    );
    let refreshed = 0;
    for (const org of orgs) {
      // One bad pix key must not abort every other org's refresh.
      try {
        const balance = await ctx.runAction(
          internal.payment.providerNode.getSubaccountBalanceAction,
          { pixKey: org.pixKey }
        );
        await ctx.runMutation(internal.payment.withdraw.upsertBalanceCache, {
          balanceCents: balance.balanceCents,
          organizationId: org.organizationId,
        });
        refreshed += 1;
      } catch (error) {
        console.error(
          `[withdraw] refreshSubaccountBalances falhou para org ${org.organizationId}:`,
          error
        );
      }
    }
    return { refreshed };
  }
);

/**
 * Marks a withdrawal failed on the provider's `OPENPIX:MOVEMENT_FAILED` webhook,
 * matched by provider transaction id (accepts `pending` and `completed`). Unknown ids
 * are logged and ignored; the cached balance is left to the 5-min cron.
 */
export const markWithdrawFailedByProviderId = privateMutation
  .input(
    z.object({
      providerId: z.string().min(1),
      reason: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const withdrawal = await ctx.orm.query.withdrawals.findFirst({
      where: { wooviWithdrawId: input.providerId },
    });
    if (!(withdrawal && canFailWithdrawal(withdrawal.status))) {
      console.warn(
        `[withdraw] MOVEMENT_FAILED sem saque pendente/completed correspondente (${input.providerId})`
      );
      return { matched: false };
    }
    const now = new Date();
    await ctx.orm
      .update(withdrawals)
      .set({
        failureReason: input.reason,
        // Same rule as failWithdrawal: a pending fee is no longer owed.
        ...(feeStatusAfterFailure(withdrawal.feeStatus)
          ? { feeStatus: feeStatusAfterFailure(withdrawal.feeStatus) }
          : {}),
        status: "failed",
        updatedAt: now,
      })
      .where(eq(withdrawals.id, withdrawal.id));
    return { matched: true };
  });

/** Completed withdrawals whose fee is still pending (bounded, oldest first). */
export const listUncollectedFees = privateQuery
  .output(
    z.array(
      z.object({
        feeCents: z.number().int().positive(),
        id: z.string(),
        pixKey: z.string(),
      })
    )
  )
  .query(async ({ ctx }) => {
    const rows = await ctx.orm.query.withdrawals.findMany({
      limit: 50,
      orderBy: { createdAt: "asc" },
      where: { feeStatus: WITHDRAW_FEE_STATUS_PENDING },
    });
    const due = rows.filter((row) => isFeeCollectionDue(row));
    const result: { feeCents: number; id: string; pixKey: string }[] = [];
    for (const row of due) {
      const org = await ctx.orm.query.organization.findFirst({
        where: { id: row.organizationId },
      });
      const account = org?.paymentAccount
        ? paymentAccountSchema.safeParse(org.paymentAccount).data
        : null;
      if (account?.status === "active") {
        result.push({
          feeCents: row.feeCents,
          id: row.id,
          pixKey: account.pixKey,
        });
      }
    }
    return result;
  });

/**
 * Re-checks one fee right before the sweep debits it: a `MOVEMENT_FAILED` may have
 * flipped the row to `failed` in between, and debiting it would charge a fee for
 * money that came back.
 */
export const isWithdrawFeeStillDue = privateQuery
  .input(z.object({ id: z.string().min(1) }))
  .output(z.boolean())
  .query(async ({ ctx, input }) => {
    const row = await ctx.orm.query.withdrawals.findFirst({
      where: { id: input.id as Id<"withdrawals"> },
    });
    return row !== null && isFeeCollectionDue(row);
  });

/**
 * Marks a fee as collected after the sweep's debit, re-verifying
 * `isFeeCollectionDue` BEFORE writing: a `MOVEMENT_FAILED` in between leaves the
 * row `failed`, and overwriting it would wipe the webhook's `failureReason`.
 */
export const markWithdrawFeeCollected = privateMutation
  .input(z.object({ id: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.withdrawals.findFirst({
      where: { id: input.id as Id<"withdrawals"> },
    });
    if (!(row && isFeeCollectionDue(row))) {
      return { ok: false };
    }
    await ctx.orm
      .update(withdrawals)
      .set({
        failureReason: null,
        feeStatus: WITHDRAW_FEE_STATUS_COLLECTED,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, row.id));
    return { ok: true };
  });

/**
 * Cron entry: retries the fee debit (subaccount → BR-Open main account) for
 * completed withdrawals whose fee is still pending — a transient failure used to
 * mean lost revenue. At-least-once: `feeStatus` flips to "collected" only AFTER
 * the debit returns ok, and the row is re-verified as due right before the debit
 * and again before the flip.
 */
export const sweepPendingWithdrawFees = privateAction.action(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { swept: 0 };
    }
    const due = await ctx.runQuery(
      internal.payment.withdraw.listUncollectedFees,
      {}
    );
    let swept = 0;
    for (const item of due) {
      try {
        // Re-query right before the debit: a row that failed after the list snapshot
        // must not be charged a fee for money that came back.
        const stillDue = await ctx.runQuery(
          internal.payment.withdraw.isWithdrawFeeStillDue,
          { id: item.id }
        );
        if (!stillDue) {
          continue;
        }
        await ctx.runAction(
          internal.payment.providerNode.debitSubaccountAction,
          { pixKey: item.pixKey, valueCents: item.feeCents }
        );
        await ctx.runMutation(
          internal.payment.withdraw.markWithdrawFeeCollected,
          { id: item.id }
        );
        swept += 1;
      } catch (error) {
        console.error(
          `[withdraw] fee sweep falhou p/ saque ${item.id}:`,
          error
        );
      }
    }
    return { swept };
  }
);
