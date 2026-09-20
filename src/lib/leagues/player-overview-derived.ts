import type { ApiOutputs } from "@convex/shared/api";

import { DAY_MS } from "@/lib/format/relative-time";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

type RuleConfig = LeagueOverview["ruleConfig"];

export type PlayerPositionCard = {
  position: number;
  totalPlayers: number;
};

export type PlayerInactiveAlertCard = {
  daysSinceLastMatch: number;
  daysUntilPenalty: number;
  /** "danger" quando já passou do prazo; "warning" quando próximo. */
  severity: "danger" | "warning";
};

export type PendingChallengeAction = {
  /** Quem precisa agir é o viewer. Determina a mensagem. */
  kind: "confirm_result" | "register_result" | "request_correction";
  opponentName: string;
};

export type PlayerPendingActionsAlert = {
  actions: PendingChallengeAction[];
  total: number;
};

/** Janela de alerta: quando faltam esse número de dias (ou menos) para a punição. */
const WARNING_WINDOW_DAYS = 7;

function isViewerChallenge(
  challenge: ChallengeItem,
  viewerMembershipId: string
) {
  return (
    challenge.challenger.membershipId === viewerMembershipId ||
    challenge.challenged.membershipId === viewerMembershipId
  );
}

function isFinished(challenge: ChallengeItem) {
  return challenge.status === "finished";
}

/**
 * Retorna o lado do viewer no desafio, ou null se não participa.
 */
function getViewerSide(
  challenge: ChallengeItem,
  viewerMembershipId: string
): "challenged" | "challenger" | null {
  if (challenge.challenger.membershipId === viewerMembershipId) {
    return "challenger";
  }

  if (challenge.challenged.membershipId === viewerMembershipId) {
    return "challenged";
  }

  return null;
}

function getOpponentName(challenge: ChallengeItem, viewerMembershipId: string) {
  const viewerIsChallenger =
    challenge.challenger.membershipId === viewerMembershipId;
  const opponent = viewerIsChallenger
    ? challenge.challenged
    : challenge.challenger;
  return opponent.player.fullName;
}

export function buildPlayerPositionCard(input: {
  rankingItemsCount: number;
  viewerPosition: null | number;
}): PlayerPositionCard | null {
  if (input.viewerPosition === null) {
    return null;
  }

  return {
    position: input.viewerPosition,
    totalPlayers: input.rankingItemsCount,
  };
}

export function buildPlayerInactiveAlertCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ruleConfig: RuleConfig;
  viewerMembershipId: null | string;
}): PlayerInactiveAlertCard | null {
  // Regra de ouro: se a liga não aplica penalidade, não há alerta.
  if (!input.ruleConfig.hasInactivityPenalty) {
    return null;
  }

  if (!input.viewerMembershipId) {
    return null;
  }

  const penaltyDays = input.ruleConfig.inactivityPenaltyDays ?? 0;

  if (penaltyDays <= 0) {
    return null;
  }

  const lastMatchTimestamp = input.challenges
    .filter(
      (challenge) =>
        isFinished(challenge) &&
        challenge.finishedAt &&
        isViewerChallenge(challenge, input.viewerMembershipId as string)
    )
    .map((challenge) => challenge.finishedAt ?? 0)
    .sort((a, b) => b - a)[0];

  // Sem nenhuma partida: considera a partir de "agora" (0 dias desde).
  const daysSinceLastMatch = lastMatchTimestamp
    ? Math.floor((input.now - lastMatchTimestamp) / DAY_MS)
    : 0;

  const daysUntilPenalty = penaltyDays - daysSinceLastMatch;
  const severity: PlayerInactiveAlertCard["severity"] =
    daysUntilPenalty <= 0 ? "danger" : "warning";

  // Quando ainda há folga suficiente (mais de WARNING_WINDOW_DAYS), não vale o
  // alerta — só mostramos quando o risco é real.
  if (daysUntilPenalty > WARNING_WINDOW_DAYS) {
    return null;
  }

  return {
    daysSinceLastMatch,
    daysUntilPenalty,
    severity,
  };
}

