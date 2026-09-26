import type { MatchScoreSet } from "@convex/domains/match/contract";

/** Mini-placar do tie-break anexo a uma linha, no vocabulário neutro A/B. */
export type ScoreDraftTieBreak = { aPoints: number; bPoints: number };

/** Placar ("set"/"super_tiebreak") ou tie-break avulso, com mini-placar opcional. */
export type ScoreDraftSet = {
  aGames: number;
  bGames: number;
  kind: MatchScoreSet["kind"];
  tieBreak?: null | ScoreDraftTieBreak;
};

export type ScoreDraftSide = "a" | "b";

export type ScoreDraftScoreboard = {
  aLineWins: number;
  bLineWins: number;
  winnerSide: null | ScoreDraftSide;
};

/** Linha nova em branco — o tipo da linha é escolhido no menu (+). */
export function buildEmptyDraftSet(kind: MatchScoreSet["kind"]): ScoreDraftSet {
  return { aGames: 0, bGames: 0, kind };
}

export function isDraftSetBlank(set: ScoreDraftSet) {
  return set.aGames === 0 && set.bGames === 0;
}

/** Elegível a tie-break: games empatados além do 0x0; tie-break não aninha tie-break. */
function hasTieBreakEligibleScore(
  set: Pick<ScoreDraftSet, "aGames" | "bGames" | "kind">
) {
  return set.kind !== "tiebreak" && set.aGames > 0 && set.aGames === set.bGames;
}

/** Botão "Tie-break" só em linha de placar elegível e sem mini-placar anexado. */
export function canAttachTieBreak(set: ScoreDraftSet) {
  return !set.tieBreak && hasTieBreakEligibleScore(set);
}

/** O update do dialog troca a LINHA INTEIRA: o anexo só sobrevive se o placar seguir elegível. */
export function settleAttachedTieBreak(
  current: ScoreDraftSet,
  next: ScoreDraftSet
): ScoreDraftSet {
  const scoreChanged =
    next.aGames !== current.aGames || next.bGames !== current.bGames;

  if (!(scoreChanged && current.tieBreak) || hasTieBreakEligibleScore(next)) {
    return next;
  }

  return { ...next, tieBreak: null };
}

export function trimTrailingBlankSets(sets: ScoreDraftSet[]) {
  const trimmedSets = [...sets];

  while (trimmedSets.length > 0) {
    const lastSet = trimmedSets.at(-1);

    if (!(lastSet && isDraftSetBlank(lastSet))) {
      break;
    }

    trimmedSets.pop();
  }

  return trimmedSets;
}

/** "Set N" para placares, contando super tie-breaks; tie-break tem nome próprio. */
export function getLineLabel(lines: ScoreDraftSet[], lineIndex: number) {
  const line = lines[lineIndex];

  if (!line || line.kind === "tiebreak") {
    return "Tie-break";
  }

  if (line.kind === "super_tiebreak") {
    return "Super tie-break";
  }

  const scoreLineNumber = lines
    .slice(0, lineIndex + 1)
    .filter((item) => item.kind !== "tiebreak").length;

  return `Set ${scoreLineNumber}`;
}

/** Mais games vence a linha; empate vai ao tie-break anexo; TB empatado não é de ninguém. */
export function buildScoreboard(sets: ScoreDraftSet[]): ScoreDraftScoreboard {
  let aLineWins = 0;
  let bLineWins = 0;

  for (const set of sets) {
    if (set.aGames > set.bGames) {
      aLineWins += 1;
      continue;
    }

    if (set.bGames > set.aGames) {
      bLineWins += 1;
      continue;
    }

    if (!set.tieBreak || set.tieBreak.aPoints === set.tieBreak.bPoints) {
      continue;
    }

    if (set.tieBreak.aPoints > set.tieBreak.bPoints) {
      aLineWins += 1;
    } else {
      bLineWins += 1;
    }
  }

  return {
    aLineWins,
    bLineWins,
    winnerSide:
      aLineWins > bLineWins ? "a" : bLineWins > aLineWins ? "b" : null,
  };
}
