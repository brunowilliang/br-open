import type { MatchConfig } from "../match/contract";
import { resolveMatchOccupiedEndMinute } from "../match/scheduling";
import {
  matchScheduleProposalSchema,
  matchScoreProposalSchema,
  type MatchAgreementChannel,
  type MatchAgreementEventKind,
  type MatchAgreementSide,
  type MatchAgreementState,
  type MatchScheduleProposal,
  type MatchScoreProposal,
  type TournamentMatchScore,
} from "./contract";
import { isTournamentClosed } from "./management-rules";
import { findCourtSlotConflict } from "./scheduling-rules";
import type { TournamentScheduledMatch } from "./scheduling-rules";
import {
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "./score-rules";

// ---------------------------------------------------------------------------
// Acerto do confronto: regras PURAS (dado -> dado, sem ctx e sem tabela)
// ---------------------------------------------------------------------------
// Um lado PROPÕE, o outro aceita ou propõe outro; o aceite dos dois fecha o
// canal e o efeito no confronto é aplicado por quem chama (agendar/publicar). O
// organizador continua por cima: não passa por aqui, mas o atropelo dele vira
// evento quando havia acerto em andamento.

/** Lados de uma inscrição que pertencem ao confronto (perfis de jogador). */
export type MatchAgreementPartyEntry = {
  playerAId: string | null;
  playerBId: string | null;
};

/** Estado do canal como ele vive na linha: é o que as transições leem/escrevem. */
export type MatchAgreementStateFields = {
  agreedAt: number | null;
  proposal: Record<string, unknown> | null;
  proposedAt: number | null;
  proposedBySide: MatchAgreementSide | null;
  proposedByUserId: string | null;
  state: MatchAgreementState;
};

export type MatchAgreementSnapshot = {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
  kind: MatchAgreementEventKind;
};

export type ScheduleProposalPlan = {
  courtId: string | null;
  endMinute: number;
  matchDate: string;
  startMinute: number;
};

export type ScoreProposalPlan = {
  score: TournamentMatchScore;
  walkover: boolean;
  winnerEntryId: string;
};

export type ReceivedAgreement = {
  channel: MatchAgreementChannel;
  kind: "proposal" | "reopened";
};

function isSideEntry(
  entry: MatchAgreementPartyEntry | null | undefined,
  playerProfileId: string
) {
  return Boolean(
    entry &&
      (entry.playerAId === playerProfileId ||
        entry.playerBId === playerProfileId)
  );
}

/** Em qual lado do confronto o perfil do ator está (null = não é das partes). */
export function resolveAgreementSide(input: {
  entryA: MatchAgreementPartyEntry | null | undefined;
  entryB: MatchAgreementPartyEntry | null | undefined;
  playerProfileId: string;
}): MatchAgreementSide | null {
  if (isSideEntry(input.entryA, input.playerProfileId)) {
    return "a";
  }

  return isSideEntry(input.entryB, input.playerProfileId) ? "b" : null;
}

/**
 * Porta de entrada de toda escrita do acerto: só quem tem perfil em um dos lados
 * escreve. O lado NÃO decide quem aceita — isso é da proposta vigente.
 */
export function resolveMatchSideAccess(input: {
  entryA: MatchAgreementPartyEntry | null | undefined;
  entryB: MatchAgreementPartyEntry | null | undefined;
  playerProfileId: string;
}): { error: string | null; side: MatchAgreementSide | null } {
  const side = resolveAgreementSide(input);

  return {
    error: side
      ? null
      : "Só quem joga esse confronto pode combinar horário e placar.",
    side,
  };
}

/**
 * Quem recebe o aviso de um passo do acerto: o lado que NAO agiu. Quem age
 * (propõe ou recusa) ja ve o estado no proprio card; o outro lado precisa saber.
 */
export function resolveAgreementNoticeEntryId(input: {
  entryAId: null | string | undefined;
  entryBId: null | string | undefined;
  side: MatchAgreementSide;
}): string | null {
  const otherEntryId = input.side === "a" ? input.entryBId : input.entryAId;

  return otherEntryId ?? null;
}

/**
 * Proposta de horário: mesmos gates do agendamento do organizador e a MESMA
 * janela ocupada (duração padrão do torneio). A quadra só entra quando o torneio
 * tem quadra cadastrada; sem quadra, o acerto é data + horário.
 */
export function resolveScheduleProposal(input: {
  match: {
    entryAId: string | null;
    entryBId: string | null;
    id: string;
    publishedAt: boolean;
    status: string;
  };
  proposal: {
    courtId: string | null;
    endMinute: number;
    matchDate: string;
    startMinute: number;
  };
  scheduledMatches: TournamentScheduledMatch[];
  tournament: {
    courts: readonly { id: string }[] | null | undefined;
    matchConfig: MatchConfig;
    status: string;
  };
}): { error: string | null; plan: ScheduleProposalPlan | null } {
  const { match, tournament } = input;

  if (tournament.status !== "drawn" && tournament.status !== "ongoing") {
    return {
      error: "Agendamento exige chave sorteada ou torneio em andamento.",
      plan: null,
    };
  }
  if (match.publishedAt) {
    return {
      error: "Confronto encerrado não pode ser reagendado.",
      plan: null,
    };
  }
  if (match.status === "vacant") {
    return {
      error: "Essa vaga da chave está vazia e não pode ser agendada.",
      plan: null,
    };
  }
  if (!(match.entryAId && match.entryBId)) {
    return {
      error: "Esse confronto ainda não tem os dois lados definidos.",
      plan: null,
    };
  }
  if (input.proposal.startMinute >= input.proposal.endMinute) {
    return {
      error: "O horário de início deve ser antes do término.",
      plan: null,
    };
  }

  const courts = tournament.courts ?? [];
  if (courts.length === 0) {
    if (input.proposal.courtId !== null) {
      return { error: "Quadra inválida.", plan: null };
    }
  } else {
    if (input.proposal.courtId === null) {
      return {
        error: "Escolha uma quadra para este horário.",
        plan: null,
      };
    }
    if (!courts.some((court) => court.id === input.proposal.courtId)) {
      return { error: "Quadra inválida.", plan: null };
    }
  }

  // Ocupação derivada da duração padrão dos dois lados: um endMinute vindo do
  // cliente não encurta reserva já feita (mesma regra do agendamento).
  const endMinute = resolveMatchOccupiedEndMinute({
    matchConfig: tournament.matchConfig,
    startMinute: input.proposal.startMinute,
  });

  if (input.proposal.courtId !== null) {
    const conflict = findCourtSlotConflict({
      courtId: input.proposal.courtId,
      endMinute,
      ignoredMatchId: match.id,
      matchConfig: tournament.matchConfig,
      matchDate: input.proposal.matchDate,
      scheduledMatches: input.scheduledMatches,
      startMinute: input.proposal.startMinute,
    });
    if (conflict) {
      return {
        error: "Esse horário já está reservado para outro confronto.",
        plan: null,
      };
    }
  }

  return {
    error: null,
    plan: {
      courtId: input.proposal.courtId,
      endMinute,
      matchDate: input.proposal.matchDate,
      startMinute: input.proposal.startMinute,
    },
  };
}

/**
 * Proposta de placar: mesmos gates e o MESMO validador do lançamento do
 * organizador (placar por sets, W.O. e vencedor explícito).
 */
export function resolveScoreProposal(input: {
  match: {
    entryAId: string | null;
    entryBId: string | null;
    publishedAt: boolean;
    status: string;
  };
  score: TournamentMatchScore;
  tournament: { matchConfig: MatchConfig; status: string };
  walkover: boolean;
}): { error: string | null; plan: ScoreProposalPlan | null } {
  const { match, tournament } = input;

  if (isTournamentClosed(tournament.status)) {
    return {
      error:
        "Torneio encerrado ou cancelado: o resultado não pode ser combinado.",
      plan: null,
    };
  }
  if (tournament.status !== "ongoing") {
    return {
      error: "Resultados só podem ser combinados com o torneio em andamento.",
      plan: null,
    };
  }
  if (match.publishedAt) {
    return {
      error: "Esse confronto já tem resultado publicado.",
      plan: null,
    };
  }
  if (match.status === "vacant") {
    return {
      error: "Essa vaga da chave está vazia e não tem resultado.",
      plan: null,
    };
  }
  if (!(match.entryAId && match.entryBId)) {
    return {
      error: "Esse confronto ainda não tem os dois lados definidos.",
      plan: null,
    };
  }

  const resolution = input.walkover
    ? validateWalkoverWinner({
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        winnerEntryId: input.score.winnerEntryId,
      })
    : validateTournamentMatchScore({
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        matchConfig: tournament.matchConfig,
        score: input.score,
      });

  if (resolution.error || !resolution.winnerEntryId) {
    return { error: resolution.error ?? "Resultado inválido.", plan: null };
  }

  return {
    error: null,
    plan: {
      score: {
        sets: input.score.sets,
        winnerEntryId: resolution.winnerEntryId,
      },
      walkover: input.walkover,
      winnerEntryId: resolution.winnerEntryId,
    },
  };
}

function toSnapshotFields(
  current: MatchAgreementStateFields | null
): Record<string, unknown> {
  return {
    agreedAt: current?.agreedAt ?? null,
    proposal: current?.proposal ?? null,
    proposedAt: current?.proposedAt ?? null,
    proposedBySide: current?.proposedBySide ?? null,
    proposedByUserId: current?.proposedByUserId ?? null,
    state: current?.state ?? "idle",
  };
}

/** Payload normalizado em string canonica: mesma proposta -> mesma string. */
function toCanonicalProposalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(toCanonicalProposalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : 1));
    return `{${entries
      .map(
        ([key, entryValue]) => `${key}:${toCanonicalProposalJson(entryValue)}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Proposta IDENTICA a que esta na mesa e no-op: nao supera a vigente (pendente)
 * nem reabre acerto fechado com o mesmo valor. Mesa vazia nao tem o que comparar.
 */
