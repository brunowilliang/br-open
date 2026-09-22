import { eq } from "kitcn/orm";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import {
  canPlaceEntries,
  listOpenFirstRoundSides,
  planBracketBirth,
  planBracketGrowth,
  planEntryFit,
  planEntryRemoval,
  type PlacementInsert,
  type PlacementPersistUpdate,
} from "../../domains/tournament/placement-rules";
import { tournamentMatch } from "../../domains/tournament/tables";
import type { MutationCtx } from "../generated/server";
import { privateMutation } from "../../lib/crpc";
import {
  getCategoryRecordOrThrow,
  getTournamentManagerUserIds,
  scheduleTournamentNotification,
  type OrmCtx,
} from "./_shared/guards";
import { shuffle, toSwapBoard } from "./_shared/board";

/** Random open side for the fit. */
function pickRandomSide<
  Side extends { round: number; side: "a" | "b"; slotInRound: number },
>(sides: Side[]): Side {
  return sides[Math.floor(Math.random() * sides.length)] as Side;
}

/**
 * Persists a fit/removal row rewrite. The rewritten pair loses its booking (no
 * card stays scheduled with the old pair) and bumps its row version for the
 * clients watching the bracket.
 */
async function applyPlacementUpdate(
  ctx: MutationCtx,
  update: PlacementPersistUpdate,
  current: { rowVersion: number }
) {
  const now = new Date();
  await ctx.orm
    .update(tournamentMatch)
    .set({
      courtId: null,
      endMinute: null,
      entryAId: update.entryAId as Id<"tournamentEntry"> | null,
      entryBId: update.entryBId as Id<"tournamentEntry"> | null,
      matchDate: null,
      rowVersion: update.bumpRowVersion
        ? current.rowVersion + 1
        : current.rowVersion,
      scheduledById: null,
      startMinute: null,
      status: update.status,
      updatedAt: now,
      walkover: update.walkover,
      winnerEntryId: update.winnerEntryId as Id<"tournamentEntry"> | null,
    })
    .where(eq(tournamentMatch.id, update.id as never));
}

/** Birth rows carry no booking and start fresh (draw inserts, same shape). */
async function insertPlacementRow(
  ctx: MutationCtx,
  categoryId: Id<"tournamentCategory">,
  insert: PlacementInsert
) {
  const now = new Date();
  await ctx.orm.insert(tournamentMatch).values({
    categoryId,
    createdAt: now,
    entryAId: insert.entryAId as Id<"tournamentEntry"> | null,
    entryBId: insert.entryBId as Id<"tournamentEntry"> | null,
    round: insert.round,
    rowVersion: 0,
    slotInRound: insert.slotInRound,
    status: insert.status,
    updatedAt: now,
    walkover: insert.walkover,
    winnerEntryId: insert.winnerEntryId as Id<"tournamentEntry"> | null,
  });
}

/**
 * The incremental placement core, called on EVERY transition into `active`
 * (free+auto create, manual approve, partner acceptance, paid confirmation).
 * Before the tournament starts it joins the entry into its category bracket:
 * birth with the 2nd confirmed entry, a random open slot afterwards, one new
 * bottom round when full. Idempotent by board membership.
 */
