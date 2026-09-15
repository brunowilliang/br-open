import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../_generated/dataModel";
import type { LeagueMatchConfig } from "../../domains/league/contract";
import {
  EditMatchResultSchema,
  PublishMatchResultSchema,
  ScheduleTournamentMatchSchema,
  TournamentByIdSchema,
  tournamentMatchSchema,
} from "../../domains/tournament/contract";
import {
  resolveResultEditReverb,
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "../../domains/tournament/score-rules";
import {
  tournament,
  tournamentMatch,
  tournamentMatchEdit,
} from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import { getViewerContext } from "../viewer/context";
import {
  getCategoryRecordOrThrow,
  getManagedTournamentOrThrow,
  getTournamentRecordOrThrow,
  scheduleTournamentNotification,
  type OrmCtx,
  type OrmMutationCtx,
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
    walkover: record.walkover,
    winnerEntryId: record.winnerEntryId ?? null,
  });
}

async function getMatchOrThrow(
  ctx: OrmCtx,
  matchId: Id<"tournamentMatch">
): Promise<MatchRecord> {
  const record = await ctx.orm.query.tournamentMatch.findFirst({
    where: { id: matchId },
  });
  if (!record) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Confronto não encontrado.",
    });
  }
  return record;
}

async function resolveMatchContext(ctx: OrmCtx, match: MatchRecord) {
  const category = await getCategoryRecordOrThrow(
    ctx,
    match.categoryId as Id<"tournamentCategory">
  );
  const tournamentRecord = await getTournamentRecordOrThrow(
    ctx,
    category.tournamentId as Id<"tournament">
  );
  return { category, tournament: tournamentRecord };
}

async function entryRecipientUserIds(
  ctx: OrmCtx,
  entryIds: (string | null)[]
): Promise<Id<"user">[]> {
  const recipients = new Set<Id<"user">>();
  for (const entryId of entryIds) {
    if (!entryId) {
      continue;
    }
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
  return [...recipients];
}

/** Every category final has a winner → tournament finished. */
async function maybeFinishTournament(
  ctx: OrmMutationCtx,
  tournamentId: Id<"tournament">
) {
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: 10,
    where: { tournamentId },
  });
  let finishedAll = categories.length > 0;
  const championRecipients = new Set<string>();

  for (const category of categories) {
    const matches = await ctx.orm.query.tournamentMatch.findMany({
      limit: 300,
      where: { categoryId: category.id as Id<"tournamentCategory"> },
    });
    // M2: a category left out of the draw (<2 entries → no bracket) counts
    // as completed — it must not block `finished` forever.
    if (matches.length === 0) {
      continue;
    }
    const maxRound = matches.reduce((max, m) => Math.max(max, m.round), 0);
    const finalMatch = matches.find(
      (m) => m.round === maxRound && m.slotInRound === 0
    );
    if (!finalMatch?.winnerEntryId) {
      finishedAll = false;
      continue;
    }
    // Collect active entrants of finished categories for the finish notice.
    const entries = await ctx.orm.query.tournamentEntry.findMany({
      limit: 300,
      where: {
        categoryId: category.id as Id<"tournamentCategory">,
        status: "active",
      },
    });
    for (const entry of entries) {
      if (entry.createdByUserId) {
        championRecipients.add(entry.createdByUserId as string);
      }
      if (entry.partnerUserId) {
        championRecipients.add(entry.partnerUserId as string);
      }
    }
  }

  if (!finishedAll) {
    return;
  }

  const now = new Date();
  await ctx.orm
    .update(tournament)
    .set({ status: "finished", updatedAt: now })
    .where(eq(tournament.id, tournamentId));
  if (championRecipients.size > 0) {
    await scheduleTournamentNotification(ctx, {
      eventType: "tournament.finished",
      recipientUserIds: [...championRecipients] as Id<"user">[],
      tournamentId,
    });
  }
}