function resolveIdenticalProposalGate(input: {
  channel: MatchAgreementChannel;
  current: MatchAgreementStateFields | null;
  proposal: Record<string, unknown>;
}): string | null {
  const standing = input.current?.proposal;
  if (!standing) {
    return null;
  }
  if (
    toCanonicalProposalJson(standing) !==
    toCanonicalProposalJson(input.proposal)
  ) {
    return null;
  }

  return input.channel === "schedule"
    ? "Esse horário é o mesmo que já está na mesa."
    : "Esse placar é o mesmo que já está na mesa.";
}

/**
 * Proposta nova: supera a vigente (inclusive a do próprio lado) e, se o canal já
 * estava FECHADO, o evento é um pedido de mudança (`reopened`) com o novo
 * horário/placar dentro. Proposta igual a vigente e recusada sem evento.
 */
export function resolveProposalTransition(input: {
  channel: MatchAgreementChannel;
  current: MatchAgreementStateFields | null;
  nowMs: number;
  proposal: Record<string, unknown>;
  side: MatchAgreementSide;
  userId: string;
}): {
  error: string | null;
  event: MatchAgreementSnapshot | null;
  next: MatchAgreementStateFields | null;
} {
  const error = resolveIdenticalProposalGate(input);
  if (error) {
    return { error, event: null, next: null };
  }

  const before = toSnapshotFields(input.current);
  const next: MatchAgreementStateFields = {
    agreedAt: input.current?.agreedAt ?? null,
    proposal: input.proposal,
    proposedAt: input.nowMs,
    proposedBySide: input.side,
    proposedByUserId: input.userId,
    state: "negotiating",
  };

  return {
    error: null,
    event: {
      after: toSnapshotFields(next),
      before,
      kind: before.state === "agreed" ? "reopened" : "proposed",
    },
    next,
  };
}

