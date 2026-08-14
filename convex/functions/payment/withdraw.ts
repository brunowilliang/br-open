/**
 * Organizer withdrawals (DECISAO-003).
 *
 * `getBalance` (authQuery) exposes the cached real subaccount balance plus
 * the fee schedule — queries can't call the provider, so the balance cache
 * (`subaccountBalance`) is refreshed by the `refresh-subaccount-balances`
 * cron (5 min) and adjusted immediately after a withdrawal.
 *
 * `requestWithdraw` (authAction) validates against the REAL balance fetched
 * from the provider, computes the tiered fee, and:
 *   1. RESERVES a `withdrawals` row (pending) with a unique local
 *      `idempotencyKey` BEFORE any provider call — a retry that reuses the
 *      key (or finds another pending row for the org) replays the stored
 *      result instead of POSTing a duplicate PIX out (the Woovi withdraw
 *      endpoint accepts no correlationID);
 *   2. requests a PARTIAL PIX out of the LIQUID amount to the pix key
 *      registered on the subaccount;
 *   3. collects the tiered fee for BR-Open via a subaccount → main account
 *      debit (the withdraw endpoint supports no split);
 *   4. completes the row (provider id + balance cache) or marks it failed.
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
 * Current subaccount balance (cached) + withdrawal rules for the active
 * organization. Mirrors `src/lib/withdraw/contract.ts` (WithdrawBalance).
 *
 * The balance comes from a short-lived cache (≤5 min stale after payments;
 * updated immediately after withdrawals). A fresh organization shows 0
 * until the first cron refresh.
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
      // Withdraw destination (IBX-0002): account display name + masked pix
      // key, so the withdraw screen shows "account name + pix key" instead
      // of fetching payment.onboarding.getStatus separately.
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
 * Requests a partial withdrawal from the organization's subaccount to the
 * PIX key registered on it. Validates against the REAL provider balance,
 * computes the tiered fee, and:
 *
 *   1. RESERVES a `withdrawals` row (pending) with a unique local
 *      `idempotencyKey` BEFORE any provider call — the Woovi withdraw
 *      endpoint accepts no correlationID, so retries are deduplicated
 *      locally: a retry that reuses the key (or finds another pending
 *      withdrawal for the org) replays the stored result without POSTing
 *      a duplicate PIX out;
 *   2. requests a PARTIAL PIX out of the LIQUID amount (the organizer
 *      receives exactly the net value — DECISAO-003, decision 2026-08-10);
 *   3. collects the tiered fee for BR-Open via a subaccount → main account
 *      debit (the withdraw endpoint supports no split);
 *   4. completes the row (provider id + balance cache) or marks it failed.
 *
 * Public output shape (`requestWithdrawOutputSchema`) is unchanged.
 */
export const requestWithdraw = authAction
  .input(
    z.object({
      amountCents: z.number().int().positive(),
      // Optional local idempotency key; generated server-side when absent.
      // Keep it stable across retries of the same logical request.
      idempotencyKey: z.string().min(1).max(128).optional(),
    })
  )
  .output(requestWithdrawOutputSchema)
  .action(async ({ ctx, input }) => {
    // Resolve the active organization (owner/admin only) and its connected
    // payment account. Reuses the charge module's private mutations.
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

    // Fetch the REAL balance + block flag from the provider.
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

    // Reserve the local row BEFORE any provider call: if the PIX out goes
    // through and something fails afterwards, the money is never orphaned
    // without a local record, and a retry can never double-POST.
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
      // Idempotent replay: this request (or another withdrawal for the org)
      // is already in flight. Never POST again.
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

    // 1) PIX out the LIQUID amount to the pix key registered on the
    // subaccount. On failure: mark the reserved row failed and surface the
    // provider error (no money moved).
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

    // 2) Collect the tiered fee for BR-Open (subaccount → main account
    // debit). If it fails the organizer already got paid — the row is
    // COMPLETED with the fee note kept in `failureReason` and `feeStatus`
    // stays "pending", so the fee sweep cron (sweepPendingWithdrawFees,
    // BUG-0006) retries the debit later with the row as the local
    // idempotency guard (the debit endpoint accepts no idempotency id).
    // Never fail the whole withdrawal over the fee collection.
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

    // 3) Complete the row: provider id + balance cache coherent.
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
 * Atomically reserves the local `withdrawals` row (pending) for a
 * withdrawal request BEFORE any provider call.
 *
 * Replay semantics (idempotency — the Woovi withdraw endpoint accepts no
 * correlationID), delegated to `resolveWithdrawalReservation`:
 *   - the same `idempotencyKey` was already reserved → replay that row;
 *   - a different row is still IN-FLIGHT for the org (pending WITHOUT a
 *     provider id) → replay it (blocks a second concurrent withdrawal);
 *   - otherwise insert a fresh pending row.
 * Rows that already have `wooviWithdrawId` (executed, status completed/failed
 * or pending) do NOT gate a new withdrawal (BUG-0001 fix).
 * The unique index on `idempotencyKey` backstops concurrent same-key
 * inserts (the loser's insert throws; a retry then replays).
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
      // Fee sweep bookkeeping (BUG-0006): a tiered fee starts pending; the
      // sweep only ever retries completed rows (see isFeeCollectionDue).
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
 * Finalizes a reserved withdrawal after the provider accepted the PIX out:
 * transitions the row to `completed` (BUG-0001: a completed row must NOT
 * stay pending and gate future withdrawals as "in flight"), stores the
 * provider transaction id, records an optional fee-collection note, and
 * keeps the balance cache coherent right after the PIX out (the cron
 * reconciles drift from incoming payments).
 *
 * A `MOVEMENT_FAILED` webhook arriving afterwards can still transition
 * `completed` → `failed` (the money returns to the subaccount).
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
        // Fee sweep bookkeeping (BUG-0006): the inline debit already moved
        // the money → "collected"; otherwise keep "pending" so the sweep
        // retries. Free-tier rows stay "not_owed" untouched.
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

    // Keep the balance cache coherent right after the provider accepted the
    // PIX out (the cron reconciles drift from incoming payments).
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
 * Marks a reserved withdrawal as failed when the provider rejected the PIX
 * out (no money moved). The balance cache is left untouched — the 5-min
 * refresh cron reconciles it.
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
        // Fee sweep bookkeeping (BUG-0006): a fee still pending is no
        // longer owed (the PIX out never executed / was returned); an
        // already-collected fee is left untouched.
        ...(feeStatusAfterFailure(row.feeStatus)
          ? { feeStatus: feeStatusAfterFailure(row.feeStatus) }
          : {}),
        status: "failed",
        updatedAt: now,
      })
      .where(eq(withdrawals.id, row.id));
    return { ok: true };
  });

