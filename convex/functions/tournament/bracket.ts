import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import {
  SwapBracketSlotsSchema,
  TournamentByIdSchema,
  tournamentMatchSchema,
} from "../../domains/tournament/contract";
import {
  buildBracket,
  buildSwapPersistPlan,
  canDrawTournament,
  validateBracketStartable,
  validateSlotSwap,
  validateSwapCategoryOwnership,
} from "../../domains/tournament/bracket-rules";
import { tournament, tournamentMatch } from "../../domains/tournament/tables";
import { shouldAutoStartTournament } from "../../domains/tournament/scheduling-rules";
import { authMutation, authQuery, privateMutation } from "../../lib/crpc";
import { internal } from "../_generated/api";
import {
  getCategoryRecordOrThrow,
  getManagedTournamentOrThrow,
  getTournamentRecordOrThrow,
  scheduleTournamentNotification,
  type OrmCtx,
} from "./_shared/guards";
import {
  getCategoryMatches,
  shuffle,
  toSwapBoard,
  type MatchRecord,
} from "./_shared/board";

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

/**
 * IBX-0069: the draw CORE, shared by the manual action and the auto-start
 * cron (published with no draw on the start day draws itself — random is the
 * rule). No ownership check here: the auth wrapper proves the organizer
 * first; the cron is server-side trusted. Errors come back as data so the
 * cron can SKIP (nothing drawable) without blocking the other tournaments.
 */
