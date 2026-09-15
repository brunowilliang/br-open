import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../_generated/dataModel";
import {
  SwapBracketSlotsSchema,
  TournamentByIdSchema,
  tournamentMatchSchema,
} from "../../domains/tournament/contract";
import {
  applySlotSwap,
  buildBracket,
  buildSwapPersistPlan,
  canDrawTournament,
  validateSlotSwap,
  validateSwapCategoryOwnership,
  type SwapCheckMatch,
  type SwapMatchStatus,
} from "../../domains/tournament/bracket-rules";
import { tournament, tournamentMatch } from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import {
  getCategoryRecordOrThrow,
  getManagedTournamentOrThrow,
  scheduleTournamentNotification,
  type OrmCtx,
} from "./_shared/guards";
type MatchRecord = InferSelectModel<typeof tournamentMatch>;

function serializeMatch(record: MatchRecord) {
  return tournamentMatchSchema.parse({
    categoryId: record.categoryId,
    courtId: record.courtId ?? null,
    createdAt: record.createdAt.getTime(),
    endMinute: record.endMinute ?? null,
    entryAId: record.entryAId ?? null,
    entryBId: record.entryBId ?? null,
    id: record.id,
    matchDate: record.matchDate ?? null,
    round: record.round,
    rowVersion: record.rowVersion,
    scheduledById: record.scheduledById ?? null,
    score: (record.score as never) ?? null,
    slotInRound: record.slotInRound,
    startMinute: record.startMinute ?? null,
    status: record.status,
    updatedAt: record.updatedAt.getTime(),
  });
}

function getCategories(ctx: OrmCtx, tournamentId: Id<"tournament">) {
  return ctx.orm.query.tournamentCategory.findMany({
    limit: 10,
    where: { tournamentId },
  });
}

function getActiveEntries(ctx: OrmCtx, categoryId: Id<"tournamentCategory">) {
  return ctx.orm.query.tournamentEntry.findMany({
    limit: 300,
    where: { categoryId, status: "active" },
  });
}

function getMatches(ctx: OrmCtx, categoryId: Id<"tournamentCategory">) {
  return ctx.orm.query.tournamentMatch.findMany({
    limit: 300,
    where: { categoryId },
  });
}

