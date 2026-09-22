import { eq, unsetToken } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../generated/server";
import { TournamentByIdSchema } from "../../domains/tournament/contract";
import { tournament, tournamentEntry } from "../../domains/tournament/tables";
import { paymentCharge } from "../../domains/payment/tables";
import {
  authMutation,
  privateAction,
  privateMutation,
  privateQuery,
} from "../../lib/crpc";
import { getEnv } from "../../lib/get-env";
import {
  getManagedTournamentOrThrow,
  scheduleTournamentNotification,
  type OrmCtx,
} from "./_shared/guards";

type ChargeRecord = InferSelectModel<typeof paymentCharge>;

async function listPaidEntryChargesForTournament(
  ctx: OrmCtx | QueryCtx,
  tournamentId: Id<"tournament">
): Promise<ChargeRecord[]> {
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: 10,
    where: { tournamentId },
  });
  const entryIds: string[] = [];
  for (const category of categories) {
    const entries = await ctx.orm.query.tournamentEntry.findMany({
      limit: 300,
      where: { categoryId: category.id as Id<"tournamentCategory"> },
    });
    entryIds.push(...entries.map((entry) => entry.id as string));
  }
  if (entryIds.length === 0) {
    return [];
  }
  const charges = await ctx.orm.query.paymentCharge.findMany({
    limit: 500,
    where: {
      sourceId: { in: entryIds },
      sourceType: "tournament_entry",
      status: "PAID",
    },
  });
  return charges as ChargeRecord[];
}

export const cancel = authMutation
  .input(TournamentByIdSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (
      record.status !== "published" &&
      record.status !== "drawn" &&
      record.status !== "ongoing"
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse torneio não pode ser cancelado.",
      });
    }

    const now = new Date();
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });

    // Cancel every non-final entry + collect recipients for the notice.
    const recipients = new Set<Id<"user">>();
    for (const category of categories) {
      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: { categoryId: category.id as Id<"tournamentCategory"> },
      });
      for (const entry of entries) {
        // Only ACTIVE entrants get the cancellation notice; pending, rejected
        // and cancelled entries were never in the tournament.
        if (entry.status === "active") {
          if (entry.createdByUserId) {
            recipients.add(entry.createdByUserId as Id<"user">);
          }
          if (entry.partnerUserId) {
            recipients.add(entry.partnerUserId as Id<"user">);
          }
        }
        if (entry.status !== "cancelled" && entry.status !== "rejected") {
          // Tournament cancelled = every entry goes terminal: free the slots.
          await ctx.orm
            .update(tournamentEntry)
            .set({
              activeAId: unsetToken,
              activeBId: unsetToken,
              status: "cancelled",
              updatedAt: now,
            })
            .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">));
        }
      }
    }

    await ctx.orm
      .update(tournament)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(tournament.id, record.id as Id<"tournament">));

    if (recipients.size > 0) {
      await scheduleTournamentNotification(ctx, {
        eventType: "tournament.cancelled",
        recipientUserIds: [...recipients],
        tournamentId: record.id as Id<"tournament">,
      });
    }

    // Mark paid charges refund-pending, then hand off to the refund action
    // (provider call — external side effect never runs inside a mutation).
    const charges = await listPaidEntryChargesForTournament(
      ctx,
      record.id as Id<"tournament">
    );
    for (const charge of charges) {
      if (charge.refundStatus === null || charge.refundStatus === "failed") {
        await ctx.orm
          .update(paymentCharge)
          .set({ refundStatus: "pending", updatedAt: now })
          .where(eq(paymentCharge.id, charge.id as Id<"paymentCharge">));
      }
    }
    if (charges.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.tournament.lifecycle.processRefunds,
        {
          tournamentId: record.id as string,
        }
      );
    }

    return { success: true };
  });

/**
 * Refund sweep body: for every PAID tournament-entry charge in
 * refundStatus "pending"/"failed", calls the provider refund (idempotent
 * `refund-<correlationId>` key) and records the outcome. Runs as an action
 * (provider call) — invoked by `cancel` and by the cron sweep.
 */
