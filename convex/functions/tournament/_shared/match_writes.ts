import { eq, unsetToken } from "kitcn/orm";
import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import type { Id } from "../../_generated/dataModel";
import type { MatchConfig } from "../../../domains/match/contract";
import { resolveMatchOccupiedEndMinute } from "../../../domains/match/scheduling";
import {
  resolveAgreementSweep,
  toAgreementStateFields,
} from "../../../domains/tournament/agreement-rules";
import type {
  MatchAgreementActorSide,
  MatchAgreementChannel,
  TournamentMatchScore,
} from "../../../domains/tournament/contract";
import {
  canReserveUnreadySlot,
  findCourtSlotConflict,
  isBracketReleased,
} from "../../../domains/tournament/scheduling-rules";
import {
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "../../../domains/tournament/score-rules";
import {
  tournamentMatch,
  tournamentMatchAgreement,
  tournamentMatchAgreementEvent,
} from "../../../domains/tournament/tables";
import {
  findUnavailabilityConflict,
  formatUnavailabilityConflict,
} from "../../../domains/tournament/unavailability-rules";
import {
  resolveTournamentWindow,
  validateMatchDayInWindow,
} from "../../../domains/tournament/window-rules";
import {
  MAX_TOURNAMENT_CATEGORIES,
  tournamentMatchSchema,
} from "../../../domains/tournament/contract";
import {
  getCategoryRecordOrThrow,
  getTournamentRecordOrThrow,
  listTournamentUnavailability,
  resolveTournamentCourtName,
  scheduleTournamentNotification,
  type OrmCtx,
  type OrmMutationCtx,
  type TournamentRecord,
} from "./guards";
import { notifyMatchReady } from "./match_notices";

// ---------------------------------------------------------------------------
// Caminho UNICO de escrita do confronto
// ---------------------------------------------------------------------------
// Organizador e acerto dos jogadores escrevem por aqui: o efeito no confronto
// (agendar, publicar, avisar os dois lados) e o mesmo, e a barreira de cada
// porta fica em quem chama. Nenhuma escrita daqui notifica um lado so.

export type MatchRecord = InferSelectModel<typeof tournamentMatch>;

export function serializeMatch(record: MatchRecord) {
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

export async function getMatchOrThrow(
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

export async function resolveMatchContext(ctx: OrmCtx, match: MatchRecord) {
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

export async function entryRecipientUserIds(
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

/** All matches of a tournament across its categories (bounded, per category). */
export async function listTournamentMatchRecords(
  ctx: OrmCtx,
  tournamentId: Id<"tournament">
): Promise<MatchRecord[]> {
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: MAX_TOURNAMENT_CATEGORIES,
    where: { tournamentId },
  });
  const matches: MatchRecord[] = [];
  for (const category of categories) {
    const rows = await ctx.orm.query.tournamentMatch.findMany({
      limit: 300,
      where: { categoryId: category.id as Id<"tournamentCategory"> },
    });
    matches.push(...rows);
  }
  return matches;
}

/**
 * Vencedor do payload de resultado (placar ou W.O.), com as mesmas mensagens do
 * lançamento: W.O. declara o vencedor sem placar jogado, mas ele tem que ser um
 * dos dois lados.
 */
export function resolveMatchResultWinner(input: {
  entryAId: string;
  entryBId: string;
  matchConfig: MatchConfig;
  score: TournamentMatchScore;
  walkover: boolean;
}): string {
  if (input.walkover) {
    const walkoverCheck = validateWalkoverWinner({
      entryAId: input.entryAId,
      entryBId: input.entryBId,
      winnerEntryId: input.score.winnerEntryId,
    });
    if (walkoverCheck.error || !walkoverCheck.winnerEntryId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: walkoverCheck.error ?? "Resultado inválido.",
      });
    }
    return walkoverCheck.winnerEntryId;
  }

  const validation = validateTournamentMatchScore({
    entryAId: input.entryAId,
    entryBId: input.entryBId,
    matchConfig: input.matchConfig,
    score: input.score,
  });
  if (validation.error || !validation.winnerEntryId) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: validation.error ?? "Resultado inválido.",
    });
  }
  return validation.winnerEntryId;
}

/**
 * Confronto acima da 1a rodada e alimentado pelos dois confrontos de baixo: e
 * essa a vaga que o organizador reserva antes dos vencedores aparecerem.
 */
