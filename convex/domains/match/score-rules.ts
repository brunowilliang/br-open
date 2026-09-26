import type { MatchScore } from "./contract";

/**
 * Resolve o vencedor de um resultado MANUAL livre: cada linha vale 1 ponto
 * (mais games vence; linha EMPATADA em games vai ao tie-break ANEXO — mais
 * pontos de TB vence a linha, e TB empatado ou ausente = linha de ninguém) e
 * quem vence mais linhas leva a partida. Empate total NÃO decide sozinho: aí
 * o payload precisa mandar o vencedor explícito (winnerMembershipId), e a
 * resolução final exige exatamente 1 vencedor — derivado OU explícito
 * coerente. Sanidade apenas: inteiros >= 0 e pelo menos 1 linha.
 */
export function resolveMatchScoreOutcome(input: {
  challengedMembershipId: string;
  challengerMembershipId: string;
  score: MatchScore;
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
