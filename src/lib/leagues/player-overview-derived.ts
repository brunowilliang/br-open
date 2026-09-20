import type { ApiOutputs } from "@convex/shared/api";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type PlayerPositionCard = {
  position: number;
  totalPlayers: number;
};

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
  /** Aproveitamento do viewer no recorte (0..1), MESMO shape do
   * `player.dashboard.getOverview.performance.winRate`; sem partida decidida
   * = 0. Alimenta o KPI "Aproveitamento" da casa da liga. */
  rate: number;
  total: number;
  wins: number;
};

/** Win rate do viewer em TODOS os desafios finalizados com resultado da
 * liga (base dos KPIs "Vitórias", "Derrotas" e "Aproveitamento" da casa da
 * liga). Sem nenhuma partida: total 0 e rate 0. */
export function buildPlayerWinRate(input: {
  challenges: ChallengeItem[];
  viewerMembershipId: null | string;
}): PlayerWinRate {
  if (!input.viewerMembershipId) {
    return { losses: 0, rate: 0, total: 0, wins: 0 };
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

  const total = wins + losses;

  // Mesma matemática do backend (`player/dashboard.ts`: `wins / decided`),
  // pra o KPI bater com o da home sem formatação nova no cliente.
  return { losses, rate: total > 0 ? wins / total : 0, total, wins };
}