export const placeActiveEntry = privateMutation
  .input(
    z.object({ categoryId: z.string().min(1), entryId: z.string().min(1) })
  )
  .output(z.object({ placed: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const ormCtx = ctx as unknown as OrmCtx;
    const entry = await ctx.orm.query.tournamentEntry.findFirst({
      where: { id: input.entryId as Id<"tournamentEntry"> },
    });
    if (
      entry?.status !== "active" ||
      entry.categoryId !== (input.categoryId as Id<"tournamentCategory">)
    ) {
      return { placed: false };
    }
    const categoryId = input.categoryId as Id<"tournamentCategory">;
    const category = await getCategoryRecordOrThrow(ormCtx, categoryId);
    const tournamentRecord = await ctx.orm.query.tournament.findFirst({
      where: { id: category.tournamentId as Id<"tournament"> },
    });
    if (!(tournamentRecord && canPlaceEntries(tournamentRecord.status))) {
      return { placed: false };
    }

    const matches = await ctx.orm.query.tournamentMatch.findMany({
      limit: 300,
      where: { categoryId },
    });
    const board = toSwapBoard(matches);

    // Birth: the category's 2nd confirmed entry draws the first bracket
    // (same core as the manual draw, per category).
    if (board.length === 0) {
      const activeEntries = await ctx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: { categoryId, status: "active" },
      });
      if (activeEntries.length < 2) {
        return { placed: false };
      }
      const shuffled = shuffle(activeEntries);
      const { error, inserts } = planBracketBirth(
        shuffled.map((row) => ({
          entryId: row.id as string,
          entryRound: row.entryRound ?? null,
          seedRank: row.seedRank ?? null,
        }))
      );
      if (error) {
        return { placed: false };
      }
      for (const insert of inserts) {
        await insertPlacementRow(ctx, categoryId, insert);
      }
      return { placed: true };
    }

    // Fit: any open first-round side takes the entry (random slot).
    if (listOpenFirstRoundSides(board).length > 0) {
      const { error, updates } = planEntryFit({
        board,
        entryId: input.entryId,
        pickSide: pickRandomSide,
      });
      if (error) {
        // A silent refusal would strand an ACTIVE entry outside the bracket, so
        // the organizers learn NOW (same manager-notice pattern as a pending
        // approval; never re-notifies — one fit attempt per ACTIVE transition).
        const managerIds = await getTournamentManagerUserIds(
          ormCtx,
          tournamentRecord.organizationId as Id<"organization">
        );
        await scheduleTournamentNotification(ctx, {
          actorUserId: entry.createdByUserId,
          eventType: "tournament.bracket.placement_failed",
          recipientUserIds: managerIds,
          sourceEntityId: input.entryId,
          sourceEntityType: "tournamentEntry",
          tournamentId: tournamentRecord.id as Id<"tournament">,
        });
        return { placed: false };
      }
      if (updates.length === 0) {
        return { placed: true };
      }
      for (const update of updates) {
        const current = matches.find((match) => match.id === update.id);
        await applyPlacementUpdate(ctx, update, {
          rowVersion: current?.rowVersion ?? 0,
        });
      }
      return { placed: true };
    }

    // Growth: full bracket — one new bottom round, pairs preserved.
    const { error, inserts, updates } = planBracketGrowth({ board });
    if (error) {
      return { placed: false };
    }
    // Top-down rewrite keeps the (categoryId, round, slotInRound) unique
    // index satisfiable while old coordinates are vacated.
    const orderedUpdates = [...updates].sort(
      (a, b) => b.round - a.round || a.slotInRound - b.slotInRound
    );
    for (const update of orderedUpdates) {
      const current = matches.find((match) => match.id === update.id);
      await ctx.orm
        .update(tournamentMatch)
        .set({
          round: update.round,
          rowVersion: update.bumpRowVersion
            ? (current?.rowVersion ?? 0) + 1
            : (current?.rowVersion ?? 0),
          slotInRound: update.slotInRound,
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatch.id, update.id as never));
    }
    for (const insert of inserts) {
      await insertPlacementRow(ctx, categoryId, insert);
    }
    return { placed: true };
  });

/**
 * The inverse move: a cancelled entry leaves the bracket and its slot stays
 * EMPTY ("A definir", no automatic bye re-derivation). Runs while the tournament
 * has not started; idempotent by board membership.
 */
export const removeCancelledEntry = privateMutation
  .input(
    z.object({ categoryId: z.string().min(1), entryId: z.string().min(1) })
  )
  .output(z.object({ removed: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const ormCtx = ctx as unknown as OrmCtx;
    const categoryId = input.categoryId as Id<"tournamentCategory">;
    const category = await getCategoryRecordOrThrow(ormCtx, categoryId);
    const tournamentRecord = await ctx.orm.query.tournament.findFirst({
      where: { id: category.tournamentId as Id<"tournament"> },
    });
    if (!(tournamentRecord && canPlaceEntries(tournamentRecord.status))) {
      return { removed: false };
    }

    const matches = await ctx.orm.query.tournamentMatch.findMany({
      limit: 300,
      where: { categoryId },
    });
    const board = toSwapBoard(matches);
    const { updates } = planEntryRemoval({
      board,
      entryId: input.entryId,
    });
    if (updates.length === 0) {
      return { removed: false };
    }
    for (const update of updates) {
      const current = matches.find((match) => match.id === update.id);
      await applyPlacementUpdate(ctx, update, {
        rowVersion: current?.rowVersion ?? 0,
      });
    }
    return { removed: true };
  });
