import {
  NO_RESPONSE_DEADLINE_HORIZON_YEARS,
  type LeagueChallengeScore,
  type LeagueMatchConfig,
  type ToggleableRule,
} from "./contract";

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
  winBehavior: LeagueChallengeWinBehavior;
  winnerMembershipId: string;
};

type ResolveReopenedChallengeStatusInput = {
  challengerMembershipId: string;
  proposedByMembershipId: string;
};

type ChallengeScoreWinnerSide = "challenger" | "challenged";

type BuildChallengeScoreProgressInput = {
  matchConfig: LeagueMatchConfig;
  sets: LeagueChallengeScore["sets"];
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
const SUPPORTED_BEST_OF_SET_COUNTS = [1, 3, 5] as const;
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

function getNormalizedBestOfSets(bestOfSets: number) {
  return Math.max(1, Math.trunc(bestOfSets));
}

function isFinalSet(matchConfig: LeagueMatchConfig, setIndex: number) {
  return setIndex === getNormalizedBestOfSets(matchConfig.bestOfSets) - 1;
}

function getChallengeScoreSetWinner(
  set: LeagueChallengeScore["sets"][number]
): ChallengeScoreWinnerSide | null {
  if (set.challengerGames === set.challengedGames) {
    return null;
  }

  return set.challengerGames > set.challengedGames
    ? "challenger"
    : "challenged";
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

function getSetValidationError(input: {
  matchConfig: LeagueMatchConfig;
  set: LeagueChallengeScore["sets"][number];
  setIndex: number;
}) {
  const { matchConfig, set, setIndex } = input;
  const winner = getChallengeScoreSetWinner(set);

  if (!winner) {
    return "O set não pode terminar empatado.";
  }

  const winnerGames = Math.max(set.challengerGames, set.challengedGames);
  const loserGames = Math.min(set.challengerGames, set.challengedGames);
  const isDecidingSet = isFinalSet(matchConfig, setIndex);
  const isSuperTieBreakSet =
    isDecidingSet && matchConfig.finalSetMode === "super_tiebreak";

  if (isSuperTieBreakSet) {
    if (set.kind !== "super_tiebreak") {
      return "O último set desta liga deve ser um super tie-break.";
    }

    if (winnerGames < matchConfig.finalSetSuperTieBreakPoints) {
      return `O super tie-break precisa chegar a pelo menos ${matchConfig.finalSetSuperTieBreakPoints} pontos.`;
    }

    if (
      matchConfig.finalSetSuperTieBreakMustWinByTwo &&
      winnerGames - loserGames < 2
    ) {
      return "O super tie-break precisa terminar com 2 pontos de diferença.";
    }

    return null;
  }

  if (set.kind !== "set") {
    return "Esse placar deve ser informado como um set normal.";
  }

  const gamesPerSet =
    isDecidingSet && matchConfig.finalSetMode === "custom_set"
      ? matchConfig.finalSetGamesPerSet
      : matchConfig.gamesPerSet;
  const setMustWinByTwoGames =
    isDecidingSet && matchConfig.finalSetMode === "custom_set"
      ? matchConfig.finalSetMustWinByTwoGames
      : matchConfig.setMustWinByTwoGames;
  const hasTieBreak =
    isDecidingSet && matchConfig.finalSetMode === "custom_set"
      ? matchConfig.finalSetHasTieBreak
      : matchConfig.hasTieBreak;
  const tieBreakAtGamesAll =
    isDecidingSet && matchConfig.finalSetMode === "custom_set"
      ? matchConfig.finalSetTieBreakAtGamesAll
      : matchConfig.tieBreakAtGamesAll;

  if (winnerGames < gamesPerSet) {
    return `O vencedor precisa chegar a pelo menos ${gamesPerSet} games.`;
  }

  if (!setMustWinByTwoGames) {
    return winnerGames === gamesPerSet
      ? null
      : `A partida deve terminar em ${gamesPerSet} games.`;
  }

  if (hasTieBreak) {
    if (loserGames <= gamesPerSet - 2) {
      return winnerGames === gamesPerSet
        ? null
        : `Com ${loserGames} games do adversário, o placar final deve ser ${gamesPerSet}x${loserGames}.`;
    }

    if (loserGames === gamesPerSet - 1) {
      return winnerGames === gamesPerSet + 1
        ? null
        : `Antes do tie-break, o set deve terminar em ${gamesPerSet + 1}x${loserGames}.`;
    }

    if (loserGames === tieBreakAtGamesAll) {
      return winnerGames === tieBreakAtGamesAll + 1
        ? null
        : `Com tie-break em ${tieBreakAtGamesAll}x${tieBreakAtGamesAll}, o placar final deve ser ${tieBreakAtGamesAll + 1}x${tieBreakAtGamesAll}.`;
    }

    return "Esse placar não respeita a regra do tie-break da liga.";
  }

  if (winnerGames - loserGames !== 2) {
    return "Sem tie-break, o vencedor precisa abrir 2 games de diferença.";
  }

  return winnerGames >= gamesPerSet
    ? null
    : `O vencedor precisa chegar a pelo menos ${gamesPerSet} games.`;
}

function getVisibleSetCount(input: {
  completedSetCount: number;
  hasWinner: boolean;
  maxSets: number;
  setsNeededToWin: number;
}) {
  const initialVisibleSetCount = Math.min(input.maxSets, input.setsNeededToWin);

  if (input.hasWinner) {
    return Math.max(initialVisibleSetCount, input.completedSetCount);
  }

  return Math.min(
    input.maxSets,
    Math.max(initialVisibleSetCount, input.completedSetCount + 1)
  );
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

export function getBestOfSetValidationError(bestOfSets: number) {
  return SUPPORTED_BEST_OF_SET_COUNTS.includes(
    bestOfSets as (typeof SUPPORTED_BEST_OF_SET_COUNTS)[number]
  )
    ? null
    : "Escolha melhor de 1, 3 ou 5 sets.";
}

export function getRequiredSetWins(bestOfSets: number) {
  return Math.floor(getNormalizedBestOfSets(bestOfSets) / 2) + 1;
}

export function getExpectedSetKind(
  matchConfig: LeagueMatchConfig,
  setIndex: number
) {
  return isFinalSet(matchConfig, setIndex) &&
    matchConfig.finalSetMode === "super_tiebreak"
    ? "super_tiebreak"
    : "set";
}

export function isChallengeScoreSetBlank(
  set: LeagueChallengeScore["sets"][number]
) {
  return set.challengerGames === 0 && set.challengedGames === 0;
}

export function buildChallengeScoreProgress(
  input: BuildChallengeScoreProgressInput
) {
  const maxSets = getNormalizedBestOfSets(input.matchConfig.bestOfSets);
  const setsNeededToWin = getRequiredSetWins(maxSets);
  let challengerSets = 0;
  let challengedSets = 0;
  let completedSetCount = 0;
  let winnerSide: ChallengeScoreWinnerSide | null = null;

  for (const [setIndex, set] of input.sets.slice(0, maxSets).entries()) {
    if (isChallengeScoreSetBlank(set)) {
      break;
    }

    if (
      getSetValidationError({
        matchConfig: input.matchConfig,
        set,
        setIndex,
      })
    ) {
      break;
    }

    const setWinner = getChallengeScoreSetWinner(set);

    if (!setWinner) {
      break;
    }

    completedSetCount += 1;

    if (setWinner === "challenger") {
      challengerSets += 1;
    } else {
      challengedSets += 1;
    }

    if (challengerSets === setsNeededToWin) {
      winnerSide = "challenger";
      break;
    }

    if (challengedSets === setsNeededToWin) {
      winnerSide = "challenged";
      break;
    }
  }

  return {
    challengedSets,
    challengerSets,
    completedSetCount,
    maxSets,
    setsNeededToWin,
    visibleSetCount: getVisibleSetCount({
      completedSetCount,
      hasWinner: winnerSide !== null,
      maxSets,
      setsNeededToWin,
    }),
    winnerSide,
  };
}

export function resolveChallengeScoreWinnerMembershipId(input: {
  challengedMembershipId: string;
  challengerMembershipId: string;
  matchConfig: LeagueMatchConfig;
  sets: LeagueChallengeScore["sets"];
}) {
  const progress = buildChallengeScoreProgress({
    matchConfig: input.matchConfig,
    sets: input.sets,
  });

  if (progress.winnerSide === "challenger") {
    return input.challengerMembershipId;
  }

  if (progress.winnerSide === "challenged") {
    return input.challengedMembershipId;
  }

  return null;
}

export function validateChallengeScore(input: ValidateChallengeScoreInput) {
  const maxSets = getNormalizedBestOfSets(input.matchConfig.bestOfSets);
  const scoreSets = input.score.sets.slice(0, maxSets);

  if (scoreSets.length === 0) {
    return "Informe pelo menos um set.";
  }

  if (input.score.sets.length > maxSets) {
    return `Essa liga aceita no máximo ${maxSets} sets nessa partida.`;
  }

  if (
    input.score.winnerMembershipId !== input.challengerMembershipId &&
    input.score.winnerMembershipId !== input.challengedMembershipId
  ) {
    return "O vencedor informado não participa dessa partida.";
  }

  for (const [setIndex, set] of scoreSets.entries()) {
    if (isChallengeScoreSetBlank(set)) {
      return "Preencha apenas os sets jogados.";
    }

    const setValidationError = getSetValidationError({
      matchConfig: input.matchConfig,
      set,
      setIndex,
    });

    if (setValidationError) {
      return setValidationError;
    }
  }

  const winnerMembershipId = resolveChallengeScoreWinnerMembershipId({
    challengedMembershipId: input.challengedMembershipId,
    challengerMembershipId: input.challengerMembershipId,
    matchConfig: input.matchConfig,
    sets: scoreSets,
  });

  if (!winnerMembershipId) {
    return "Esse placar ainda não define o vencedor da partida.";
  }

  const progress = buildChallengeScoreProgress({
    matchConfig: input.matchConfig,
    sets: scoreSets,
  });

  if (progress.completedSetCount !== scoreSets.length) {
    return "Remova os sets extras após a definição do vencedor.";
  }

  return winnerMembershipId === input.score.winnerMembershipId
    ? null
    : "O vencedor informado não corresponde ao placar.";
}

export function resolveConfirmedChallengeResult(
  input: ResolveConfirmedChallengeResultInput
) {
  const scoreValidationError = validateChallengeScore(input);

  if (scoreValidationError) {
    return {
      error: scoreValidationError,
      ok: false,
    } as const;
  }

  const winnerMembershipId = resolveChallengeScoreWinnerMembershipId({
    challengedMembershipId: input.challengedMembershipId,
    challengerMembershipId: input.challengerMembershipId,
    matchConfig: input.matchConfig,
    sets: input.score.sets,
  });

  if (!winnerMembershipId) {
    return {
      error: "Esse placar ainda não define o vencedor da partida.",
      ok: false,
    } as const;
  }

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

  if (input.winnerMembershipId === input.challengerMembershipId) {
    if (input.winBehavior === "climb_one_position") {
      return moveItem(
        input.rankingMembershipIds,
        challengerIndex,
        Math.max(0, challengerIndex - 1)
      );
    }

    const nextRanking = [...input.rankingMembershipIds];
    nextRanking[challengedIndex] = input.challengerMembershipId;
    nextRanking[challengerIndex] = input.challengedMembershipId;
    return nextRanking;
  }

  if (input.lossBehavior === "drop_one_position") {
    return moveItem(
      input.rankingMembershipIds,
      challengerIndex,
      Math.min(input.rankingMembershipIds.length - 1, challengerIndex + 1)
    );
  }

  return input.rankingMembershipIds;
}

export function resolveReopenedChallengeStatus(
  input: ResolveReopenedChallengeStatusInput
) {
  return input.proposedByMembershipId === input.challengerMembershipId
    ? "pending_opponent_response"
    : "pending_creator_reapproval";
}
