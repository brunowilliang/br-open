/**
 * Tournament score validation — the league's MANUAL result rules, reused
 * via an A/B mapping: the league resolver is written in terms of
 * challenger/challenged sides; this adapter maps tournament sides (A/B)
 * onto it so callers never touch league vocabulary. REWORK-2 (10/09):
 * manual scoring is FREE (no tennis patterns) — the winner comes from
 * lines won, or from the explicit `score.winnerEntryId` when the lines
 * tie; league messages are reused verbatim (same product voice).
 */
import { resolveChallengeScoreOutcome } from "../league/challenge-rules";
import type { LeagueMatchConfig } from "../league/contract";
import type { TournamentMatchScore } from "./contract";

type SideScores = {
  aGames: number;
  bGames: number;
  kind: "set" | "super_tiebreak" | "tiebreak";
  tieBreak?: null | { aPoints: number; bPoints: number };
};

function toLeagueSets(sets: SideScores[]) {
  return sets.map((set) => ({
    challengedGames: set.bGames,
    challengerGames: set.aGames,
    kind: set.kind,
    tieBreak: set.tieBreak
      ? {
          challengedPoints: set.tieBreak.bPoints,
          challengerPoints: set.tieBreak.aPoints,
        }
      : undefined,
  }));
}

/**
 * Validates a free manual score and resolves the winner (derived from
 * lines won, or the explicit `score.winnerEntryId` when the lines tie).
 * `matchConfig` segue na assinatura só por compatibilidade de chamada.
 */
export function validateTournamentMatchScore(input: {
  entryAId: string;
  entryBId: string;
  matchConfig: LeagueMatchConfig;
  score: TournamentMatchScore;
}):
  | { winnerEntryId: string; error: null }
  | { winnerEntryId: null; error: string } {
  const outcome = resolveChallengeScoreOutcome({
    challengedMembershipId: input.entryBId,
    challengerMembershipId: input.entryAId,
    score: {
      sets: toLeagueSets(input.score.sets),
      winnerMembershipId: input.score.winnerEntryId,
    },
  });

  if (outcome.error !== null) {
    return { error: outcome.error, winnerEntryId: null };
  }

  return { error: null, winnerEntryId: outcome.winnerMembershipId };
}

/** Score tied to a finished match, mapped back to A/B sides for storage. */

/**
 * M4: a WALKOVER declares the winner without a played score — but the
 * declared winner must be one of the two sides of the match. Pure rule so
 * the mutation and tests share it. REWORK-2: o vencedor pode chegar nulo
 * (o placar livre deixou de exigir o campo no payload) — W.O. sem vencedor
 * é rejeitado com mensagem própria.
 */
export function validateWalkoverWinner(input: {
  entryAId: string;
  entryBId: string;
  winnerEntryId: null | string | undefined;
}):
  | { winnerEntryId: string; error: null }
  | { winnerEntryId: null; error: string } {
  if (!input.winnerEntryId) {
    return { error: "Informe o vencedor do W.O.", winnerEntryId: null };
  }
  if (
    input.winnerEntryId !== input.entryAId &&
    input.winnerEntryId !== input.entryBId
  ) {
    return {
      error: "O vencedor informado não participa desse confronto.",
      winnerEntryId: null,
    };
  }
  return { error: null, winnerEntryId: input.winnerEntryId };
}

/** Score tied to a finished match, mapped back to A/B sides for storage. */
export function serializeMatchScore(score: TournamentMatchScore) {
  return {
    sets: score.sets.map((set) => ({
      aGames: set.aGames,
      bGames: set.bGames,
      kind: set.kind,
      // nullish in, absent out — keeps stored JSON free of null noise.
      tieBreak: set.tieBreak ?? undefined,
    })),
    winnerEntryId: score.winnerEntryId,
  };
}

/**
 * IBX-0028: efeito de uma EDIÇÃO de resultado publicado sobre a partida
 * seguinte da chave. Trocar quem avança só é possível enquanto a partida
 * seguinte não foi jogada — caso contrário a edição ficaria inconsistente
 * com o resto da chave. Edição só de placar (mesmo vencedor) não mexe na
 * chave.
 */
export function resolveResultEditReverb(input: {
  newWinnerEntryId: string;
  nextMatchExists: boolean;
  nextMatchPublished: boolean;
  oldWinnerEntryId: string;
}):
  | { action: "conflict"; error: string }
  | { action: "keep" | "swap"; error: null } {
  if (
    input.oldWinnerEntryId === input.newWinnerEntryId ||
    !input.nextMatchExists
  ) {
    return { action: "keep", error: null };
  }

  if (input.nextMatchPublished) {
    return {
      action: "conflict",
      error:
        "A rodada seguinte já foi jogada. Corrija a partida seguinte antes de trocar quem avança nessa.",
    };
  }

  return { action: "swap", error: null };
}
