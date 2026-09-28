import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { MatchConfig } from "../../domains/match/contract";
import {
  CancelTournamentMatchesSchema,
  EditMatchResultSchema,
  MAX_TOURNAMENT_CATEGORIES,
  PublishMatchResultSchema,
  ScheduleTournamentMatchSchema,
  TournamentByIdSchema,
  tournamentMatchOccupiedSlotSchema,
  tournamentMatchSchema,
} from "../../domains/tournament/contract";
import { resolveResultEditReverb } from "../../domains/tournament/score-rules";
import { resolveMatchOccupiedEndMinute } from "../../domains/match/scheduling";
import { isTournamentClosed } from "../../domains/tournament/management-rules";
import {
  isScheduledTournamentMatch,
  resolveBulkCancelPlan,
} from "../../domains/tournament/scheduling-rules";
import {
  tournamentMatch,
  tournamentMatchEdit,
} from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import { getViewerContext } from "../viewer/context";
import {
  getManagedTournamentOrThrow,
  getTournamentRecordOrThrow,
  scheduleTournamentNotification,
} from "./_shared/guards";
import {
  applyMatchResult,
  applyMatchSchedule,
  applyMatchSuspension,
  entryRecipientUserIds,
  getMatchOrThrow,
  listTournamentMatchRecords,
  resolveMatchContext,
  sweepMatchAgreements,
  resolveMatchResultWinner,
  serializeMatch,
  type MatchRecord,
} from "./_shared/match_writes";

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

    const updated = await applyMatchResult(ctx, {
      match,
      score: input.score,
      tournament: tournamentRecord,
      walkover: Boolean(input.walkover),
    });

    // A escrita do organizador é por cima do acerto: o que os jogadores
    // combinaram perde efeito e o atropelo fica no histórico.
    await sweepMatchAgreements(ctx, {
      actorSide: "organizer",
      kind: "overridden",
      matchId: match.id as Id<"tournamentMatch">,
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });

    return serializeMatch(updated);
  });

/**
 * Edita um resultado JÁ PUBLICADO com o mesmo payload do publish (placar ou
 * W.O.). Reverb na chave: trocar quem avança só entra se a partida seguinte
 * ainda não foi jogada, enquanto editar só o placar (mesmo vencedor) nunca mexe
 * na chave. Toda edição fica auditada em `tournamentMatchEdit` e notifica os
 * dois lados.
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

    // Encerrado ou cancelado congela a chave inteira (inclusive o campeao da
    // final): a revisao acontece antes de concluir, e o cancelado nao reabre.
    if (isTournamentClosed(tournamentRecord.status)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Torneio encerrado ou cancelado: os resultados não podem mais ser editados.",
      });
    }
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

    const matchConfig = tournamentRecord.matchConfig as MatchConfig;
    const newWinnerEntryId = resolveMatchResultWinner({
      entryAId: match.entryAId,
      entryBId: match.entryBId,
      matchConfig,
      score: input.score,
      walkover: Boolean(input.walkover),
    });

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
      // Sem aviso de "proximo jogo": a vaga ja tinha dono (o vencedor que a
      // edicao troca), logo a prontidao nao muda e nao ha lado novo entrando.
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

    await sweepMatchAgreements(ctx, {
      actorSide: "organizer",
      kind: "overridden",
      matchId: match.id as Id<"tournamentMatch">,
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });

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

    const updated = await applyMatchSchedule(ctx, {
      actor: "organizer",
      courtId: input.courtId,
      endMinute: input.endMinute,
      match,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
      tournament: tournamentRecord,
    });

    // Agendar por cima fecha só o acerto de HORÁRIO: o placar combinado depois do
    // jogo continua valendo.
    await sweepMatchAgreements(ctx, {
      actorSide: "organizer",
      channel: "schedule",
      kind: "overridden",
      matchId: match.id as Id<"tournamentMatch">,
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });

    return serializeMatch(updated);
  });

/**
 * Cancelamento em LOTE (chuva, luz, quadra): tira a agenda dos confrontos
 * escolhidos e devolve cada um ao "a definir", avisando os dois lados com o
 * motivo. Confronto com resultado publicado e vaga vazia são PULADOS (o
 * confronto nunca morre aqui); quem estava sem horário também não muda.
 */
export const cancelMatches = authMutation
  .input(CancelTournamentMatchesSchema)
  .output(
    z.object({
      cancelled: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const matches = await ctx.orm.query.tournamentMatch.findMany({
      limit: input.matchIds.length,
      where: { id: { in: input.matchIds as Id<"tournamentMatch">[] } },
    });
    if (matches.length !== new Set(input.matchIds).size) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Confronto não encontrado.",
      });
    }

    const [first] = matches;
    if (!first) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Confronto não encontrado.",
      });
    }
    const { tournament: tournamentRecord } = await resolveMatchContext(
      ctx,
      first
    );
    if (tournamentRecord.id !== input.tournamentId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Selecione confrontos do mesmo torneio.",
      });
    }
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
        message: "Cancelar jogos exige chave sorteada ou torneio em andamento.",
      });
    }

    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: MAX_TOURNAMENT_CATEGORIES,
      where: { tournamentId: tournamentRecord.id as Id<"tournament"> },
    });
    const categoryIds = new Set(categories.map((category) => category.id));
    if (matches.some((match) => !categoryIds.has(match.categoryId))) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Selecione confrontos do mesmo torneio.",
      });
    }

    const plan = resolveBulkCancelPlan(matches);
    for (const target of plan.cancels) {
      await applyMatchSuspension(ctx, {
        match: target,
        reason: input.reason,
        tournament: tournamentRecord,
      });
    }

    return { cancelled: plan.cancels.length, skipped: plan.skipped };
  });

export const listForTournament = authQuery
  .input(TournamentByIdSchema)
  .output(z.array(tournamentMatchSchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    // Same gate as listBracket: the drawn bracket is PRIVATE to the organizer
    // until the tournament starts — non-organizers only see ongoing/finished
    // matches.
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
    const matches = await listTournamentMatchRecords(
      ctx,
      record.id as Id<"tournament">
    );
    return matches.map(serializeMatch);
  });

/**
 * Occupied court slots for the schedule dialog: every scheduled match's
 * [start, start + defaultDurationMinutes) window, so the client can offer only
 * free times per court/day. Same gate as listForTournament: the drawn bracket is
 * private until the tournament starts.
 */
export const listOccupiedSlots = authQuery
  .input(TournamentByIdSchema)
  .output(z.array(tournamentMatchOccupiedSlotSchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
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

    const matchConfig = record.matchConfig as MatchConfig;
    const matches = await listTournamentMatchRecords(
      ctx,
      record.id as Id<"tournament">
    );
    // Tolerate ABSENT keys here: Convex omits unset keys, and a `!== null`
    // filter passes them through as undefined/NaN into the output payload.
    const scheduled = matches.filter(
      (
        row
      ): row is MatchRecord & {
        courtId: string;
        endMinute: number | null;
        matchDate: string;
        startMinute: number;
      } => isScheduledTournamentMatch(row)
    );

    return scheduled.map((row) => ({
      courtId: row.courtId,
      endMinute:
        row.endMinute ??
        resolveMatchOccupiedEndMinute({
          matchConfig,
          startMinute: row.startMinute,
        }),
      matchDate: row.matchDate,
      matchId: row.id,
      startMinute: row.startMinute,
    }));
  });
