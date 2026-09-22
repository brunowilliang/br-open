import {
  getBestOfSetValidationError,
  NO_RESPONSE_DEADLINE_HORIZON_YEARS,
  SUPPORTED_BEST_OF_SET_COUNTS,
  type LeagueChallengeScore,
  type LeagueMatchConfig,
  type LeagueWalkoverBehavior,
  type ToggleableRule,
} from "./contract";

export { getBestOfSetValidationError, SUPPORTED_BEST_OF_SET_COUNTS };

export const ACTIVE_CHALLENGE_BLOCKING_STATUSES = new Set([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "pending_organizer_challenge_validation",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_organizer_result_validation",
  "pending_result_correction",
  "pending_organizer_decision",
] as const);

export type ActiveChallengeBlockingStatus =
  (typeof ACTIVE_CHALLENGE_BLOCKING_STATUSES extends Set<infer T> ? T : never) &
    string;

export type LeagueChallengeStatus =
  | ActiveChallengeBlockingStatus
  | "finished"
  | "declined"
  | "cancelled"
  | "invalidated";

export type LeagueChallengeValidationMode = "automatic" | "manual";
export type LeagueResultValidationMode = "automatic" | "manual";
export type LeagueChallengeWinBehavior =
  | "take_opponent_position"
  | "climb_one_position";
export type LeagueChallengeLossBehavior = "stay_put" | "drop_one_position";

type BuildResponseDeadlineInput = {
  now: Date;
  responseDeadlineHours: number;
};

type ResolveAcceptedChallengeStatusInput = {
  challengeValidationMode: LeagueChallengeValidationMode;
};

type ResolveScoreConfirmationStatusInput = {
  resultValidationMode: LeagueResultValidationMode;
};

type ResolveMissingResultStatusInput = {
  hasSubmittedResult: boolean;
  now: Date;
  scheduledEndAt: Date;
};

type CanPlayersCancelChallengeInput = {
  now: Date;
  scheduledStartAt: Date;
};

type ApplyChallengeResultToRankingInput = {
  challengedMembershipId: string;
  challengerMembershipId: string;
  lossBehavior: LeagueChallengeLossBehavior;
  rankingMembershipIds: string[];
  // W.O. results shift the loser per the league's walkoverBehavior:
  // automatic_loss keeps the standard loss effect, automatic_loss_and_move_to_end
  // also sends the loser to the end of the ranking. Absent on played results.
  walkover?: boolean;
  walkoverBehavior?: LeagueWalkoverBehavior;
  winBehavior: LeagueChallengeWinBehavior;
  winnerMembershipId: string;
};

type ResolveReopenedChallengeStatusInput = {
  challengerMembershipId: string;
  proposedByMembershipId: string;
};

type ValidateChallengeScoreInput = {
  challengedMembershipId: string;
  challengerMembershipId: string;
  matchConfig: LeagueMatchConfig;
  score: LeagueChallengeScore;
};

type ResolveChallengeCreationRuleErrorInput = {
  challengedActiveChallengeCount: number;
  challengedMembershipId: string;
  challengedPosition?: null | number;
  challengerActiveChallengeCount: number;
  challengerCreatedThisMonthCount: number;
  challengerMembershipId: string;
  challengerPosition?: null | number;
  maxActiveChallengesPerPlayer: number;
  maxChallengeDistance: number;
  maxChallengesPerMonth: number;
};

type ResolveConfirmedChallengeResultInput = ValidateChallengeScoreInput & {
  lossBehavior: LeagueChallengeLossBehavior;
  rankingMembershipIds: string[];
  resultValidationMode: LeagueResultValidationMode;
  winBehavior: LeagueChallengeWinBehavior;
};

type ResolveChallengeRankingRestoreInput = {
  currentRankingMembershipIds: string[];
  hasRankingApplied: boolean;
  rankingSnapshotAfterResult?: unknown;
  rankingSnapshotBeforeResult?: unknown;
};

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MISSING_RANKING_RESTORE_SNAPSHOT_ERROR =
  "Esse resultado não possui um snapshot seguro para reabrir o ranking.";
