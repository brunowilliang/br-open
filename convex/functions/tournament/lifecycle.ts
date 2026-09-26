import { eq, unsetToken } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../generated/server";
import {
  TournamentByIdSchema,
  tournamentSchema,
} from "../../domains/tournament/contract";
import {
  resolveTournamentConclusionError,
  type TournamentConclusionCategory,
} from "../../domains/tournament/conclusion-rules";
import { tournament, tournamentEntry } from "../../domains/tournament/tables";
import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "../../domains/payment/contract";
import {
  RECOVERY_STATUS_PENDING,
  canRequestRefund,
  isRefundOutstanding,
  refundedChargeFields,
  resolveRefundOutcome,
} from "../../domains/payment/rules";
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
  serializeTournament,
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
      const entryIds = entries.map((entry) => entry.id as string);
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

      // O torneio cancelado nao pode deixar PIX vivo: toda cobranca PENDING das
      // inscricoes morre junto (a PAID segue no estorno logo abaixo).
      if (entryIds.length > 0) {
        await ctx.runMutation(
          internal.payment.charge.cancelPendingChargesForSource,
          {
            sourceIds: entryIds,
            sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
          }
        );
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
      if (canRequestRefund(charge)) {
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
 * `conclude` — o ATO do organizador que encerra o torneio: exige o torneio em
 * andamento com a final de TODA categoria sorteada ja decidida e vira o status em
 * `finished`. Como nenhum placar encerra sozinho, este e o unico caminho.
 */
export const conclude = authMutation
  .input(TournamentByIdSchema)
  .output(tournamentSchema)
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });

    const brackets: TournamentConclusionCategory[] = [];
    for (const category of categories) {
      const matches = await ctx.orm.query.tournamentMatch.findMany({
        limit: 300,
        where: { categoryId: category.id as Id<"tournamentCategory"> },
      });
      brackets.push({ matches });
    }

    const conclusionError = resolveTournamentConclusionError({
      categories: brackets,
      status: record.status,
    });
    if (conclusionError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: conclusionError });
    }

    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournament)
      .set({ status: "finished", updatedAt: now })
      .where(eq(tournament.id, record.id as Id<"tournament">))
      .returning();

    // O aviso aos jogadores pertence ao ATO de encerrar: o ultimo placar nao fecha o torneio.
    const recipients = new Set<Id<"user">>();
    for (const category of categories) {
      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: {
          categoryId: category.id as Id<"tournamentCategory">,
          status: "active",
        },
      });
      for (const entry of entries) {
        if (entry.createdByUserId) {
          recipients.add(entry.createdByUserId as Id<"user">);
        }
        if (entry.partnerUserId) {
          recipients.add(entry.partnerUserId as Id<"user">);
        }
      }
    }
    if (recipients.size > 0) {
      await scheduleTournamentNotification(ctx, {
        eventType: "tournament.finished",
        recipientUserIds: [...recipients],
        tournamentId: record.id as Id<"tournament">,
      });
    }

    return serializeTournament(ctx, updated);
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
            outcome: resolveRefundOutcome(result.status),
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
      .filter((charge) => isRefundOutstanding(charge))
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
    if (input.outcome !== "refunded") {
      await ctx.orm
        .update(paymentCharge)
        .set({
          refundStatus: input.outcome === "failed" ? "failed" : "pending",
          updatedAt: now,
        })
        .where(eq(paymentCharge.id, input.chargeId as Id<"paymentCharge">));
      return;
    }

    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });
    if (!charge) {
      return;
    }
    const fields = refundedChargeFields(charge);
    await ctx.orm
      .update(paymentCharge)
      .set({ ...fields, updatedAt: now })
      .where(eq(paymentCharge.id, charge.id));
    // O estorno saiu da conta maior: a parte do organizador na subconta volta
    // pelo debito (kick imediato; o sweep de 15 min cobre a retentativa).
    if (fields.refundRecoveryStatus === RECOVERY_STATUS_PENDING) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment.recovery.collectRefundRecovery,
        { chargeId: charge.id as string }
      );
    }
  });

/**
 * Estorno pontual de UMA cobranca: dinheiro que entrou numa cobranca sem o que
 * ativar (inscricao cancelada depois do PIX, expirada, categoria cheia).
 * `applyPaidCharge` ja marcou PAID + refundStatus pending; aqui se chama o
 * provedor e se grava o desfecho. O sweep de 15 min cobre a retentativa.
 */
export const refundLatePaymentForCharge = privateAction
  .input(z.object({ chargeId: z.string().min(1) }))
  .action(async ({ ctx, input }) => {
    const charge = await ctx.runQuery(
      internal.tournament.lifecycle.findRefundableCharge,
      { chargeId: input.chargeId }
    );
    if (!charge) {
      return { outcome: "skipped" as const };
    }

    try {
      const result = await ctx.runAction(
        internal.payment.providerNode.refundChargeAction,
        {
          chargeCorrelationId: charge.correlationId,
          valueCents: charge.amountCents,
        }
      );
      const outcome = resolveRefundOutcome(result.status);
      await ctx.runMutation(internal.tournament.lifecycle.applyRefundOutcome, {
        chargeId: charge.chargeId,
        outcome,
      });
      return { outcome };
    } catch {
      await ctx.runMutation(internal.tournament.lifecycle.applyRefundOutcome, {
        chargeId: charge.chargeId,
        outcome: "failed" as const,
      });
      return { outcome: "failed" as const };
    }
  });

/** Cobranca PAID com estorno ainda por fazer (pedido em voo ou recusado). */
export const findRefundableCharge = privateQuery
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(
    z
      .object({
        amountCents: z.number().int(),
        chargeId: z.string(),
        correlationId: z.string(),
      })
      .nullable()
  )
  .query(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });

    if (!charge) {
      return null;
    }

    // So uma cobranca PAID com estorno EM ABERTO entra: `null` nunca pediu
    // estorno e "refunded" ja foi.
    if (charge.status !== "PAID" || !isRefundOutstanding(charge)) {
      return null;
    }

    return {
      amountCents: charge.amountCents,
      chargeId: charge.id as string,
      correlationId: charge.correlationId,
    };
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
