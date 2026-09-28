import { eq } from "kitcn/orm";
import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { MatchConfig } from "../../domains/match/contract";
import {
  buildAgreementChannelView,
  readEventProposal,
  readScheduleProposal,
  readScoreProposal,
  resolveAcceptanceTransition,
  resolveAgreementNoticeEntryId,
  resolveCancellationTransition,
  resolveDeclineTransition,
  resolveMatchSideAccess,
  resolveProposalTransition,
  resolveScheduleProposal,
  resolveScoreProposal,
  toAgreementStateFields,
  type MatchAgreementSnapshot,
  type MatchAgreementStateFields,
} from "../../domains/tournament/agreement-rules";
import { buildPlayerProfileDisplayName } from "../../domains/player/identity";
import { resolveCategoryTotalRounds } from "../../domains/tournament/bracket-rules";
import {
  MAX_TOURNAMENT_CATEGORIES,
  MatchAgreementActionSchema,
  PublishMatchResultSchema,
  type MatchAgreementActorSide,
  type MatchAgreementChannel,
  type MatchAgreementEventKind,
  type MatchAgreementSide,
  ProposeMatchScheduleSchema,
  TournamentByIdSchema,
  matchAgreementEventSchema,
  matchAgreementsSchema,
  playerMatchSchema,
} from "../../domains/tournament/contract";
import {
  tournamentMatchAgreement,
  tournamentMatchAgreementEvent,
} from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import type { NotificationEventType } from "../../shared/notifications/protocol";
import {
  getViewerContext,
  requireActivePlayerProfile,
} from "../viewer/context";
import { getCategoryMatches } from "./_shared/board";
import {
  getTournamentRecordOrThrow,
  scheduleTournamentNotification,
  type OrmCtx,
  type OrmMutationCtx,
} from "./_shared/guards";
import {
  applyMatchResult,
  applyMatchSchedule,
  entryRecipientUserIds,
  getMatchOrThrow,
  listTournamentMatchRecords,
  resolveMatchContext,
  serializeMatch,
  sweepMatchAgreements,
  type MatchRecord,
} from "./_shared/match_writes";

// ---------------------------------------------------------------------------
// Acerto do confronto: leitura e escrita dos DOIS lados
// ---------------------------------------------------------------------------
// Toda escrita aqui é de quem JOGA (o autor sai do ctx, nunca do payload); o
// organizador continua com os procedimentos dele. O efeito do aceite é delegado
// ao caminho único de `_shared/match_writes`, o mesmo do organizador.

type AgreementRecord = InferSelectModel<typeof tournamentMatchAgreement>;

/** Confrontos lidos por lado (o mesmo jogador pode estar nos dois em teoria). */
const MY_MATCH_SCAN_LIMIT = 100;
/** Confrontos devolvidos: um jogador não joga mais que isso em um torneio. */
const MY_MATCH_CAP = 64;
/** Histórico do acerto devolvido por confronto (o log inteiro é append-only). */
const AGREEMENT_EVENT_SCAN_LIMIT = 100;

async function loadMatchSides(ctx: OrmCtx, match: MatchRecord) {
  const [entryA, entryB] = await Promise.all([
    match.entryAId
      ? ctx.orm.query.tournamentEntry.findFirst({
          where: { id: match.entryAId as Id<"tournamentEntry"> },
        })
      : null,
    match.entryBId
      ? ctx.orm.query.tournamentEntry.findFirst({
          where: { id: match.entryBId as Id<"tournamentEntry"> },
        })
      : null,
  ]);

  return { entryA: entryA ?? null, entryB: entryB ?? null };
}

async function findAgreementRows(
  ctx: OrmCtx,
  matchId: Id<"tournamentMatch">
): Promise<{
  schedule: AgreementRecord | null;
  score: AgreementRecord | null;
}> {
  const rows = await ctx.orm.query.tournamentMatchAgreement.findMany({
    limit: 2,
    where: { matchId },
  });

  return {
    schedule: rows.find((row) => row.channel === "schedule") ?? null,
    score: rows.find((row) => row.channel === "score") ?? null,
  };
}