/** Upserts the cached subaccount balance (cron). */
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

/**
 * Lists organizations with a connected (active) payment account. Used by
 * the balance-refresh cron to reconcile the cache against the provider.
 */
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
    // Bounded scan (project pattern: limit 100, same as charge.ts) — the
    // cron runs every 5 minutes and only needs orgs with an active account.
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
 * Cron entry: refreshes the cached subaccount balance for every
 * organization with an active payment account (production only, same gate
 * as the other crons). Runs every 5 minutes.
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
      // Isolate failures per organization: one invalid/restricted pix key
      // must NOT abort the refresh of every other org (found in code review
      // 2026-08-10 — a throw here left all caches stale for 5+ min).
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
 * Marks a withdrawal as failed when the provider reports
 * `OPENPIX:MOVEMENT_FAILED` (webhook). Matches by the provider transaction
 * id captured at request time. Accepts `pending` (provider rejected the PIX
 * out) and `completed` (provider accepted, then the movement failed on the
 * SPI — the money returns to the subaccount); unknown ids are logged and
 * ignored (the webhook still answers 200).
 *
 * NOTE (code review 2026-08-10): this does NOT restore the cached balance —
 * on failure the debited amount is returned to the subaccount by the
 * provider, and the 5-min refresh cron reconciles the cache within minutes.
 * Accepted as-is (cheap + self-healing).
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
        // Fee sweep bookkeeping (BUG-0006): same rule as failWithdrawal —
        // a pending fee is no longer owed once the movement failed.
        ...(feeStatusAfterFailure(withdrawal.feeStatus)
          ? { feeStatus: feeStatusAfterFailure(withdrawal.feeStatus) }
          : {}),
        status: "failed",
        updatedAt: now,
      })
      .where(eq(withdrawals.id, withdrawal.id));
    return { matched: true };
  });

// ---------------------------------------------------------------------------
// Fee sweep (BUG-0006)
// ---------------------------------------------------------------------------

/**
 * Lists completed withdrawals whose fee debit is still pending (bounded —
 * the sweep retries oldest first). Pure data access for the sweep cron.
 */
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
    // Bounded (same pattern as listActivePaymentOrgs): a fee backlog beyond
    // this size would be an ops incident, not a cron payload.
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
 * Re-checks a single withdrawal's fee right before the sweep debits it
 * (review IBX-0006): a `MOVEMENT_FAILED` webhook may have flipped the row
 * to `failed` between `listUncollectedFees` and the debit — the sweep must
 * skip such stale items without error instead of debiting a fee for money
 * that returned to the subaccount.
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
 * Marks a withdrawal's fee as collected (called by the sweep after the
 * debit succeeded). Re-verifies the guard (`isFeeCollectionDue`: status
 * `completed` + feeStatus `pending`) BEFORE writing — a `MOVEMENT_FAILED`
 * that arrived between the debit and this flip leaves the row `failed`,
 * and overwriting it would both miscategorize the fee and wipe the
 * webhook's `failureReason` (review IBX-0006). Returns `ok: false`
 * without touching the row when the fee is no longer due.
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
 * Cron entry: retries the fee debit (subaccount → BR-Open main account)
 * for completed withdrawals whose fee is still pending (BUG-0006 — a
 * transient debit failure used to mean lost revenue). Idempotency: the
 * row's feeStatus flips to "collected" only AFTER the debit returns ok,
 * and each run only picks rows still marked "pending" — a crash between
 * debit and flip re-locks the row for the next run (at-least-once, same
 * exposure class as the existing inline debit). Race guards (review
 * IBX-0006): the row is re-verified as due right before the debit
 * (isWithdrawFeeStillDue — a MOVEMENT_FAILED between the list snapshot and
 * the debit is skipped, not charged) and again before the collected flip
 * (markWithdrawFeeCollected — a row that failed mid-flight keeps its
 * webhook failureReason).
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
      // Isolate failures per row (same pattern as refreshSubaccountBalances).
      try {
        // Re-query right before the debit (review IBX-0006): skip items
        // whose withdrawal failed after listUncollectedFees snapshot —
        // debiting them would charge a fee for money that came back.
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