const CHANGED_RANKING_RESTORE_SNAPSHOT_ERROR =
  "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.";

function moveItem(
  items: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isSameOrderedList(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

export function buildResponseDeadline(input: BuildResponseDeadlineInput) {
  return new Date(
    input.now.getTime() + input.responseDeadlineHours * MILLISECONDS_PER_HOUR
  );
}

type ResolveResponseDeadlineInput = {
  now: Date;
  rule: ToggleableRule<number>;
};

export function resolveResponseDeadline(
  input: ResolveResponseDeadlineInput
): Date {
  if (!input.rule.enabled) {
    const farFuture = new Date(input.now);
    farFuture.setUTCFullYear(
      farFuture.getUTCFullYear() + NO_RESPONSE_DEADLINE_HORIZON_YEARS
    );
    return farFuture;
  }

  return buildResponseDeadline({
    now: input.now,
    responseDeadlineHours: input.rule.value,
  });
}

export function resolveAcceptedChallengeStatus(
  input: ResolveAcceptedChallengeStatusInput
) {
  return input.challengeValidationMode === "manual"
    ? "pending_organizer_challenge_validation"
    : "confirmed";
}

export function resolveScoreConfirmationStatus(
  input: ResolveScoreConfirmationStatusInput
) {
  return input.resultValidationMode === "manual"
    ? "pending_organizer_result_validation"
    : "finished";
}

export function resolveNoResponseStatus() {
  return "pending_organizer_decision";
}

export function resolveMissingResultStatus(
  input: ResolveMissingResultStatusInput
) {
  if (input.hasSubmittedResult || input.now < input.scheduledEndAt) {
    return null;
  }

  return "pending_result_submission";
}

export function canPlayersCancelChallenge(
  input: CanPlayersCancelChallengeInput
) {
  return input.now < input.scheduledStartAt;
}

export function resolveChallengeCreationRuleError(
  input: ResolveChallengeCreationRuleErrorInput
) {
  if (input.challengedMembershipId === input.challengerMembershipId) {
    return "Você não pode desafiar a si mesmo.";
  }

  if (!(input.challengerPosition && input.challengedPosition)) {
    return "O ranking da liga está incompleto para abrir esse desafio.";
  }

  if (input.challengerPosition <= input.challengedPosition) {
    return "Você só pode desafiar jogadores acima da sua posição.";
  }

  if (
    input.challengerPosition - input.challengedPosition >
    input.maxChallengeDistance
  ) {
    return "Esse desafio ultrapassa a distância máxima permitida.";
  }

  if (
    input.challengerActiveChallengeCount >= input.maxActiveChallengesPerPlayer
  ) {
    return "Você já atingiu o limite de desafios ativos.";
  }

  if (
    input.challengedActiveChallengeCount >= input.maxActiveChallengesPerPlayer
  ) {
    return "O adversário já atingiu o limite de desafios ativos.";
  }

  if (input.challengerCreatedThisMonthCount >= input.maxChallengesPerMonth) {
    return "Você já atingiu o limite mensal de desafios.";
  }

  return null;
}

/**
 * Resolve o vencedor de um resultado MANUAL livre: cada linha vale 1 ponto
 * (mais games vence; linha EMPATADA em games vai ao tie-break ANEXO — mais
 * pontos de TB vence a linha, e TB empatado ou ausente = linha de ninguém) e
 * quem vence mais linhas leva a partida. Empate total NÃO decide sozinho: aí
 * o payload precisa mandar o vencedor explícito (winnerMembershipId), e a
 * resolução final exige exatamente 1 vencedor — derivado OU explícito
 * coerente. Sanidade apenas: inteiros >= 0 e pelo menos 1 linha.
 */
export function resolveChallengeScoreOutcome(input: {
  challengedMembershipId: string;
  challengerMembershipId: string;
  score: LeagueChallengeScore;
}):
  | { error: null; winnerMembershipId: string }
  | { error: string; winnerMembershipId: null } {
  const { sets } = input.score;

  if (sets.length === 0) {
    return {
      error: "Informe pelo menos uma linha do placar.",
      winnerMembershipId: null,
    };
  }

  for (const set of sets) {
    const values = [
      set.challengerGames,
      set.challengedGames,
      set.tieBreak?.challengerPoints ?? 0,
      set.tieBreak?.challengedPoints ?? 0,
    ];
    if (values.some((value) => !Number.isInteger(value) || value < 0)) {
      return { error: "Placar inválido.", winnerMembershipId: null };
    }
  }

  let challengerLines = 0;
  let challengedLines = 0;
  for (const set of sets) {
    if (set.challengerGames > set.challengedGames) {
      challengerLines += 1;
      continue;
    }
    if (set.challengedGames > set.challengerGames) {
      challengedLines += 1;
      continue;
    }
    // Linha empatada em games: o tie-break ANEXO decide (mais pontos vence
    // a linha; TB empatado = linha de ninguém).
    if (!set.tieBreak) {
      continue;
    }
    if (set.tieBreak.challengerPoints > set.tieBreak.challengedPoints) {
      challengerLines += 1;
    } else if (set.tieBreak.challengedPoints > set.tieBreak.challengerPoints) {
      challengedLines += 1;
    }
  }

  const derivedWinnerId =
    challengerLines === challengedLines
      ? null
      : challengerLines > challengedLines
        ? input.challengerMembershipId
        : input.challengedMembershipId;
  const explicitWinnerId = input.score.winnerMembershipId ?? null;

  if (
    explicitWinnerId !== null &&
    explicitWinnerId !== input.challengerMembershipId &&
    explicitWinnerId !== input.challengedMembershipId
  ) {
    return {
      error: "O vencedor informado não participa dessa partida.",
      winnerMembershipId: null,
    };
  }

  if (
    derivedWinnerId !== null &&
    explicitWinnerId !== null &&
    derivedWinnerId !== explicitWinnerId
  ) {
    return {
      error: "O vencedor informado não corresponde ao resultado.",
      winnerMembershipId: null,
    };
  }

  const winnerMembershipId = derivedWinnerId ?? explicitWinnerId;
  if (winnerMembershipId === null) {
    return {
      error: "O placar não define o vencedor; informe o vencedor do confronto.",
      winnerMembershipId: null,
    };
  }

  return { error: null, winnerMembershipId };
}

/**
 * Valida um resultado de W.O. de desafio: o vencedor precisa ser um dos lados
 * e o placar, exatamente o placeholder de um set zerado. Com `cancel_challenge`
 * a liga desliga W.O. — o desafio deve ser cancelado em vez de encerrado.
 */
export function resolveWalkoverScoreError(input: {
  challengedMembershipId: string;
  challengerMembershipId: string;
  score: LeagueChallengeScore;
  walkoverBehavior: LeagueWalkoverBehavior;
}): string | null {
  if (!input.score.walkover) {
    return null;
  }

  if (input.walkoverBehavior === "cancel_challenge") {
    return "Essa liga trata W.O. como cancelamento. Cancele o desafio em vez de lançar resultado.";
  }

  if (
    input.score.winnerMembershipId !== input.challengerMembershipId &&
    input.score.winnerMembershipId !== input.challengedMembershipId
  ) {
    return "O vencedor do W.O. precisa ser um dos participantes do desafio.";
  }

  if (input.score.sets.length !== 1) {
    return "Em W.O. não há resultado por sets.";
  }

  const placeholderSet = input.score.sets[0];
  if (
    placeholderSet &&
    (placeholderSet.challengedGames !== 0 ||
      placeholderSet.challengerGames !== 0 ||
      // nullish contract: null counts as unset (same rule as the rest).
      Boolean(placeholderSet.tieBreak))
  ) {
    return "Em W.O. não há resultado por sets.";
  }

  return null;
}

export function resolveConfirmedChallengeResult(
  input: ResolveConfirmedChallengeResultInput
) {
  const outcome = resolveChallengeScoreOutcome({
    challengedMembershipId: input.challengedMembershipId,
    challengerMembershipId: input.challengerMembershipId,
    score: input.score,
  });

  if (outcome.error !== null) {
    return {
      error: outcome.error,
      ok: false,
    } as const;
  }

  const winnerMembershipId = outcome.winnerMembershipId;

  const nextStatus = resolveScoreConfirmationStatus({
    resultValidationMode: input.resultValidationMode,
  });

  return {
    nextStatus,
    ok: true,
    rankingMembershipIds:
      nextStatus === "finished"
        ? applyChallengeResultToRanking({
            challengedMembershipId: input.challengedMembershipId,
            challengerMembershipId: input.challengerMembershipId,
            lossBehavior: input.lossBehavior,
            rankingMembershipIds: input.rankingMembershipIds,
            winBehavior: input.winBehavior,
            winnerMembershipId,
          })
        : null,
    winnerMembershipId,
  } as const;
}

export function resolveChallengeRankingRestore(
  input: ResolveChallengeRankingRestoreInput
) {
  const { rankingSnapshotAfterResult, rankingSnapshotBeforeResult } = input;

  if (
    !(
      input.hasRankingApplied &&
      isStringArray(rankingSnapshotAfterResult) &&
      isStringArray(rankingSnapshotBeforeResult)
    )
  ) {
    return {
      error: MISSING_RANKING_RESTORE_SNAPSHOT_ERROR,
      ok: false,
    } as const;
  }

  if (
    !isSameOrderedList(
      input.currentRankingMembershipIds,
      rankingSnapshotAfterResult
    )
  ) {
    return {
      error: CHANGED_RANKING_RESTORE_SNAPSHOT_ERROR,
      ok: false,
    } as const;
  }

  return {
    ok: true,
    rankingMembershipIds: rankingSnapshotBeforeResult,
  } as const;
}

export function isChallengeSlotBlocked(status: LeagueChallengeStatus) {
  return ACTIVE_CHALLENGE_BLOCKING_STATUSES.has(
    status as ActiveChallengeBlockingStatus
  );
}

export function applyChallengeResultToRanking(
  input: ApplyChallengeResultToRankingInput
) {
  const challengerIndex = input.rankingMembershipIds.indexOf(
    input.challengerMembershipId
  );
  const challengedIndex = input.rankingMembershipIds.indexOf(
    input.challengedMembershipId
  );

  if (challengerIndex === -1 || challengedIndex === -1) {
    return input.rankingMembershipIds;
  }

  let nextRanking: string[];

  if (input.winnerMembershipId === input.challengerMembershipId) {
    if (input.winBehavior === "climb_one_position") {
      nextRanking = moveItem(
        input.rankingMembershipIds,
        challengerIndex,
        Math.max(0, challengerIndex - 1)
      );
    } else {
      nextRanking = [...input.rankingMembershipIds];
      nextRanking[challengedIndex] = input.challengerMembershipId;
      nextRanking[challengerIndex] = input.challengedMembershipId;
    }
  } else if (input.lossBehavior === "drop_one_position") {
    nextRanking = moveItem(
      input.rankingMembershipIds,
      challengerIndex,
      Math.min(input.rankingMembershipIds.length - 1, challengerIndex + 1)
    );
  } else {
    nextRanking = input.rankingMembershipIds;
  }

  if (
    input.walkover &&
    input.walkoverBehavior === "automatic_loss_and_move_to_end"
  ) {
    const loserMembershipId =
      input.winnerMembershipId === input.challengerMembershipId
        ? input.challengedMembershipId
        : input.challengerMembershipId;

    return [
      ...nextRanking.filter((id) => id !== loserMembershipId),
      loserMembershipId,
    ];
  }

  return nextRanking;
}

export function resolveReopenedChallengeStatus(
  input: ResolveReopenedChallengeStatusInput
) {
  return input.proposedByMembershipId === input.challengerMembershipId
    ? "pending_opponent_response"
    : "pending_creator_reapproval";
}