async function matchFeederMatchesExist(
  ctx: OrmCtx,
  match: MatchRecord
): Promise<boolean> {
  if (match.round <= 1) {
    return false;
  }
  const [feederA, feederB] = await Promise.all([
    ctx.orm.query.tournamentMatch.findFirst({
      where: {
        categoryId: match.categoryId as Id<"tournamentCategory">,
        round: match.round - 1,
        slotInRound: match.slotInRound * 2,
      },
    }),
    ctx.orm.query.tournamentMatch.findFirst({
      where: {
        categoryId: match.categoryId as Id<"tournamentCategory">,
        round: match.round - 1,
        slotInRound: match.slotInRound * 2 + 1,
      },
    }),
  ]);
  return Boolean(feederA && feederB);
}

/**
 * Aviso de AGENDA (agendado, reagendado, suspenso) é do JOGADOR: antes da
 * DIVULGAÇÃO a agenda é privada do organizador e nada sai — o aviso não é
 * adiado, simplesmente não existe (a agenda aparece no app depois da solta).
 */
async function notifyMatchSlotChange(
  ctx: OrmMutationCtx,
  input: {
    eventType:
      | "tournament.match.rescheduled"
      | "tournament.match.scheduled"
      | "tournament.match.suspended";
    match: MatchRecord;
    metadata: Record<string, unknown>;
    tournament: TournamentRecord;
  }
) {
  if (!isBracketReleased(input.tournament)) {
    return;
  }
  const recipients = await entryRecipientUserIds(ctx, [
    input.match.entryAId,
    input.match.entryBId,
  ]);
  if (recipients.length === 0) {
    return;
  }
  await scheduleTournamentNotification(ctx, {
    eventType: input.eventType,
    metadata: input.metadata,
    recipientUserIds: recipients,
    sourceEntityId: input.match.id as string,
    sourceEntityType: "tournamentMatch",
    tournamentId: input.tournament.id as Id<"tournament">,
  });
}

/**
 * Agendamento (organizador ou acerto dos dois lados): exige chave sorteada ou
 * torneio em andamento, quadra do torneio, janela do torneio, agenda livre e
 * sem bloqueio. A ocupação vem da duração padrão, nunca do endMinute do
 * cliente, e a partida ignora a si mesma. Torneio SEM quadra cadastrada aceita
 * `courtId: null`: aí o acerto é data e horário, e não existe janela para
 * conflitar. `actor` só relaxa os dois lados para o ORGANIZADOR reservar
 * semi/final que ainda espera os vencedores.
 */
