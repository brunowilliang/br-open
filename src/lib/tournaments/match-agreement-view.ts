import type { ApiOutputs } from "@convex/shared/api";

import type { ScoreSet } from "@/lib/matches/score-display";

import {
  canProposeMatchAgreementScore,
  isProposalFromMySide,
  resolveMatchAgreementMenuActions,
  type MatchAgreementAction,
  type MatchAgreementChannelFacts,
} from "./match-agreement-actions";
import { MATCH_AGREEMENT_COPY } from "./match-agreement-copy";
import { walkoverWinnerSide } from "./tournament-details-derived";

// ---------------------------------------------------------------------------
// Acerto do confronto: o que o CARD mostra (dado -> dado)
// ---------------------------------------------------------------------------
// O servidor manda a leitura do viewer (`proposedByMe`, `proposedBySide`) e o
// lado dele (`mySide`): a autoria da tela é do LADO, nunca de id de usuário.

export type PlayerMatch =
  ApiOutputs["tournament"]["agreements"]["listMyMatches"][number];
/** Ordem dos lados no card: `match` desenha o lado A do confronto primeiro (a
 * chave e a agenda) e `viewer`, o lado do próprio jogador (home e painel). */
export type MatchAgreementSideOrder = "match" | "viewer";

/** O canal leva o estado no CHIP (padrão das ligas): o mesmo chip vale para
 * os dois lados, e o que muda de lado é o menu. */
type PlayerAgreementChip = {
  color: "accent" | "default" | "success" | "warning";
  label: string;
  variant: "soft";
};

/**
 * Chip do card: ele SUBSTITUI o chip de status (nunca convivem). Resultado
 * publicado ou jogo decidido não deixam chip daqui: quem conta o desfecho é o
 * chip de status (Encerrado, W.O.). Sem nada em negociação, também não há chip.
 */
export function buildPlayerAgreementChip(input: {
  playerMatch: PlayerMatch;
}): PlayerAgreementChip | null {
  const { agreements, match } = input.playerMatch;

  if (
    match.status === "finished" ||
    match.winnerEntryId !== null ||
    agreements.score.state === "agreed"
  ) {
    return null;
  }

  // Autoria do LADO: a dupla de quem propôs lê "enviada", não "confirmar".
  const mySide = input.playerMatch.mySide;
  const scoreFromMySide = isProposalFromMySide({
    mySide,
    proposedBySide: agreements.score.proposedBySide,
  });
  const scheduleFromMySide = isProposalFromMySide({
    mySide,
    proposedBySide: agreements.schedule.proposedBySide,
  });

  if (agreements.score.proposal !== null) {
    // `agreedAt` preenchido com o canal negociando de novo é pedido de mudança
    // do combinado (o servidor chama de reaberto), não proposta nova.
    if (agreements.score.agreedAt !== null) {
      return scoreFromMySide
        ? {
            color: "warning",
            label: MATCH_AGREEMENT_COPY.chipReapproval,
            variant: "soft",
          }
        : {
            color: "accent",
            label: MATCH_AGREEMENT_COPY.chipConfirmResult,
            variant: "soft",
          };
    }

    return scoreFromMySide
      ? {
          color: "warning",
          label: MATCH_AGREEMENT_COPY.chipResultSent,
          variant: "soft",
        }
      : {
          color: "accent",
          label: MATCH_AGREEMENT_COPY.chipConfirmResult,
          variant: "soft",
        };
  }

  if (agreements.schedule.state === "agreed") {
    return {
      color: "warning",
      label: MATCH_AGREEMENT_COPY.chipPendingResult,
      variant: "soft",
    };
  }

  if (agreements.schedule.proposal !== null) {
    if (agreements.schedule.agreedAt !== null) {
      return scheduleFromMySide
        ? {
            color: "warning",
            label: MATCH_AGREEMENT_COPY.chipReapproval,
            variant: "soft",
          }
        : {
            color: "accent",
            label: MATCH_AGREEMENT_COPY.chipConfirmSchedule,
            variant: "soft",
          };
    }

    return scheduleFromMySide
      ? {
          color: "warning",
          label: MATCH_AGREEMENT_COPY.chipProposalSent,
          variant: "soft",
        }
      : {
          color: "accent",
          label: MATCH_AGREEMENT_COPY.chipConfirmSchedule,
          variant: "soft",
        };
  }

  return null;
}

/** Proposta de horário NA MESA (canal negociando): o rodapé do card mostra ela
 * com a cor de atenção, porque proposta ainda não é agendamento. */
export function buildPlayerAgreementScheduleProposal(input: {
  courts: readonly { id: string; name: string }[];
  playerMatch: PlayerMatch;
}): {
  courtName: null | string;
  matchDate: string;
  startMinute: number;
} | null {
  const { schedule } = input.playerMatch.agreements;

  if (schedule.state !== "negotiating" || schedule.proposal === null) {
    return null;
  }

  const { courtId, matchDate, startMinute } = schedule.proposal;

  return {
    courtName: courtId
      ? (input.courts.find((court) => court.id === courtId)?.name ?? null)
      : null,
    matchDate,
    startMinute,
  };
}

/** Placar proposto NA MESA (canal negociando): o card pinta o vencedor dele
 * como no publicado. W.O. não tem placar jogado (o payload traz um set
 * placeholder): vira só o vencedor, que o card desenha como no W.O. publicado. */