function resolvePendingAction(
  challenge: ChallengeItem,
  viewerMembershipId: string
): PendingChallengeAction | null {
  const side = getViewerSide(challenge, viewerMembershipId);

  if (!side) {
    return null;
  }

  const opponentName = getOpponentName(challenge, viewerMembershipId);
  const viewerSubmitted =
    challenge.latestResultSubmission?.submittedByMembershipId ===
    viewerMembershipId;

  switch (challenge.status) {
    // O jogo acabou e ninguém lançou placar ainda → qualquer lado age.
    case "pending_result_submission":
      return { kind: "register_result", opponentName };

    // O adversário lançou o resultado → o viewer (que não lançou) confirma.
    case "pending_result_confirmation":
      return viewerSubmitted ? null : { kind: "confirm_result", opponentName };

    // O adversário pediu correção do placar → o viewer revisa.
    case "pending_result_correction":
      return { kind: "request_correction", opponentName };

    default:
      return null;
  }
}

export function buildPlayerPendingActionsAlert(input: {
  challenges: ChallengeItem[];
  viewerMembershipId: null | string;
}): PlayerPendingActionsAlert | null {
  if (!input.viewerMembershipId) {
    return null;
  }

  const actions = input.challenges
    .map((challenge) =>
      resolvePendingAction(challenge, input.viewerMembershipId as string)
    )
    .filter((action): action is PendingChallengeAction => action !== null);

  if (actions.length === 0) {
    return null;
  }

  return {
    actions,
    total: actions.length,
  };
}

// ---------------------------------------------------------------------------
// Charts do jogador (PLN-0007 FASE 2): V/D por mês e win rate, derivados
// dos desafios FINALIZADOS com resultado. Vencedor vem do submission
// (`winnerMembershipId` persistido já resolvido pelo servidor, inclusive
// para W.O. e placar que decide).
// ---------------------------------------------------------------------------

export type PlayerMonthlyWinLossPoint = {
  losses: number;
  month: string;
  wins: number;
};

const WIN_LOSS_MONTHS = 6;

/** Últimos 6 meses (mês corrente incluso, ordem cronológica) com V/D do
 * viewer. Meses sem partida entram com zero — a série alimenta o texto de
 * "Partidas no mês" (última linha = mês corrente). */
export function buildPlayerMonthlyWinLoss(input: {
  challenges: ChallengeItem[];
  now: number;
  viewerMembershipId: null | string;
}): PlayerMonthlyWinLossPoint[] {
  if (!input.viewerMembershipId) {
    return [];
  }

  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const cursor = new Date(input.now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  const windows: Array<{
    label: string;
    losses: number;
    startMs: number;
    wins: number;
  }> = [];

  for (let index = WIN_LOSS_MONTHS - 1; index >= 0; index -= 1) {
    const windowStart = new Date(cursor);
    windowStart.setMonth(cursor.getMonth() - index);

    windows.push({
      label: monthFormatter.format(windowStart),
      losses: 0,
      startMs: windowStart.getTime(),
      wins: 0,
    });
  }

  for (const challenge of input.challenges) {
    if (
      !isFinished(challenge) ||
      challenge.finishedAt === null ||
      challenge.finishedAt === undefined
    ) {
      continue;
    }
    if (
      !(
        isViewerChallenge(challenge, input.viewerMembershipId) &&
        challenge.latestResultSubmission
      )
    ) {
      continue;
    }

    const window = [...windows]
      .reverse()
      .find((candidate) => challenge.finishedAt! >= candidate.startMs);

    if (!window) {
      continue;
    }

    const isWin =
      challenge.latestResultSubmission.winnerMembershipId ===
      input.viewerMembershipId;

    if (isWin) {
      window.wins += 1;
    } else {
      window.losses += 1;
    }
  }

  return windows.map(({ label, losses, wins }) => ({
    losses,
    month: label,
    wins,
  }));
}

export type PlayerWinRate = {
  losses: number;
  total: number;
  wins: number;
};

/** Win rate do viewer em TODOS os desafios finalizados com resultado da
 * liga (base do texto "Desempenho", `XV · YD`). Sem nenhuma partida:
 * total 0 (renderiza "0V · 0D"). */
export function buildPlayerWinRate(input: {
  challenges: ChallengeItem[];
  viewerMembershipId: null | string;
}): PlayerWinRate {
  if (!input.viewerMembershipId) {
    return { losses: 0, total: 0, wins: 0 };
  }

  let losses = 0;
  let wins = 0;

  for (const challenge of input.challenges) {
    if (
      !(
        isFinished(challenge) &&
        isViewerChallenge(challenge, input.viewerMembershipId) &&
        challenge.latestResultSubmission
      )
    ) {
      continue;
    }

    if (
      challenge.latestResultSubmission.winnerMembershipId ===
      input.viewerMembershipId
    ) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  return { losses, total: wins + losses, wins };
}
