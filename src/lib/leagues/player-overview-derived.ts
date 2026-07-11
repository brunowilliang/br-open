import type { ApiOutputs } from "@convex/shared/api";

import { getMonthStartMs } from "@/lib/format/date";
import { DAY_MS, formatRelativeDay } from "@/lib/format/relative-time";

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

export type PlayerMonthlyMatchesCard = {
  finishedCount: number;
};

export type PlayerLastMatchCard = {
  isWin: boolean;
  opponentName: string;
  scoreSummary: string;
  whenLabel: string;
};

export type PlayerMonthlyChallengesCard = {
  createdCount: number;
  /** null quando a regra está desabilitada ("sem limite"). */
  max: null | number;
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

type ChallengeResult = NonNullable<ChallengeItem["latestResultSubmission"]>;
type ChallengeScore = ChallengeResult["score"];

function formatScoreSets(sets: ChallengeScore["sets"]) {
  return sets
    .map((set) => `${set.challengerGames}-${set.challengedGames}`)
    .join(", ");
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

export function buildPlayerMonthlyMatchesCard(input: {
  challenges: ChallengeItem[];
  now: number;
  viewerMembershipId: null | string;
}): PlayerMonthlyMatchesCard | null {
  if (!input.viewerMembershipId) {
    return null;
  }

  const monthStartMs = getMonthStartMs(input.now);

  const finishedCount = input.challenges.filter((challenge) => {
    if (!(isFinished(challenge) && challenge.finishedAt)) {
      return false;
    }

    return (
      isViewerChallenge(challenge, input.viewerMembershipId as string) &&
      challenge.finishedAt >= monthStartMs
    );
  }).length;

  return { finishedCount };
}

export function buildPlayerLastMatchCard(input: {
  challenges: ChallengeItem[];
  now: number;
  viewerMembershipId: null | string;
}): PlayerLastMatchCard | null {
  if (!input.viewerMembershipId) {
    return null;
  }

  const viewerFinished = input.challenges
    .filter(
      (challenge) =>
        isFinished(challenge) &&
        challenge.finishedAt &&
        challenge.latestResultSubmission &&
        isViewerChallenge(challenge, input.viewerMembershipId as string)
    )
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  const last = viewerFinished[0];

  if (!last?.latestResultSubmission) {
    return null;
  }

  const viewerIsChallenger =
    last.challenger.membershipId === input.viewerMembershipId;
  const opponent = viewerIsChallenger ? last.challenged : last.challenger;
  const result = last.latestResultSubmission;
  const isWin = result.winnerMembershipId === input.viewerMembershipId;

  return {
    isWin,
    opponentName: opponent.player.fullName,
    scoreSummary: formatScoreSets(result.score.sets),
    whenLabel: formatRelativeDay(
      last.finishedAt ?? result.submittedAt,
      input.now
    ),
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

export function buildPlayerMonthlyChallengesCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ruleConfig: RuleConfig;
  viewerMembershipId: null | string;
}): PlayerMonthlyChallengesCard | null {
  if (!input.viewerMembershipId) {
    return null;
  }

  const monthStartMs = getMonthStartMs(input.now);

  // Conta desafios CRIADOS pelo viewer (ele é o challenger) neste mês,
  // independente do status — a cota mensal consome ao criar.
  const createdCount = input.challenges.filter((challenge) => {
    if (challenge.challenger.membershipId !== input.viewerMembershipId) {
      return false;
    }

    return challenge.createdAt >= monthStartMs;
  }).length;

  const { maxChallengesPerMonth } = input.ruleConfig;

  return {
    createdCount,
    max: maxChallengesPerMonth.enabled ? maxChallengesPerMonth.value : null,
  };
}

/**
 * Mapeia o status do desafio para a ação que o viewer precisa tomar, quando
 * ele é o responsável. Retorna null quando o status não exige ação do viewer
 * (ex.: esperando adversário ou admin).
 */
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