/** Porta das escritas: só quem tem perfil em um dos lados passa. */
async function requireMatchSide(ctx: OrmCtx, match: MatchRecord) {
  const playerProfileId = await requireActivePlayerProfile(ctx);
  const sides = await loadMatchSides(ctx, match);
  const access = resolveMatchSideAccess({
    entryA: sides.entryA,
    entryB: sides.entryB,
    playerProfileId: playerProfileId as string,
  });

  if (access.error || !access.side) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: access.error ?? "Esse confronto não é seu.",
    });
  }

  return { access, playerProfileId, sides };
}

async function writeAgreement(
  ctx: OrmMutationCtx,
  input: {
    actorSide: MatchAgreementActorSide;
    channel: MatchAgreementChannel;
    existing: AgreementRecord | null;
    match: MatchRecord;
    next: MatchAgreementStateFields;
    snapshot: MatchAgreementSnapshot;
    tournamentId: Id<"tournament">;
  }
) {
  const now = new Date();
  const agreedAt = input.next.agreedAt ? new Date(input.next.agreedAt) : null;
  const proposedAt = input.next.proposedAt
    ? new Date(input.next.proposedAt)
    : null;
  const proposedByUserId = input.next.proposedByUserId as Id<"user"> | null;

  if (input.existing) {
    await ctx.orm
      .update(tournamentMatchAgreement)
      .set({
        agreedAt,
        proposal: input.next.proposal,
        proposedAt,
        proposedBySide: input.next.proposedBySide,
        proposedByUserId,
        rowVersion: input.existing.rowVersion + 1,
        state: input.next.state,
        updatedAt: now,
      })
      .where(eq(tournamentMatchAgreement.id, input.existing.id as never));
  } else {
    await ctx.orm.insert(tournamentMatchAgreement).values({
      agreedAt,
      categoryId: input.match.categoryId as Id<"tournamentCategory">,
      channel: input.channel,
      createdAt: now,
      entryAId: input.match.entryAId as Id<"tournamentEntry">,
      entryBId: input.match.entryBId as Id<"tournamentEntry">,
      matchId: input.match.id as Id<"tournamentMatch">,
      proposal: input.next.proposal,
      proposedAt,
      proposedBySide: input.next.proposedBySide,
      proposedByUserId,
      rowVersion: 1,
      state: input.next.state,
      tournamentId: input.tournamentId,
      updatedAt: now,
    });
  }

  await ctx.orm.insert(tournamentMatchAgreementEvent).values({
    actorSide: input.actorSide,
    actorUserId: ctx.userId as Id<"user">,
    after: input.snapshot.after,
    before: input.snapshot.before,
    channel: input.channel,
    createdAt: now,
    kind: input.snapshot.kind,
    matchId: input.match.id as Id<"tournamentMatch">,
    tournamentId: input.tournamentId,
  });
}

function buildAgreementsView(input: {
  matchId: string;
  rows: { schedule: AgreementRecord | null; score: AgreementRecord | null };
  userId: string;
}) {
  const schedule = buildAgreementChannelView({
    current: input.rows.schedule
      ? toAgreementStateFields(input.rows.schedule)
      : null,
    userId: input.userId,
  });
  const score = buildAgreementChannelView({
    current: input.rows.score ? toAgreementStateFields(input.rows.score) : null,
    userId: input.userId,
  });

  return {
    matchId: input.matchId,
    schedule: {
      agreedAt: schedule.agreedAt,
      proposal: readScheduleProposal(schedule.proposal),
      proposedAt: schedule.proposedAt,
      proposedByMe: schedule.proposedByMe,
      proposedBySide: schedule.proposedBySide,
      state: schedule.state,
    },
    score: {
      agreedAt: score.agreedAt,
      proposal: readScoreProposal(score.proposal),
      proposedAt: score.proposedAt,
      proposedByMe: score.proposedByMe,
      proposedBySide: score.proposedBySide,
      state: score.state,
    },
  };
}

function actorFallbackName(actorSide: MatchAgreementActorSide) {
  return actorSide === "organizer" ? "Organizador" : "Um jogador";
}