export const publishResult = authMutation
  .input(PublishMatchResultSchema)
  .output(tournamentMatchSchema)
  .mutation(async ({ ctx, input }) => {
    const match = await getMatchOrThrow(
      ctx,
      input.matchId as Id<"tournamentMatch">
    );
    const { tournament: tournamentRecord } = await resolveMatchContext(
      ctx,
      match
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    if (tournamentRecord.status !== "ongoing") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Resultados só podem ser lançados com o torneio em andamento.",
      });
    }
    if (match.publishedAt) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse confronto já tem resultado publicado.",
      });
    }
    if (match.status === "vacant") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa vaga da chave está vazia e não tem resultado.",
      });
    }
    if (!(match.entryAId && match.entryBId)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse confronto ainda não tem os dois lados definidos.",
      });
    }
    const matchConfig = tournamentRecord.matchConfig as LeagueMatchConfig;
    let winnerEntryId: string;
    const isWalkover = Boolean(input.walkover);
    if (input.walkover) {
      // Walkover: winner declared by the organizer, no score validation —
      // but the winner must be one of the two sides (M4).
      const walkoverCheck = validateWalkoverWinner({
        entryAId: match.entryAId as string,
        entryBId: match.entryBId as string,
        winnerEntryId: input.score.winnerEntryId,
      });
      if (walkoverCheck.error || !walkoverCheck.winnerEntryId) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: walkoverCheck.error ?? "Resultado inválido.",
        });
      }
      winnerEntryId = walkoverCheck.winnerEntryId;
    } else {
      const validation = validateTournamentMatchScore({
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        matchConfig,
        score: input.score,
      });
      if (validation.error || !validation.winnerEntryId) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: validation.error ?? "Resultado inválido.",
        });
      }
      winnerEntryId = validation.winnerEntryId;
    }

    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournamentMatch)
      .set({
        publishedAt: now,
        rowVersion: match.rowVersion + 1,
        score: { sets: input.score.sets, winnerEntryId },
        status: "finished",
        updatedAt: now,
        walkover: isWalkover,
        winnerEntryId: winnerEntryId as Id<"tournamentEntry">,
      })
      .where(eq(tournamentMatch.id, match.id as never))
      .returning();

    // Advance the winner into the next round (only into unpublished slots).
    const next = await ctx.orm.query.tournamentMatch.findFirst({
      where: {
        categoryId: match.categoryId as Id<"tournamentCategory">,
        round: match.round + 1,
        slotInRound: Math.floor(match.slotInRound / 2),
      },
    });
    if (next && !next.publishedAt) {
      const side = match.slotInRound % 2 === 0 ? "entryAId" : "entryBId";
      await ctx.orm
        .update(tournamentMatch)
        .set({
          [side]: winnerEntryId as Id<"tournamentEntry">,
          rowVersion: next.rowVersion + 1,
          updatedAt: now,
        })
        .where(eq(tournamentMatch.id, next.id as never));
    }

    const recipients = await entryRecipientUserIds(ctx, [
      match.entryAId,
      match.entryBId,
    ]);
    if (recipients.length > 0) {
      await scheduleTournamentNotification(ctx, {
        eventType: "tournament.match.result",
        metadata: { matchId: match.id },
        recipientUserIds: recipients,
        sourceEntityId: match.id as string,
        sourceEntityType: "tournamentMatch",
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
    }

    await maybeFinishTournament(ctx, tournamentRecord.id as Id<"tournament">);

    return serializeMatch(updated);
  });

/**
 * IBX-0028: edita um resultado JÁ PUBLICADO. Mesmo payload do publish
 * (placar ou W.O.), com reverb na chave: trocar quem avança só entra em
 * produção se a partida seguinte ainda não foi jogada; editar só o placar
 * (mesmo vencedor) nunca mexe na chave. Toda edição fica auditada em
 * `tournamentMatchEdit` (antes/depois) e notifica os dois lados.
 */
export const editResult = authMutation
  .input(EditMatchResultSchema)
  .output(tournamentMatchSchema)
  .mutation(async ({ ctx, input }) => {
    const match = await getMatchOrThrow(
      ctx,
      input.matchId as Id<"tournamentMatch">
    );
    const { tournament: tournamentRecord } = await resolveMatchContext(
      ctx,
      match
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );

    if (!match.publishedAt) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Esse confronto não tem resultado publicado. Use o lançamento de resultado.",
      });
    }
    if (!(match.entryAId && match.entryBId)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse confronto não tem os dois lados definidos.",
      });
    }

    const matchConfig = tournamentRecord.matchConfig as LeagueMatchConfig;
    let newWinnerEntryId: string;
    if (input.walkover) {
      const walkoverCheck = validateWalkoverWinner({
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        winnerEntryId: input.score.winnerEntryId,
      });
      if (walkoverCheck.error || !walkoverCheck.winnerEntryId) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: walkoverCheck.error ?? "Resultado inválido.",
        });
      }
      newWinnerEntryId = walkoverCheck.winnerEntryId;
    } else {
      const validation = validateTournamentMatchScore({
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        matchConfig,
        score: input.score,
      });
      if (validation.error || !validation.winnerEntryId) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: validation.error ?? "Resultado inválido.",
        });
      }
      newWinnerEntryId = validation.winnerEntryId;
    }

    const next = await ctx.orm.query.tournamentMatch.findFirst({
      where: {
        categoryId: match.categoryId as Id<"tournamentCategory">,
        round: match.round + 1,
        slotInRound: Math.floor(match.slotInRound / 2),
      },
    });
    const reverb = resolveResultEditReverb({
      newWinnerEntryId,
      nextMatchExists: Boolean(next),
      nextMatchPublished: Boolean(next?.publishedAt),
      oldWinnerEntryId: match.winnerEntryId ?? "",
    });

    if (reverb.action === "conflict") {
      throw new CRPCError({ code: "CONFLICT", message: reverb.error });
    }

    // Chave fechada: trocar quem avança corromperia o campeão — só edição de
    // placar com o mesmo vencedor passa.
    if (tournamentRecord.status === "finished" && reverb.action === "swap") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Torneio encerrado — não é possível trocar quem avança nessa partida.",
      });
    }

    const now = new Date();
    const before = {
      score: match.score,
      status: match.status,
      walkover: match.walkover,
      winnerEntryId: match.winnerEntryId,
    };

    const [updated] = await ctx.orm
      .update(tournamentMatch)
      .set({
        rowVersion: match.rowVersion + 1,
        score: { sets: input.score.sets, winnerEntryId: newWinnerEntryId },
        updatedAt: now,
        walkover: Boolean(input.walkover),
        winnerEntryId: newWinnerEntryId as Id<"tournamentEntry">,
      })
      .where(eq(tournamentMatch.id, match.id as never))
      .returning();

    if (reverb.action === "swap" && next) {
      const side = match.slotInRound % 2 === 0 ? "entryAId" : "entryBId";
      await ctx.orm
        .update(tournamentMatch)
        .set({
          [side]: newWinnerEntryId as Id<"tournamentEntry">,
          rowVersion: next.rowVersion + 1,
          updatedAt: now,
        })
        .where(eq(tournamentMatch.id, next.id as never));
    }

    await ctx.orm.insert(tournamentMatchEdit).values({
      after: {
        score: updated.score,
        status: updated.status,
        walkover: updated.walkover,
        winnerEntryId: updated.winnerEntryId,
      },
      before,
      createdAt: now,
      editedByUserId: ctx.userId as Id<"user">,
      matchId: match.id as Id<"tournamentMatch">,
    });

    const recipients = await entryRecipientUserIds(ctx, [
      match.entryAId,
      match.entryBId,
    ]);
    if (recipients.length > 0) {
      await scheduleTournamentNotification(ctx, {
        eventType: "tournament.match.result_edited",
        metadata: { matchId: match.id },
        recipientUserIds: recipients,
        sourceEntityId: match.id as string,
        sourceEntityType: "tournamentMatch",
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
    }

    await maybeFinishTournament(ctx, tournamentRecord.id as Id<"tournament">);

    return serializeMatch(updated);
  });

