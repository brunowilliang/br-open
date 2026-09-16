/**
 * Placar do card do chaveamento: a sequência dos sets de UM lado, na ordem
 * em que o jogo aconteceu, com o set vencido destacado e os pontos do
 * tie-break anexo por linha. O render (número e TB no canto, com estilos
 * próprios) mora no bracket-match-card.
 */
export type BracketScoreSet = {
  aGames: number;
  bGames: number;
  kind: "set" | "super_tiebreak" | "tiebreak";
  tieBreak?: null | { aPoints: number; bPoints: number };
};

export type BracketScoreToken = {
  games: number;
  isSetWinner: boolean;
  tieBreakPoints: null | number;
};

/**
 * Token de UMA linha do placar para UM lado: os games daquele lado, o TB
 * anexo (quando houver) e quem venceu a linha. Mais games decide; empate
 * (impossível por definição de set, mas o placar é livre) decide pelo
 * tie-break e, sem TB ou com TB empatado, ninguém destaca — é o que mantém
 * o placeholder de W.O. (0x0) apagado.
 */
function buildBracketScoreToken(
  set: BracketScoreSet,
  side: "a" | "b"
): BracketScoreToken {
  const games = side === "a" ? set.aGames : set.bGames;
  const opponentGames = side === "a" ? set.bGames : set.aGames;
  const tieBreakPoints = set.tieBreak
    ? side === "a"
      ? set.tieBreak.aPoints
      : set.tieBreak.bPoints
    : null;
  const opponentTieBreakPoints = set.tieBreak
    ? side === "a"
      ? set.tieBreak.bPoints
      : set.tieBreak.aPoints
    : null;

  let isSetWinner = games > opponentGames;

  if (games === opponentGames) {
    isSetWinner =
      tieBreakPoints !== null &&
      opponentTieBreakPoints !== null &&
      tieBreakPoints > opponentTieBreakPoints;
  }

  return { games, isSetWinner, tieBreakPoints };
}

/** Tokens de UM lado, na ordem do jogo (render do card). */
export function buildBracketScoreTokens(
  sets: BracketScoreSet[],
  side: "a" | "b"
): BracketScoreToken[] {
  return sets.map((set) => buildBracketScoreToken(set, side));
}