function resolveResponseGate(input: {
  current: MatchAgreementStateFields | null;
  side: MatchAgreementSide;
}): string | null {
  const current = input.current;

  if (!current || current.state === "idle" || !current.proposal) {
    return "Não há proposta para responder.";
  }
  if (current.state === "agreed") {
    return "Esse acerto já está fechado. Proponha outro para mudar.";
  }

  return current.proposedBySide === input.side
    ? "Você fez essa proposta. Espere o outro lado responder."
    : null;
}

/** Aceite do OUTRO lado: fecha o canal; o efeito no confronto é do chamador. */
export function resolveAcceptanceTransition(input: {
  current: MatchAgreementStateFields | null;
  nowMs: number;
  side: MatchAgreementSide;
}): {
  error: string | null;
  event: MatchAgreementSnapshot | null;
  next: MatchAgreementStateFields | null;
} {
  const error = resolveResponseGate({
    current: input.current,
    side: input.side,
  });

  if (error || !input.current) {
    return {
      error: error ?? "Não há proposta para responder.",
      event: null,
      next: null,
    };
  }

  const before = toSnapshotFields(input.current);
  const next: MatchAgreementStateFields = {
    ...input.current,
    agreedAt: input.nowMs,
    state: "agreed",
  };

  return {
    error: null,
    event: { after: toSnapshotFields(next), before, kind: "accepted" },
    next,
  };
}