/** Fisher-Yates on a copy — the only randomness in the draw path. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const draw = authMutation
  .input(TournamentByIdSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (!canDrawTournament(record.status)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Sorteio só é possível em torneio publicado ou já sorteado (re-sorteio).",
      });
    }

    const now = new Date();
    const categories = await getCategories(ctx, record.id as Id<"tournament">);
    const drawnCategories: { categoryId: Id<"tournamentCategory"> }[] = [];

    for (const category of categories) {
      const entries = await getActiveEntries(
        ctx,
        category.id as Id<"tournamentCategory">
      );
      if (entries.length < 2) {
        continue; // category without a bracket (kept out of the draw)
      }

      const shuffled = shuffle(entries);
      const { bracket, error } = buildBracket(
        shuffled.map((entry) => ({
          entryId: entry.id as string,
          entryRound: entry.entryRound ?? null,
          seedRank: entry.seedRank ?? null,
        }))
      );
      if (error || !bracket) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: error ?? "Sorteio inválido.",
        });
      }

      await ctx.orm
        .delete(tournamentMatch)
        .where(eq(tournamentMatch.categoryId, category.id as never));

      for (const match of bracket.matches) {
        await ctx.orm.insert(tournamentMatch).values({
          categoryId: category.id as Id<"tournamentCategory">,
          createdAt: now,
          entryAId: match.entryAId as Id<"tournamentEntry"> | null,
          entryBId: match.entryBId as Id<"tournamentEntry"> | null,
          round: match.round,
          rowVersion: 0,
          slotInRound: match.slotInRound,
          status: match.isVacant
            ? "vacant"
            : match.isBye
              ? "walkover"
              : "pending",
          updatedAt: now,
          walkover: match.isBye,
          winnerEntryId: match.winnerEntryId as Id<"tournamentEntry"> | null,
        });
      }
      drawnCategories.push({
        categoryId: category.id as Id<"tournamentCategory">,
      });
    }

    if (drawnCategories.length === 0) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma categoria tem inscrições suficientes para sortear.",
      });
    }

    await ctx.orm
      .update(tournament)
      .set({ status: "drawn", updatedAt: now })
      .where(eq(tournament.id, record.id as never));

    return { success: true };
  });

export const swapSlots = authMutation
  .input(SwapBracketSlotsSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (record.status !== "drawn" && record.status !== "ongoing") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Ajuste de posição exige chave sorteada.",
      });
    }

    // Review C1: categoryId is client input — prove the category belongs to
    // the managed tournament before reading (or writing) any of its matches.
    const category = await getCategoryRecordOrThrow(
      ctx,
      input.categoryId as Id<"tournamentCategory">
    );
    const ownershipError = validateSwapCategoryOwnership({
      categoryTournamentId: category.tournamentId as string,
      tournamentId: record.id as string,
    });
    if (ownershipError) {
      throw new CRPCError({ code: "NOT_FOUND", message: ownershipError });
    }

    const round = input.round ?? 1;
    const matches = await getMatches(
      ctx,
      input.categoryId as Id<"tournamentCategory">
    );
    const roundMatches = matches
      .filter((match) => match.round === round)
      .sort((a, b) => a.slotInRound - b.slotInRound);

    const roundChecks: SwapCheckMatch[] = roundMatches.map((match) => ({
      entryAId: match.entryAId ?? null,
      entryBId: match.entryBId ?? null,
      hasPublishedResult:
        match.publishedAt !== null && match.publishedAt !== undefined,
      matchDate: match.matchDate,
      round: match.round,
      slotInRound: match.slotInRound,
      status: match.status as SwapMatchStatus,
      winnerEntryId: match.winnerEntryId ?? null,
    }));

    const swapError = validateSlotSwap(
      roundChecks,
      input.slotA,
      input.sideA,
      input.slotB,
      input.sideB
    );
    if (swapError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: swapError });
    }

    const patched = applySlotSwap(
      roundMatches.map((match) => ({
        entryAId: match.entryAId ?? null,
        entryBId: match.entryBId ?? null,
        isBye: match.walkover,
        isVacant: match.status === "vacant",
        round: match.round,
        slotInRound: match.slotInRound,
        winnerEntryId: match.winnerEntryId ?? null,
      })),
      input.slotA,
      input.sideA,
      input.slotB,
      input.sideB
    );

    const now = new Date();
    const affectedEntryIds = new Set<string>([
      ...(patched[input.slotA].entryAId
        ? [patched[input.slotA].entryAId as string]
        : []),
      ...(patched[input.slotA].entryBId
        ? [patched[input.slotA].entryBId as string]
        : []),
      ...(patched[input.slotB].entryAId
        ? [patched[input.slotB].entryAId as string]
        : []),
      ...(patched[input.slotB].entryBId
        ? [patched[input.slotB].entryBId as string]
        : []),
    ]);

    const persistPlan = buildSwapPersistPlan({
      isByeA: patched[input.slotA].isBye,
      isByeB: patched[input.slotB].isBye,
      roundMatches: roundChecks,
      slotA: input.slotA,
      slotB: input.slotB,
    });

    for (const { index, status, walkover } of persistPlan) {
      const match = patched[index];
      const original = roundMatches[index];
      await ctx.orm
        .update(tournamentMatch)
        .set({
          entryAId: match.entryAId as Id<"tournamentEntry"> | null,
          entryBId: match.entryBId as Id<"tournamentEntry"> | null,
          status,
          updatedAt: now,
          walkover,
          winnerEntryId: match.winnerEntryId as Id<"tournamentEntry"> | null,
        })
        .where(eq(tournamentMatch.id, original.id as never));
    }

    // Propagate this round's winners (incl. re-derived byes) into the next
    // round, only into matches without a published result (spec: result
    // locks the slot).
    for (const match of patched) {
      if (!match.winnerEntryId) {
        continue;
      }
      const next = matches.find(
        (candidate) =>
          candidate.round === match.round + 1 &&
          candidate.slotInRound === Math.floor(match.slotInRound / 2)
      );
      if (!next || next.publishedAt) {
        continue;
      }
      const side = match.slotInRound % 2 === 0 ? "entryAId" : "entryBId";
      await ctx.orm
        .update(tournamentMatch)
        .set({
          [side]: match.winnerEntryId,
          rowVersion: next.rowVersion + 1,
          updatedAt: now,
        })
        .where(eq(tournamentMatch.id, next.id as never));
    }

    if (affectedEntryIds.size > 0) {
      // L1: notify BOTH users of every affected entry (creator + partner),
      // same pattern as the other match notifications.
      const recipients = new Set<Id<"user">>();
      for (const entryId of affectedEntryIds) {
        const entry = await ctx.orm.query.tournamentEntry.findFirst({
          where: { id: entryId as Id<"tournamentEntry"> },
        });
        if (entry?.createdByUserId) {
          recipients.add(entry.createdByUserId as Id<"user">);
        }
        if (entry?.partnerUserId) {
          recipients.add(entry.partnerUserId as Id<"user">);
        }
      }
      if (recipients.size > 0) {
        await scheduleTournamentNotification(ctx, {
          eventType: "tournament.match.reassigned",
          metadata: { categoryId: input.categoryId },
          recipientUserIds: [...recipients],
          sourceEntityId: input.categoryId,
          sourceEntityType: "tournamentCategory",
          tournamentId: record.id as Id<"tournament">,
        });
      }
    }

    return { success: true };
  });

export const start = authMutation
  .input(TournamentByIdSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (record.status !== "drawn") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "A chave precisa ser sorteada antes de iniciar.",
      });
    }

    const now = new Date();
    await ctx.orm
      .update(tournament)
      .set({ status: "ongoing", updatedAt: now })
      .where(eq(tournament.id, record.id as never));

    // Notify every active entrant across all categories.
    const categories = await getCategories(ctx, record.id as Id<"tournament">);
    const recipients = new Set<Id<"user">>();
    for (const category of categories) {
      const entries = await getActiveEntries(
        ctx,
        category.id as Id<"tournamentCategory">
      );
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
        eventType: "tournament.bracket.published",
        recipientUserIds: [...recipients],
        tournamentId: record.id as Id<"tournament">,
      });
    }

    return { success: true };
  });

export const listBracket = authQuery
  .input(z.object({ tournamentId: z.string().min(1) }))
  .output(z.array(tournamentMatchSchema))
  .query(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const categories = await getCategories(ctx, record.id as Id<"tournament">);
    const matches: MatchRecord[] = [];
    for (const category of categories) {
      const rows = await getMatches(
        ctx,
        category.id as Id<"tournamentCategory">
      );
      matches.push(...rows);
    }
    return matches.map(serializeMatch);
  });