export async function applyMatchSchedule(
  ctx: OrmMutationCtx,
  input: {
    actor: "organizer" | "player";
    courtId: null | string;
    endMinute: number;
    match: MatchRecord;
    matchDate: string;
    startMinute: number;
    tournament: TournamentRecord;
  }
): Promise<MatchRecord> {
  const { match, tournament } = input;

  if (tournament.status !== "drawn" && tournament.status !== "ongoing") {
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
  const reservable = canReserveUnreadySlot({
    actor: input.actor,
    feederMatchesExist: await matchFeederMatchesExist(ctx, match),
    round: match.round,
  });
  if (match.status === "vacant" && !reservable) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Essa vaga da chave está vazia e não pode ser agendada.",
    });
  }
  if (!(reservable || (match.entryAId && match.entryBId))) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Esse confronto ainda não tem os dois lados definidos.",
    });
  }
  const windowError = validateMatchDayInWindow({
    dayKey: input.matchDate,
    window: resolveTournamentWindow({
      endDateMs: tournament.endDate?.getTime() ?? null,
      startDateMs: tournament.startDate.getTime(),
    }),
  });
  if (windowError) {
    throw new CRPCError({ code: "BAD_REQUEST", message: windowError });
  }
  if (input.startMinute >= input.endMinute) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O horário de início deve ser antes do término.",
    });
  }
  const courts = tournament.courts ?? [];
  if (input.courtId !== null) {
    if (!courts.some((court: { id: string }) => court.id === input.courtId)) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Quadra inválida." });
    }
  } else if (courts.length > 0) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Escolha uma quadra para este horário.",
    });
  }

  // One match per court at a time: occupancy comes from the rules' default
  // duration, never from the client-sent endMinute.
  const matchConfig = tournament.matchConfig as MatchConfig;
  const occupiedEndMinute = resolveMatchOccupiedEndMinute({
    matchConfig,
    startMinute: input.startMinute,
  });
  const block = findUnavailabilityConflict({
    blocks: await listTournamentUnavailability(ctx, {
      date: input.matchDate,
      tournamentId: tournament.id as Id<"tournament">,
    }),
    courtId: input.courtId,
    dayKey: input.matchDate,
    endMinute: occupiedEndMinute,
    startMinute: input.startMinute,
  });
  if (block) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: formatUnavailabilityConflict({
        block,
        courtName: resolveTournamentCourtName({
          courtId: block.courtId,
          courts: tournament.courts,
        }),
      }),
    });
  }
  if (input.courtId !== null) {
    const conflict = findCourtSlotConflict({
      courtId: input.courtId,
      endMinute: occupiedEndMinute,
      ignoredMatchId: match.id,
      matchConfig,
      matchDate: input.matchDate,
      scheduledMatches: await listTournamentMatchRecords(
        ctx,
        tournament.id as Id<"tournament">
      ),
      startMinute: input.startMinute,
    });
    if (conflict) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse horário já está reservado para outro confronto.",
      });
    }
  }

  // Chave OMITIDA do Convex vira undefined: `!== null` marcaria a PRIMEIRA
  // agenda como reagendamento.
  const wasScheduled = Boolean(match.matchDate);
  const now = new Date();
  const [updated] = await ctx.orm
    .update(tournamentMatch)
    .set({
      courtId: input.courtId,
      endMinute: occupiedEndMinute,
      matchDate: input.matchDate,
      rowVersion: match.rowVersion + 1,
      scheduledById: ctx.userId as Id<"user">,
      startMinute: input.startMinute,
      // A draw-time bye (walkover) stays a walkover: scheduling data can be
      // attached without rewriting the resolved outcome.
      status: match.status === "walkover" ? "walkover" : "scheduled",
      updatedAt: now,
    })
    .where(eq(tournamentMatch.id, match.id as never))
    .returning();

  await notifyMatchSlotChange(ctx, {
    eventType: wasScheduled
      ? "tournament.match.rescheduled"
      : "tournament.match.scheduled",
    match,
    // A copy do aviso carrega o que muda: quando e onde ficou o confronto.
    metadata: {
      courtName: (tournament.courts ?? []).find(
        (court: { id: string }) => court.id === input.courtId
      )?.name,
      matchDate: input.matchDate,
      matchId: match.id,
      startMinute: input.startMinute,
    },
    tournament,
  });

  return updated;
}

/**
 * Cancelamento de um confronto: tira a agenda e avisa os dois lados com o
 * motivo; o confronto segue VIVO e volta a "a definir", pronto para os dois
 * remarcarem. Resultado publicado e vaga vazia quem decide é o plano do
 * cancelamento em lote, não esta função.
 */
export async function applyMatchSuspension(
  ctx: OrmMutationCtx,
  input: {
    match: MatchRecord;
    reason: null | string;
    tournament: TournamentRecord;
  }
): Promise<MatchRecord> {
  const { match, tournament } = input;
  // O aviso carrega o horário que SAIU da agenda: depois do update ele some.
  const suspendedSlot = {
    matchDate: match.matchDate ?? null,
    startMinute: match.startMinute ?? null,
  };
  const now = new Date();
  const [updated] = await ctx.orm
    .update(tournamentMatch)
    .set({
      courtId: unsetToken,
      endMinute: unsetToken,
      matchDate: unsetToken,
      rowVersion: match.rowVersion + 1,
      scheduledById: unsetToken,
      startMinute: unsetToken,
      status: match.status === "scheduled" ? "pending" : match.status,
      updatedAt: now,
    })
    .where(eq(tournamentMatch.id, match.id as never))
    .returning();

  // O acerto de horário vigente perdeu efeito junto com a agenda: fecha o canal
  // de agendamento (o de placar continua valendo para o confronto remarcado).
  await sweepMatchAgreements(ctx, {
    actorSide: "organizer",
    channel: "schedule",
    kind: "overridden",
    matchId: match.id as Id<"tournamentMatch">,
    tournamentId: tournament.id as Id<"tournament">,
  });

  await notifyMatchSlotChange(ctx, {
    eventType: "tournament.match.suspended",
    match,
    metadata: {
      ...(suspendedSlot.matchDate
        ? { matchDate: suspendedSlot.matchDate }
        : {}),
      matchId: match.id,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(suspendedSlot.startMinute === null
        ? {}
        : { startMinute: suspendedSlot.startMinute }),
    },
    tournament,
  });

  return updated;
}