/** Recusa: derruba a proposta vigente sem fechar o canal (dá para propor de novo). */
export function resolveDeclineTransition(input: {
  current: MatchAgreementStateFields | null;
  nowMs: number;
  side: MatchAgreementSide;
}): {
  error: string | null;
  event: MatchAgreementSnapshot | null;
  next: MatchAgreementStateFields | null;
} {
  const error = resolveResponseGate({
    current: input.current,
    side: input.side,
  });

  if (error || !input.current) {
    return {
      error: error ?? "Não há proposta para responder.",
      event: null,
      next: null,
    };
  }

  const before = toSnapshotFields(input.current);
  const next: MatchAgreementStateFields = {
    agreedAt: input.current.agreedAt,
    proposal: null,
    proposedAt: null,
    proposedBySide: null,
    proposedByUserId: null,
    state: "idle",
  };

  return {
    error: null,
    event: { after: toSnapshotFields(next), before, kind: "declined" },
    next,
  };
}

/**
 * Retirada da propria proposta: o AUTOR tira da mesa sem resposta do outro lado.
 * Mesmo destino da recusa (proposta some, canal volta a idle, `agreedAt` fica);
 * o gate e INVERTIDO — e o usuario que propos, nao o lado que responde (numa
 * dupla os dois perfis dividem o lado, entao o lado nao decide).
 */
export function resolveCancellationTransition(input: {
  current: MatchAgreementStateFields | null;
  nowMs: number;
  side: MatchAgreementSide;
  userId: string;
}): {
  error: string | null;
  event: MatchAgreementSnapshot | null;
  next: MatchAgreementStateFields | null;
} {
  const current = input.current;

  if (!current || current.state === "idle" || !current.proposal) {
    return {
      error: "Não há proposta para retirar.",
      event: null,
      next: null,
    };
  }
  if (current.state === "agreed") {
    return {
      error: "Esse acerto já está fechado. Proponha outro para mudar.",
      event: null,
      next: null,
    };
  }
  if (current.proposedByUserId !== input.userId) {
    return {
      error: "Só quem propôs pode retirar a proposta.",
      event: null,
      next: null,
    };
  }

  const before = toSnapshotFields(current);
  const next: MatchAgreementStateFields = {
    agreedAt: current.agreedAt,
    proposal: null,
    proposedAt: null,
    proposedBySide: null,
    proposedByUserId: null,
    state: "idle",
  };

  return {
    error: null,
    event: { after: toSnapshotFields(next), before, kind: "cancelled" },
    next,
  };
}

/**
 * Fim do acerto sem resposta: o organizador escreveu por cima (`overridden`) ou o
 * confronto foi decidido e o canal perdeu sentido (`closed`). Sem acerto vigente
 * não há evento — o log não registra o que não existia.
 */