export const processRefunds = privateAction
  .input(z.object({ tournamentId: z.string().min(1) }))
  .action(async ({ ctx, input }) => {
    const charges = await ctx.runQuery(
      internal.tournament.lifecycle.listRefundableCharges,
      { tournamentId: input.tournamentId }
    );

    for (const charge of charges) {
      try {
        const result = await ctx.runAction(
          internal.payment.providerNode.refundChargeAction,
          {
            chargeCorrelationId: charge.correlationId,
            valueCents: charge.amountCents,
          }
        );
        // Only a provider CONFIRMED flips the charge to refunded. IN_PROCESSING
        // stays `pending` (the sweep keeps checking); a late REJECTED flips to
        // failed and the sweep retries.
        await ctx.runMutation(
          internal.tournament.lifecycle.applyRefundOutcome,
          {
            chargeId: charge.chargeId,
            outcome:
              result.status === "CONFIRMED"
                ? "refunded"
                : result.status === "REJECTED"
                  ? "failed"
                  : "pending",
          }
        );
      } catch {
        await ctx.runMutation(
          internal.tournament.lifecycle.applyRefundOutcome,
          { chargeId: charge.chargeId, outcome: "failed" }
        );
      }
    }
    return { processed: charges.length };
  });

export const listRefundableCharges = privateQuery
  .input(z.object({ tournamentId: z.string().min(1) }))
  .output(
    z.array(
      z.object({
        amountCents: z.number().int(),
        chargeId: z.string(),
        correlationId: z.string(),
      })
    )
  )
  .query(async ({ ctx, input }) => {
    const charges = await listPaidEntryChargesForTournament(
      ctx as unknown as OrmCtx,
      input.tournamentId as Id<"tournament">
    );
    return charges
      .filter(
        (charge) =>
          charge.refundStatus === "pending" || charge.refundStatus === "failed"
      )
      .map((charge) => ({
        amountCents: charge.amountCents,
        chargeId: charge.id as string,
        correlationId: charge.correlationId,
      }));
  });

export const applyRefundOutcome = privateMutation
  .input(
    z.object({
      chargeId: z.string().min(1),
      outcome: z.enum(["pending", "refunded", "failed"]),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set(
        input.outcome === "refunded"
          ? { refundStatus: "refunded", status: "REFUNDED", updatedAt: now }
          : input.outcome === "failed"
            ? { refundStatus: "failed", updatedAt: now }
            : { refundStatus: "pending", updatedAt: now }
      )
      .where(eq(paymentCharge.id, input.chargeId as Id<"paymentCharge">));
  });

/**
 * Cron entry (15 min): retries failed/pending tournament refunds across all
 * tournaments, mirroring the withdraw-fee sweep.
 */
export const sweepPendingRefunds = privateMutation.mutation(async ({ ctx }) => {
  if (getEnv().DEPLOY_ENV !== "production") {
    return { processed: 0 };
  }

  const chargeLists = await Promise.all([
    ctx.orm.query.paymentCharge.findMany({
      limit: 100,
      where: {
        refundStatus: "pending",
        sourceType: "tournament_entry",
        status: "PAID",
      },
    }),
    ctx.orm.query.paymentCharge.findMany({
      limit: 100,
      where: {
        refundStatus: "failed",
        sourceType: "tournament_entry",
        status: "PAID",
      },
    }),
  ]);

  const byTournament = new Set<string>();
  for (const charge of chargeLists.flat()) {
    const entry = await ctx.orm.query.tournamentEntry.findFirst({
      where: { id: charge.sourceId as Id<"tournamentEntry"> },
    });
    if (!entry) {
      continue;
    }
    const category = await ctx.orm.query.tournamentCategory.findFirst({
      where: { id: entry.categoryId as Id<"tournamentCategory"> },
    });
    if (category) {
      byTournament.add(category.tournamentId as string);
    }
  }
  let processed = 0;
  for (const tournamentId of byTournament) {
    // Fire-and-forget: the processRefunds action records outcomes on each
    // charge; the next sweep re-checks anything still pending/failed.
    await ctx.scheduler.runAfter(
      0,
      internal.tournament.lifecycle.processRefunds,
      { tournamentId }
    );
    processed += 1;
  }
  return { processed };
});