/**
 * Aviso de um passo do acerto (proposta ou recusa): vai SO para o lado que NÃO
 * agiu, pelo mesmo caminho dos avisos de confronto (feed + entrega via
 * orchestrator). Quem agiu vê o estado no próprio card.
 */
async function notifyAgreementSide(
  ctx: OrmMutationCtx,
  input: {
    eventType: NotificationEventType;
    match: MatchRecord;
    metadata: Record<string, unknown>;
    side: MatchAgreementSide;
    tournamentId: Id<"tournament">;
  }
) {
  const recipientEntryId = resolveAgreementNoticeEntryId({
    entryAId: input.match.entryAId ?? null,
    entryBId: input.match.entryBId ?? null,
    side: input.side,
  });

  if (!recipientEntryId) {
    return;
  }

  const recipients = (
    await entryRecipientUserIds(ctx, [recipientEntryId])
  ).filter((userId) => userId !== ctx.userId);

  if (recipients.length === 0) {
    return;
  }

  await scheduleTournamentNotification(ctx, {
    actorUserId: ctx.userId as Id<"user">,
    eventType: input.eventType,
    metadata: input.metadata,
    recipientUserIds: recipients,
    sourceEntityId: input.match.id as string,
    sourceEntityType: "tournamentMatch",
    tournamentId: input.tournamentId,
  });
}

export const proposeSchedule = authMutation
  .input(ProposeMatchScheduleSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    // A proposta passa pela MESMA validação do agendamento (janela ocupada
    // inclusive): se conflitar, ela nem entra.
    const proposal = resolveScheduleProposal({
      match: {
        entryAId: match.entryAId ?? null,
        entryBId: match.entryBId ?? null,
        id: match.id as string,
        publishedAt: Boolean(match.publishedAt),
        status: match.status,
      },
      proposal: {
        courtId: input.courtId,
        endMinute: input.endMinute,
        matchDate: input.matchDate,
        startMinute: input.startMinute,
      },
      scheduledMatches: await listTournamentMatchRecords(
        ctx,
        tournament.id as Id<"tournament">
      ),
      tournament: {
        courts: tournament.courts as readonly { id: string }[] | null,
        matchConfig: tournament.matchConfig as MatchConfig,
        status: tournament.status,
      },
    });

    if (proposal.error || !proposal.plan) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: proposal.error ?? "Proposta inválida.",
      });
    }

    const transition = resolveProposalTransition({
      channel: "schedule",
      current: rows.schedule ? toAgreementStateFields(rows.schedule) : null,
      nowMs: Date.now(),
      proposal: { ...proposal.plan },
      side: access.side as MatchAgreementSide,
      userId: ctx.userId as string,
    });

    if (!(transition.event && transition.next)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Proposta inválida.",
      });
    }

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "schedule",
      existing: rows.schedule,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.schedule_proposed",
      match,
      metadata: {
        // O nome da quadra viaja pronto: a copy do aviso não lê a tabela.
        courtName: (tournament.courts ?? []).find(
          (court: { id: string }) => court.id === proposal.plan?.courtId
        )?.name,
        matchDate: proposal.plan?.matchDate,
        matchId: match.id as string,
        reopened: transition.event.kind === "reopened",
        startMinute: proposal.plan?.startMinute,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

export const acceptSchedule = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveAcceptanceTransition({
      current: rows.schedule ? toAgreementStateFields(rows.schedule) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
    });
    const plan = readScheduleProposal(transition.next?.proposal ?? null);

    if (transition.error || !transition.event || !transition.next || !plan) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para responder.",
      });
    }

    // Efeito igual ao agendamento do organizador: a janela é revalidada na hora
    // e os dois lados são avisados pelo mesmo caminho.
    await applyMatchSchedule(ctx, {
      courtId: plan.courtId,
      endMinute: plan.endMinute,
      match,
      matchDate: plan.matchDate,
      startMinute: plan.startMinute,
      tournament,
    });

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "schedule",
      existing: rows.schedule,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