export const scheduleMatch = authMutation
  .input(ScheduleTournamentMatchSchema)
  .output(tournamentMatchSchema)
  .mutation(async ({ ctx, input }) => {
    const match = await getMatchOrThrow(
      ctx,
      input.matchId as Id<"tournamentMatch">
    );
    const { tournament: tournamentRecord } = await resolveMatchContext(
      ctx,
      match
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    if (
      tournamentRecord.status !== "drawn" &&
      tournamentRecord.status !== "ongoing"
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Agendamento exige chave sorteada ou torneio em andamento.",
      });
    }
    if (match.publishedAt) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Confronto encerrado não pode ser reagendado.",
      });
    }
    if (match.status === "vacant") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa vaga da chave está vazia e não pode ser agendada.",
      });
    }
    if (input.startMinute >= input.endMinute) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "O horário de início deve ser antes do término.",
      });
    }
    const courts = tournamentRecord.courts ?? [];
    if (!courts.some((court: { id: string }) => court.id === input.courtId)) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Quadra inválida." });
    }

    const wasScheduled = match.matchDate !== null;
    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournamentMatch)
      .set({
        courtId: input.courtId,
        endMinute: input.endMinute,
        matchDate: input.matchDate,
        rowVersion: match.rowVersion + 1,
        scheduledById: ctx.userId as Id<"user">,
        startMinute: input.startMinute,
        // L3: a draw-time bye (walkover) stays a walkover — scheduling
        // data can be attached without rewriting the resolved outcome.
        status: match.status === "walkover" ? "walkover" : "scheduled",
        updatedAt: now,
      })
      .where(eq(tournamentMatch.id, match.id as never))
      .returning();

    const recipients = await entryRecipientUserIds(ctx, [
      match.entryAId,
      match.entryBId,
    ]);
    if (recipients.length > 0) {
      await scheduleTournamentNotification(ctx, {
        eventType: wasScheduled
          ? "tournament.match.rescheduled"
          : "tournament.match.scheduled",
        metadata: { matchId: match.id },
        recipientUserIds: recipients,
        sourceEntityId: match.id as string,
        sourceEntityType: "tournamentMatch",
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
    }

    return serializeMatch(updated);
  });

export const listForTournament = authQuery
  .input(TournamentByIdSchema)
  .output(z.array(tournamentMatchSchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    // M3: same gate as listBracket — the drawn bracket is PRIVATE to the
    // organizer until the tournament starts; non-organizers only see
    // ongoing/finished matches.
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const isOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === record.organizationId;
    if (
      !isOrganizer &&
      record.status !== "ongoing" &&
      record.status !== "finished"
    ) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "A chave ainda não está disponível.",
      });
    }
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    const matches: MatchRecord[] = [];
    for (const category of categories) {
      const rows = await ctx.orm.query.tournamentMatch.findMany({
        limit: 300,
        where: { categoryId: category.id as Id<"tournamentCategory"> },
      });
      matches.push(...rows);
    }
    return matches.map(serializeMatch);
  });
