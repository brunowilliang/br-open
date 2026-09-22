/**
 * Validação de placar do torneio — reusa as regras de resultado MANUAL da
 * liga por um mapeamento A/B: a liga fala challenger/challenged e o adapter
 * traduz os lados do torneio, então o chamador nunca vê o vocabulário dela.
 * O placar manual é LIVRE (sem padrões de tênis): o vencedor sai das linhas
 * vencidas, ou do `score.winnerEntryId` explícito quando elas empatam.
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
 * Resolve o vencedor do placar livre — pelas linhas vencidas, ou pelo
 * `winnerEntryId` explícito quando elas empatam. `matchConfig` segue na
 * assinatura só por compatibilidade de chamada.
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

/**
 * W.O. declara o vencedor sem placar jogado, mas ele precisa ser um dos dois
 * lados do confronto; vencedor nulo (o placar livre deixou de exigir o campo)
 * é recusado com mensagem própria.
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
 * Efeito de EDITAR um resultado já publicado sobre a partida seguinte da
 * chave: trocar quem avança só é possível enquanto ela não foi jogada, senão
 * a edição ficaria inconsistente com o resto da chave. Edição só de placar
 * (mesmo vencedor) não mexe em nada.
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