export const declineSchedule = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveDeclineTransition({
      current: rows.schedule ? toAgreementStateFields(rows.schedule) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
    });

    if (transition.error || !transition.event || !transition.next) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para responder.",
      });
    }

    // A recusa avisa quem propôs: o horário derrubado vai no metadata.
    const declined = readScheduleProposal(readEventProposal(transition.event));

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "schedule",
      existing: rows.schedule,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.schedule_declined",
      match,
      metadata: {
        courtName: (tournament.courts ?? []).find(
          (court: { id: string }) => court.id === declined?.courtId
        )?.name,
        matchDate: declined?.matchDate,
        matchId: match.id as string,
        startMinute: declined?.startMinute,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

/**
 * Retirada da proposta de horario pelo AUTOR: quem RECEBEU a acao (o lado
 * oposto) e avisado de que a mesa ficou livre. Mesmo destino da recusa — o canal
 * volta a idle e o confronto nao muda.
 */
export const cancelSchedule = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveCancellationTransition({
      current: rows.schedule ? toAgreementStateFields(rows.schedule) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
      userId: ctx.userId as string,
    });

    if (transition.error || !transition.event || !transition.next) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para retirar.",
      });
    }

    // O horario que saiu da mesa vai no metadata do aviso ao outro lado.
    const cancelled = readScheduleProposal(readEventProposal(transition.event));

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "schedule",
      existing: rows.schedule,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.schedule_cancelled",
      match,
      metadata: {
        courtName: (tournament.courts ?? []).find(
          (court: { id: string }) => court.id === cancelled?.courtId
        )?.name,
        matchDate: cancelled?.matchDate,
        matchId: match.id as string,
        startMinute: cancelled?.startMinute,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

export const proposeScore = authMutation
  .input(PublishMatchResultSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    // Mesmo validador do lançamento do organizador (placar por sets, W.O. e
    // vencedor explícito): proposta inválida não entra.
    const proposal = resolveScoreProposal({
      match: {
        entryAId: match.entryAId ?? null,
        entryBId: match.entryBId ?? null,
        publishedAt: Boolean(match.publishedAt),
        status: match.status,
      },
      score: input.score,
      tournament: {
        matchConfig: tournament.matchConfig as MatchConfig,
        status: tournament.status,
      },
      walkover: Boolean(input.walkover),
    });

    if (proposal.error || !proposal.plan) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: proposal.error ?? "Proposta inválida.",
      });
    }

    const transition = resolveProposalTransition({
      channel: "score",
      current: rows.score ? toAgreementStateFields(rows.score) : null,
      nowMs: Date.now(),
      proposal: {
        score: proposal.plan.score,
        walkover: proposal.plan.walkover,
      },
      side: access.side as MatchAgreementSide,
      userId: ctx.userId as string,
    });

    if (!(transition.event && transition.next)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Proposta inválida.",
      });
    }

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "score",
      existing: rows.score,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.score_proposed",
      match,
      metadata: {
        matchId: match.id as string,
        sets: proposal.plan.score.sets,
        walkover: proposal.plan.walkover,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

export const acceptScore = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveAcceptanceTransition({
      current: rows.score ? toAgreementStateFields(rows.score) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
    });
    const proposal = readScoreProposal(transition.next?.proposal ?? null);

    if (
      transition.error ||
      !transition.event ||
      !transition.next ||
      !proposal
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para responder.",
      });
    }

    // Efeito igual ao lançamento do organizador: trava publishedAt, avança o
    // vencedor e avisa os dois lados.
    await applyMatchResult(ctx, {
      match,
      score: proposal.score,
      tournament,
      walkover: proposal.walkover,
    });

    // O resultado fechou o confronto: proposta de horário pendente perde sentido.
    await sweepMatchAgreements(ctx, {
      actorSide: access.side as MatchAgreementActorSide,
      channel: "schedule",
      kind: "closed",
      matchId,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "score",
      existing: rows.score,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

export const declineScore = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveDeclineTransition({
      current: rows.score ? toAgreementStateFields(rows.score) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
    });

    if (transition.error || !transition.event || !transition.next) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para responder.",
      });
    }

    // A recusa avisa quem propôs: o placar derrubado vai no metadata.
    const declined = readScoreProposal(readEventProposal(transition.event));

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "score",
      existing: rows.score,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.score_declined",
      match,
      metadata: {
        matchId: match.id as string,
        sets: declined?.score.sets ?? [],
        walkover: declined?.walkover ?? false,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

/**
 * Retirada da proposta de placar pelo AUTOR: o lado oposto e avisado com o placar
 * que saiu da mesa. Mesmo destino da recusa.
 */
export const cancelScore = authMutation
  .input(MatchAgreementActionSchema)
  .output(matchAgreementsSchema)
  .mutation(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const { access } = await requireMatchSide(ctx, match);
    const rows = await findAgreementRows(ctx, matchId);

    const transition = resolveCancellationTransition({
      current: rows.score ? toAgreementStateFields(rows.score) : null,
      nowMs: Date.now(),
      side: access.side as MatchAgreementSide,
      userId: ctx.userId as string,
    });

    if (transition.error || !transition.event || !transition.next) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: transition.error ?? "Não há proposta para retirar.",
      });
    }

    // O placar que saiu da mesa vai no metadata do aviso ao outro lado.
    const cancelled = readScoreProposal(readEventProposal(transition.event));

    await writeAgreement(ctx, {
      actorSide: access.side as MatchAgreementSide,
      channel: "score",
      existing: rows.score,
      match,
      next: transition.next,
      snapshot: transition.event,
      tournamentId: tournament.id as Id<"tournament">,
    });

    await notifyAgreementSide(ctx, {
      eventType: "tournament.match.score_cancelled",
      match,
      metadata: {
        matchId: match.id as string,
        sets: cancelled?.score.sets ?? [],
        walkover: cancelled?.walkover ?? false,
      },
      side: access.side as MatchAgreementSide,
      tournamentId: tournament.id as Id<"tournament">,
    });

    return buildAgreementsView({
      matchId: matchId as string,
      rows: await findAgreementRows(ctx, matchId),
      userId: ctx.userId as string,
    });
  });