export function resolveAgreementSweep(input: {
  current: MatchAgreementStateFields | null;
  kind: "closed" | "overridden";
  nowMs: number;
}): { event: MatchAgreementSnapshot; next: MatchAgreementStateFields } | null {
  const current = input.current;

  if (!current || current.state === "idle") {
    return null;
  }

  const next: MatchAgreementStateFields = {
    agreedAt: current.agreedAt,
    proposal: null,
    proposedAt: null,
    proposedBySide: null,
    proposedByUserId: null,
    state: "idle",
  };

  return {
    event: {
      after: toSnapshotFields(next),
      before: toSnapshotFields(current),
      kind: input.kind,
    },
    next,
  };
}

/** Estado do canal como as regras leem (json + timestamps viram dado plano). */
export function toAgreementStateFields(record: {
  agreedAt: Date | null | undefined;
  proposal: Record<string, unknown> | null | undefined;
  proposedAt: Date | null | undefined;
  proposedBySide: string | null | undefined;
  proposedByUserId: string | null | undefined;
  state: string;
}): MatchAgreementStateFields {
  return {
    agreedAt: record.agreedAt?.getTime() ?? null,
    proposal: record.proposal ?? null,
    proposedAt: record.proposedAt?.getTime() ?? null,
    proposedBySide:
      record.proposedBySide === "a" || record.proposedBySide === "b"
        ? record.proposedBySide
        : null,
    proposedByUserId: record.proposedByUserId
      ? (record.proposedByUserId as string)
      : null,
    state:
      record.state === "negotiating" || record.state === "agreed"
        ? record.state
        : "idle",
  };
}

/** Visão do canal para UMA das partes (o leitor nunca é espectador). */
export function buildAgreementChannelView(input: {
  current: MatchAgreementStateFields | null;
  userId: string;
}) {
  const current = input.current;

  return {
    agreedAt: current?.agreedAt ?? null,
    proposal: current?.proposal ?? null,
    proposedAt: current?.proposedAt ?? null,
    proposedByMe: Boolean(
      current?.proposal && current.proposedByUserId === input.userId
    ),
    proposedBySide: current?.proposedBySide ?? null,
    state: current?.state ?? ("idle" as const),
  };
}

/**
 * Proposta RECEBIDA e ainda sem resposta: é o que vira pendência do outro lado.
 * Proposta do próprio ator não é pendência dele. Canal já fechado antes
 * (`agreedAt`) faz o evento ser um pedido de mudança, não uma proposta nova.
 */
export function resolveReceivedAgreement(input: {
  channel: MatchAgreementChannel;
  current: MatchAgreementStateFields | null;
  userId: string;
}): ReceivedAgreement | null {
  const current = input.current;

  if (!current?.proposal) {
    return null;
  }
  if (current.state !== "negotiating") {
    return null;
  }
  if (current.proposedByUserId === input.userId) {
    return null;
  }

  return {
    channel: input.channel,
    kind: current.agreedAt === null ? "proposal" : "reopened",
  };
}

/**
 * Proposta que o evento do histórico mostra: o snapshot DEPOIS carrega a proposta
 * nova/aceita; o recusado só existe no snapshot ANTES.
 */
export function readEventProposal(input: {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
}): Record<string, unknown> | null {
  const after = input.after.proposal;
  const before = input.before.proposal;

  return (
    (after as Record<string, unknown> | null) ??
    (before as Record<string, unknown> | null) ??
    null
  );
}

/** A proposta vive como json na linha: a leitura valida com o schema do contrato. */
export function readScheduleProposal(
  raw: Record<string, unknown> | null
): MatchScheduleProposal | null {
  if (!raw) {
    return null;
  }

  const parsed = matchScheduleProposalSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}

export function readScoreProposal(
  raw: Record<string, unknown> | null
): MatchScoreProposal | null {
  if (!raw) {
    return null;
  }

  const parsed = matchScoreProposalSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}