export function buildPlayerAgreementScoreProposal(input: {
  playerMatch: PlayerMatch;
  sideOrder: MatchAgreementSideOrder;
}): { sets: ScoreSet[]; walkoverWinner: "a" | "b" | null } | null {
  const { score } = input.playerMatch.agreements;

  if (score.state !== "negotiating" || score.proposal === null) {
    return null;
  }

  // O payload vem na ordem do confronto (a = entryA): com o viewer desenhado
  // primeiro, o lado dele inverte.
  const flips =
    input.sideOrder === "viewer" && input.playerMatch.mySide === "b";

  if (score.proposal.walkover) {
    return {
      sets: [],
      walkoverWinner: flipSide(
        resolveProposalWinnerSide(input.playerMatch),
        flips
      ),
    };
  }

  return {
    sets: flips
      ? score.proposal.score.sets.map(flipScoreSet)
      : [...score.proposal.score.sets],
    walkoverWinner: null,
  };
}

/** Lado que venceu o W.O. proposto, na ordem do confronto. */
function resolveProposalWinnerSide(playerMatch: PlayerMatch): "a" | "b" | null {
  const winnerEntryId =
    playerMatch.agreements.score.proposal?.score.winnerEntryId ?? null;

  if (winnerEntryId === null) {
    return null;
  }

  if (winnerEntryId === playerMatch.match.entryAId) {
    return "a";
  }

  return winnerEntryId === playerMatch.match.entryBId ? "b" : null;
}

/** W.O. que está na MESA (entry id do vencedor): a proposta vigente manda e, sem
 * ela, vale o resultado já publicado. `null` = não é W.O. — o diálogo de enviar
 * outro resultado usa isso para recusar reenviar o mesmo vencedor. */
export function resolveTableWalkoverWinnerEntryId(
  playerMatch: PlayerMatch
): null | string {
  const proposal = playerMatch.agreements.score.proposal;

  if (proposal?.walkover) {
    return proposal.score.winnerEntryId ?? null;
  }

  if (proposal !== null) {
    return null;
  }

  const side = walkoverWinnerSide(playerMatch.match);

  if (side === null) {
    return null;
  }

  return side === "a" ? playerMatch.match.entryAId : playerMatch.match.entryBId;
}

function flipScoreSet(set: ScoreSet): ScoreSet {
  return {
    aGames: set.bGames,
    bGames: set.aGames,
    kind: set.kind,
    ...(set.tieBreak
      ? {
          tieBreak: {
            aPoints: set.tieBreak.bPoints,
            bPoints: set.tieBreak.aPoints,
          },
        }
      : {}),
  };
}

function flipSide(side: "a" | "b" | null, flips: boolean): "a" | "b" | null {
  if (!flips || side === null) {
    return side;
  }

  return side === "a" ? "b" : "a";
}

/** Confronto que ainda aceita acerto: os dois lados definidos e sem resultado.
 * Vaga bye (`walkover`) e lado em aberto ficam de fora. */
function isNegotiablePlayerMatch(playerMatch: PlayerMatch): boolean {
  const { match } = playerMatch;

  return (
    (match.status === "pending" || match.status === "scheduled") &&
    match.winnerEntryId === null &&
    match.entryAId !== null &&
    match.entryBId !== null
  );
}

/** Todos os confrontos que o jogador ainda pode combinar, na ordem do mais
 * próximo: rodada crescente e, dentro dela, o agendado antes do indefinido.
 * `sort` sobre a cópia, não `toSorted`: o Hermes do app não tem o método novo. */
export function selectNegotiablePlayerMatches(
  matches: readonly PlayerMatch[]
): PlayerMatch[] {
  return matches
    .filter((playerMatch) => isNegotiablePlayerMatch(playerMatch))
    .slice()
    .sort(
      (a, b) =>
        a.match.round - b.match.round ||
        (a.match.matchDate ?? "").localeCompare(b.match.matchDate ?? "")
    );
}

/** O acerto não aceita mais escrita: torneio encerrado/cancelado, confronto
 * decidido ou já com resultado (o servidor recusa por cima dos três). */
export function isMatchAgreementLocked(input: {
  matchStatus: string;
  tournamentStatus: null | string;
  winnerEntryId: null | string;
}): boolean {
  return (
    input.tournamentStatus === "finished" ||
    input.tournamentStatus === "cancelled" ||
    input.matchStatus === "finished" ||
    input.winnerEntryId !== null
  );
}

/**
 * Verbos do menu do jogador, por LADO (`mySide` + `proposedBySide`): a dupla de
 * quem propôs não responde e a retirada fica com o AUTOR. O menu mostra UMA
 * coisa por vez (o canal ativo, ver `resolveMatchAgreementMenuActions`) e sem
 * item nenhum o card fica sem o ⋮.
 */
export function buildPlayerAgreementMenu(input: {
  isMatchLocked: boolean;
  playerMatch: PlayerMatch;
  tournamentStatus: null | string;
}): MatchAgreementAction[] {
  if (input.isMatchLocked) {
    return [];
  }

  const { agreements, mySide } = input.playerMatch;

  return resolveMatchAgreementMenuActions({
    canProposeScore: canProposeMatchAgreementScore(input.tournamentStatus),
    schedule: toChannelFacts(agreements.schedule, mySide),
    score: toChannelFacts(agreements.score, mySide),
  });
}

function toChannelFacts(
  view: {
    proposal: unknown;
    proposedByMe: boolean;
    proposedBySide: null | "a" | "b";
    state: string;
  },
  mySide: "a" | "b"
): MatchAgreementChannelFacts {
  return {
    hasProposal: view.proposal !== null,
    proposedByMe: view.proposedByMe,
    proposedByMySide: isProposalFromMySide({
      mySide,
      proposedBySide: view.proposedBySide,
    }),
    state: view.state,
  };
}