export const performDraw = privateMutation
  .input(
    z.object({
      expectedStatus: z.enum(["drawn", "published"]).optional(),
      tournamentId: z.string().min(1),
    })
  )
  .output(
    z.union([
      z.object({ ok: z.literal(true) }),
      z.object({ error: z.string(), ok: z.literal(false) }),
    ])
  )
  .mutation(async ({ ctx, input }) => {
    // Private mutation: no auth identity — same bridge as performStart.
    const ormCtx = ctx as unknown as OrmCtx;
    const record = await getTournamentRecordOrThrow(
      ormCtx,
      input.tournamentId as Id<"tournament">
    );
    // L2 (IBX-0069 review): the cron pins `published` — if the organizer drew
    // manually in the same window (status already `drawn`), the re-draw
    // reception of `drawn` must NOT let the cron re-shuffle the fresh draw.
    if (input.expectedStatus && record.status !== input.expectedStatus) {
      return {
        error: "O status do torneio mudou antes do sorteio automático.",
        ok: false,
      };
    }
    if (!canDrawTournament(record.status)) {
      return {
        error:
          "Sorteio só é possível em torneio publicado ou já sorteado (re-sorteio).",
        ok: false,
      };
    }

    const now = new Date();
    const categories = await getCategories(
      ormCtx,
      record.id as Id<"tournament">
    );
    const drawnCategories: { categoryId: Id<"tournamentCategory"> }[] = [];

    for (const category of categories) {
      const entries = await getActiveEntries(
        ormCtx,
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
        return { error: error ?? "Sorteio inválido.", ok: false };
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
      return {
        error: "Nenhuma categoria tem inscrições suficientes para sortear.",
        ok: false,
      };
    }

    await ctx.orm
      .update(tournament)
      .set({ status: "drawn", updatedAt: now })
      .where(eq(tournament.id, record.id as never));

    return { ok: true };
  });

export const draw = authMutation
  .input(TournamentByIdSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const result = await ctx.runMutation(
      internal.tournament.bracket.performDraw,
      { tournamentId: input.tournamentId }
    );
    if (!result.ok) {
      throw new CRPCError({ code: "BAD_REQUEST", message: result.error });
    }
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
    // IBX-0068: the bracket is an editable preview only while `drawn` — once
    // the organizer starts the tournament it FREEZES (the same-round move in
    // `ongoing`, IBX-0053 16/09, is extinct). Results and scheduling remain.
    // LOW-2 (IBX-0068 review): in `draft`/`published` there is no bracket yet
    // — the refusal is the pre-draw one, not the frozen one (draft never
    // started, so "congelado" would lie).
    if (record.status === "draft" || record.status === "published") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Ajuste de posição exige chave sorteada.",
      });
    }
    if (record.status !== "drawn") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "O chaveamento foi congelado no início do torneio.",
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

    // IBX-0053: the board is the category's WHOLE bracket — a cross-round
    // move needs the feeding match of each side to tell a placement (movable)
    // from a win propagated from the match below (locked).
    const matches = await getCategoryMatches(
      ctx,
      input.categoryId as Id<"tournamentCategory">
    );
    const board = toSwapBoard(matches);
    const move = {
      board,
      from: {
        round: input.roundA,
        side: input.sideA,
        slotInRound: input.slotA,
      },
      to: { round: input.roundB, side: input.sideB, slotInRound: input.slotB },
    };

    const swapError = validateSlotSwap({
      board,
      from: move.from,
      status: record.status,
      to: move.to,
    });
    if (swapError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: swapError });
    }

    const now = new Date();
    const { affectedEntryIds, updates } = buildSwapPersistPlan(move);

    for (const update of updates) {
      const current = matches.find(
        (match) => (match.id as string) === update.id
      ) as MatchRecord;
      await ctx.orm
        .update(tournamentMatch)
        .set({
          // BUG-0028: the schedule dies with the pair. Every row the move
          // rewrote loses its booking (the two clicked matches and the feed
          // rows whose win changed), so no card stays "Agendado" with the old
          // pair's court/date/time; untouched matches keep theirs.
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

    if (affectedEntryIds.length > 0) {
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

/**
 * IBX-0069: the start CORE — the manual action and the auto-start cron share
 * ONE path (status → ongoing, public bracket, `tournament.bracket.published`
 * to every active entrant). No ownership check here: the auth wrapper proves
 * the organizer first; the cron is server-side trusted. Errors come back as
 * data so the cron can SKIP a tournament that is not startable (an "A
 * definir" hole needs the organizer) without blocking the others.
 */
export const performStart = privateMutation
  .input(z.object({ tournamentId: z.string().min(1) }))
  .output(
    z.union([
      z.object({ ok: z.literal(true) }),
      z.object({ error: z.string(), ok: z.literal(false) }),
    ])
  )
  .mutation(async ({ ctx, input }) => {
    // Private mutation: no auth identity. The shared guards take the auth
    // ORM shape — same bridge the other non-auth callers use (entries.ts).
    const ormCtx = ctx as unknown as OrmCtx;
    const record = await getTournamentRecordOrThrow(
      ormCtx,
      input.tournamentId as Id<"tournament">
    );
    if (record.status !== "drawn") {
      return {
        error: "A chave precisa ser sorteada antes de iniciar.",
        ok: false,
      };
    }

    const categories = await getCategories(
      ormCtx,
      record.id as Id<"tournament">
    );

    // IBX-0053: an "A definir" hole (an empty side whose feed can never fill
    // it) would go public as an unplayable match — publishResult needs two
    // sides. The move opens this state; starting with it is refused until the
    // organizer fixes the bracket.
    for (const category of categories) {
      const startError = validateBracketStartable(
        toSwapBoard(
          await getCategoryMatches(
            ormCtx,
            category.id as Id<"tournamentCategory">
          )
        )
      );
      if (startError) {
        return { error: startError, ok: false };
      }
    }

    const now = new Date();
    await ctx.orm
      .update(tournament)
      .set({ status: "ongoing", updatedAt: now })
      .where(eq(tournament.id, record.id as never));

    // Notify every active entrant across all categories.
    const recipients = new Set<Id<"user">>();
    for (const category of categories) {
      const entries = await getActiveEntries(
        ormCtx,
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
      await scheduleTournamentNotification(ctx as never, {
        eventType: "tournament.bracket.published",
        recipientUserIds: [...recipients],
        tournamentId: record.id as Id<"tournament">,
      });
    }

    // IBX-0067: unanswered partner invites never reach the bracket (only
    // ACTIVE entries place; the entry itself stays behind untouched when
    // the tournament starts). Each creator learns it NOW — both on the
    // manual start and on the auto-start cron (they share this core).
    // Birth-race note: two near-simultaneous activations on an empty board
    // are serialized by Convex OCC — the loser re-runs and sees the fresh
    // bracket, so no double draw happens.
    for (const category of categories) {
      const pending = await ormCtx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: {
          categoryId: category.id as Id<"tournamentCategory">,
          status: "pending_partner",
        },
      });
      for (const entry of pending) {
        if (!entry.createdByUserId) {
          continue;
        }
        await scheduleTournamentNotification(ctx as never, {
          eventType: "tournament.partner.awaiting_reply",
          recipientUserIds: [entry.createdByUserId as Id<"user">],
          sourceEntityId: entry.id as string,
          sourceEntityType: "tournamentEntry",
          tournamentId: record.id as Id<"tournament">,
        });
      }
    }

    return { ok: true };
  });

export const start = authMutation
  .input(TournamentByIdSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const result = await ctx.runMutation(
      internal.tournament.bracket.performStart,
      { tournamentId: input.tournamentId }
    );
    if (!result.ok) {
      throw new CRPCError({ code: "BAD_REQUEST", message: result.error });
    }
    return { success: true };
  });

/**
 * IBX-0069 cron body (hourly): every `published`/`drawn` tournament whose
 * start date has arrived on the Brazilian calendar starts itself. `drawn`
 * goes straight to the start core; `published` (round 2, user decision)
 * DRAWS ITSELF first through the same core as the manual draw — random vale
 * — and then starts. If NOTHING is drawable (no category with 2+ active
 * entries), the tournament stays `published` for the organizer. Idempotent
 * by status transition: the draw moves `published`→`drawn` and the start
 * moves `drawn`→`ongoing`, so a repeat run (or a manual action in the same
 * window) can never draw or start twice.
 */
export const autoStartTournaments = privateMutation
  .input(z.object({}))
  .output(z.object({ started: z.number() }))
  .mutation(async ({ ctx }) => {
    const eligible = await ctx.orm.query.tournament.findMany({
      limit: 100,
      where: { status: { in: ["published", "drawn"] } },
    });

    let started = 0;
    for (const record of eligible) {
      const shouldStart = shouldAutoStartTournament({
        nowMs: Date.now(),
        startDateMs: record.startDate.getTime(),
        status: record.status,
      });
      if (!shouldStart) {
        continue;
      }
      if (record.status === "published") {
        const drawResult = await ctx.runMutation(
          internal.tournament.bracket.performDraw,
          {
            expectedStatus: "published" as const,
            tournamentId: record.id as string,
          }
        );
        // Nothing drawable: stays `published`, organizer decides.
        if (!drawResult.ok) {
          continue;
        }
      }
      const result = await ctx.runMutation(
        internal.tournament.bracket.performStart,
        { tournamentId: record.id as string }
      );
      if (result.ok) {
        started += 1;
      }
    }
    return { started };
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
      const rows = await getCategoryMatches(
        ctx,
        category.id as Id<"tournamentCategory">
      );
      matches.push(...rows);
    }
    return matches.map(serializeMatch);
  });