/**
 * Publicação do resultado (organizador ou confirmação dos dois lados): trava
 * publishedAt, avança o vencedor para a vaga seguinte ainda não publicada e
 * avisa os dois lados.
 */
export async function applyMatchResult(
  ctx: OrmMutationCtx,
  input: {
    match: MatchRecord;
    score: TournamentMatchScore;
    tournament: TournamentRecord;
    walkover: boolean;
  }
): Promise<MatchRecord> {
  const { match, tournament } = input;

  if (tournament.status !== "ongoing") {
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

  const winnerEntryId = resolveMatchResultWinner({
    entryAId: match.entryAId as string,
    entryBId: match.entryBId as string,
    matchConfig: tournament.matchConfig as MatchConfig,
    score: input.score,
    walkover: input.walkover,
  });
  const isWalkover = Boolean(input.walkover);

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
    const nextSides = {
      entryAId: (next.entryAId ?? null) as null | string,
      entryBId: (next.entryBId ?? null) as null | string,
    };
    await ctx.orm
      .update(tournamentMatch)
      .set({
        [side]: winnerEntryId as Id<"tournamentEntry">,
        rowVersion: next.rowVersion + 1,
        updatedAt: now,
      })
      .where(eq(tournamentMatch.id, next.id as never));
    await notifyMatchReady(ctx, {
      after: { ...nextSides, [side]: winnerEntryId as string },
      before: nextSides,
      categoryId: match.categoryId as Id<"tournamentCategory">,
      matchId: next.id as string,
      round: next.round,
      tournament,
    });
  }

  const recipients = await entryRecipientUserIds(ctx, [
    match.entryAId,
    match.entryBId,
  ]);
  if (recipients.length > 0) {
    await scheduleTournamentNotification(ctx, {
      eventType: "tournament.match.result",
      metadata: {
        matchId: match.id,
        // Placar publicado: o aviso diz o que saiu, nao so que saiu.
        sets: input.score.sets,
        winnerEntryId,
      },
      recipientUserIds: recipients,
      sourceEntityId: match.id as string,
      sourceEntityType: "tournamentMatch",
      tournamentId: tournament.id as Id<"tournament">,
    });
  }

  return updated;
}

/**
 * Fecha o acerto vigente do confronto: o organizador escreveu por cima
 * (`overridden`) ou o confronto foi decidido e o canal perdeu sentido
 * (`closed`). Sem acerto vigente não há evento — o log não registra o que não
 * existia. `channel` limita o fecho a um canal (agendar fecha só o horário).
 */
export async function sweepMatchAgreements(
  ctx: OrmMutationCtx,
  input: {
    actorSide: MatchAgreementActorSide;
    channel?: MatchAgreementChannel;
    kind: "closed" | "overridden";
    matchId: Id<"tournamentMatch">;
    tournamentId: Id<"tournament">;
  }
): Promise<void> {
  const rows = await ctx.orm.query.tournamentMatchAgreement.findMany({
    limit: 2,
    where: input.channel
      ? { channel: input.channel, matchId: input.matchId }
      : { matchId: input.matchId },
  });
  const now = new Date();

  for (const row of rows) {
    const transition = resolveAgreementSweep({
      current: toAgreementStateFields(row),
      kind: input.kind,
      nowMs: now.getTime(),
    });
    if (!transition) {
      continue;
    }

    await ctx.orm
      .update(tournamentMatchAgreement)
      .set({
        agreedAt: transition.next.agreedAt
          ? new Date(transition.next.agreedAt)
          : null,
        proposal: null,
        proposedAt: null,
        proposedBySide: null,
        proposedByUserId: null,
        rowVersion: row.rowVersion + 1,
        state: transition.next.state,
        updatedAt: now,
      })
      .where(eq(tournamentMatchAgreement.id, row.id as never));

    await ctx.orm.insert(tournamentMatchAgreementEvent).values({
      actorSide: input.actorSide,
      actorUserId: ctx.userId as Id<"user">,
      after: transition.event.after,
      before: transition.event.before,
      channel: row.channel,
      createdAt: now,
      kind: transition.event.kind,
      matchId: input.matchId,
      tournamentId: input.tournamentId,
    });
  }
}