/**
 * Confrontos do PRÓPRIO jogador no torneio: é esta porta que abre o confronto
 * para quem joga antes de o torneio começar. Nada do resto da chave entra aqui —
 * a chave sorteada continua privada (`listForTournament` não muda).
 */
export const listMyMatches = authQuery
  .input(TournamentByIdSchema)
  .output(z.array(playerMatchSchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const playerProfileId = await requireActivePlayerProfile(ctx);
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: MAX_TOURNAMENT_CATEGORIES,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    const categoryIds = new Set(
      categories.map((category) => category.id as string)
    );
    const [asA, asB] = await Promise.all([
      ctx.orm.query.tournamentEntry.findMany({
        limit: 100,
        where: { playerAId: playerProfileId },
      }),
      ctx.orm.query.tournamentEntry.findMany({
        limit: 100,
        where: { playerBId: playerProfileId },
      }),
    ]);
    const myEntryIds = [
      ...new Set(
        [...asA, ...asB]
          .filter((entry) => categoryIds.has(entry.categoryId as string))
          .map((entry) => entry.id as string)
      ),
    ] as Id<"tournamentEntry">[];

    if (myEntryIds.length === 0) {
      return [];
    }

    const [matchesA, matchesB] = await Promise.all([
      ctx.orm.query.tournamentMatch.findMany({
        limit: MY_MATCH_SCAN_LIMIT,
        where: { entryAId: { in: myEntryIds } },
      }),
      ctx.orm.query.tournamentMatch.findMany({
        limit: MY_MATCH_SCAN_LIMIT,
        where: { entryBId: { in: myEntryIds } },
      }),
    ]);
    const mine = [
      ...new Map(
        [...matchesA, ...matchesB].map((match) => [match.id as string, match])
      ).values(),
    ].slice(0, MY_MATCH_CAP);

    if (mine.length === 0) {
      return [];
    }

    const matchIds = mine.map((match) => match.id as Id<"tournamentMatch">);
    const agreementRows = await ctx.orm.query.tournamentMatchAgreement.findMany(
      {
        limit: matchIds.length * 2,
        where: { matchId: { in: matchIds } },
      }
    );
    const totalRoundsByCategory = new Map<string, number>();
    for (const categoryId of new Set(
      mine.map((match) => match.categoryId as string)
    )) {
      const board = await getCategoryMatches(
        ctx,
        categoryId as Id<"tournamentCategory">
      );
      totalRoundsByCategory.set(categoryId, resolveCategoryTotalRounds(board));
    }
    const myEntryIdSet = new Set(
      myEntryIds.map((entryId) => entryId as string)
    );

    return mine.map((match) => {
      const rows = {
        schedule:
          agreementRows.find(
            (row) => row.matchId === match.id && row.channel === "schedule"
          ) ?? null,
        score:
          agreementRows.find(
            (row) => row.matchId === match.id && row.channel === "score"
          ) ?? null,
      };

      return {
        agreements: buildAgreementsView({
          matchId: match.id as string,
          rows,
          userId: ctx.userId as string,
        }),
        match: serializeMatch(match),
        mySide: (myEntryIdSet.has(match.entryAId as string) ? "a" : "b") as
          | "a"
          | "b",
        totalRounds: totalRoundsByCategory.get(match.categoryId as string) ?? 1,
      };
    });
  });

/** Histórico do acerto: os dois lados do confronto e o organizador do torneio. */
export const listAgreementEvents = authQuery
  .input(MatchAgreementActionSchema)
  .output(z.array(matchAgreementEventSchema))
  .query(async ({ ctx, input }) => {
    const matchId = input.matchId as Id<"tournamentMatch">;
    const match = await getMatchOrThrow(ctx, matchId);
    const { tournament } = await resolveMatchContext(ctx, match);
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const isOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === tournament.organizationId;

    let allowed = isOrganizer;
    if (!allowed && viewerContext.activeActor.kind === "player") {
      const sides = await loadMatchSides(ctx, match);
      allowed = Boolean(
        resolveMatchSideAccess({
          entryA: sides.entryA,
          entryB: sides.entryB,
          playerProfileId: viewerContext.activeActor.id as string,
        }).side
      );
    }
    if (!allowed) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Esse confronto não é seu.",
      });
    }

    const events = await ctx.orm.query.tournamentMatchAgreementEvent.findMany({
      limit: AGREEMENT_EVENT_SCAN_LIMIT,
      orderBy: { createdAt: "asc" },
      where: { matchId },
    });
    const actorUserIds = [
      ...new Set(
        events
          .map((event) => event.actorUserId)
          .filter((id): id is Id<"user"> => id !== null)
      ),
    ];
    const users =
      actorUserIds.length > 0
        ? await ctx.orm.query.user.findMany({
            limit: actorUserIds.length,
            where: { id: { in: actorUserIds } },
          })
        : [];
    const userById = new Map(users.map((user) => [user.id as string, user]));
    // Conta sem nome nao deixa o historico anonimo: o nome sai do PERFIL.
    const actorProfiles =
      actorUserIds.length > 0
        ? await ctx.orm.query.playerProfile.findMany({
            limit: actorUserIds.length,
            where: { userId: { in: actorUserIds } },
          })
        : [];
    const nameByUserId = new Map<string, string>(
      actorUserIds.map((userId) => {
        const actorProfile = actorProfiles.find(
          (profile) => (profile.userId as string) === userId
        );

        return [
          userId as string,
          buildPlayerProfileDisplayName({
            fullName: actorProfile?.fullName,
            name: userById.get(userId)?.name,
            nickname: actorProfile?.nickname,
            userId,
          }),
        ];
      })
    );

    return events.map((event) => {
      const actorSide = event.actorSide as MatchAgreementActorSide;
      const proposal = readEventProposal({
        after: event.after,
        before: event.before,
      });

      return {
        actorName: event.actorUserId
          ? (nameByUserId.get(event.actorUserId as string) ??
            actorFallbackName(actorSide))
          : actorFallbackName(actorSide),
        actorSide,
        channel: event.channel as MatchAgreementChannel,
        createdAt: event.createdAt.getTime(),
        id: event.id as string,
        kind: event.kind as MatchAgreementEventKind,
        schedule:
          event.channel === "schedule" ? readScheduleProposal(proposal) : null,
        score: event.channel === "score" ? readScoreProposal(proposal) : null,
      };
    });
  });
