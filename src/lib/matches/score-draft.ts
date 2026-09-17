import type { LeagueChallengeScore } from "@convex/domains/league/contract";

type LeagueScoreSet = LeagueChallengeScore["sets"][number];

/** Mini-placar do tie-break anexo a uma linha, no vocabulário neutro A/B. */
export type ScoreDraftTieBreak = { aPoints: number; bPoints: number };

/**
 * Linha do resultado — lista livre, na ordem em que o jogo aconteceu. Uma
 * linha de placar ({aGames, bGames} com kind "set"/"super_tiebreak") ou uma
 * linha avulsa de tie-break (kind "tiebreak"), com o mini-placar anexo
 * opcional nas linhas de placar. Mesmo shape do contrato do torneio; a liga
 * fala challenger/challenged e a conversão mora aqui.
 */
export type ScoreDraftSet = {
  aGames: number;
  bGames: number;
  kind: LeagueScoreSet["kind"];
  tieBreak?: null | ScoreDraftTieBreak;
};

export type ScoreDraftSide = "a" | "b";

export type ScoreDraftScoreboard = {
  aLineWins: number;
  bLineWins: number;
  winnerSide: null | ScoreDraftSide;
};

/** Linha nova em branco — o tipo da linha é escolhido no menu (+). */
export function buildEmptyDraftSet(
  kind: LeagueScoreSet["kind"]
): ScoreDraftSet {
  return { aGames: 0, bGames: 0, kind };
}

/** Converte o draft A/B para o vocabulário challenger/challenged da liga. */
export function toLeagueScoreSets(sets: ScoreDraftSet[]): LeagueScoreSet[] {
  return sets.map((set) => ({
    challengedGames: set.bGames,
    challengerGames: set.aGames,
    kind: set.kind,
    ...(set.tieBreak
      ? {
          tieBreak: {
            challengedPoints: set.tieBreak.bPoints,
            challengerPoints: set.tieBreak.aPoints,
          },
        }
      : {}),
  }));
}

/** Converte linhas da liga para o draft A/B (hydrate do dialog). */
export function toScoreDraftSets(sets: LeagueScoreSet[]): ScoreDraftSet[] {
  return sets.map((set) => ({
    aGames: set.challengerGames,
    bGames: set.challengedGames,
    kind: set.kind,
    ...(set.tieBreak
      ? {
          tieBreak: {
            aPoints: set.tieBreak.challengerPoints,
            bPoints: set.tieBreak.challengedPoints,
          },
        }
      : {}),
  }));
}

export function isDraftSetBlank(set: ScoreDraftSet) {
  return set.aGames === 0 && set.bGames === 0;
}

/**
 * O placar da linha ainda é elegível a anexo de tie-break (DEC-0005): linha
 * de placar (set ou super tie-break) com os games EMPATADOS e além do 0x0.
 * Sem a cláusula de "já tem tie-break" — essa parte é do gate do botão
 * (canAttachTieBreak). Linha de tie-break (avulsa) nunca é elegível —
 * tie-break não aninha tie-break.
 */
function hasTieBreakEligibleScore(
  set: Pick<ScoreDraftSet, "aGames" | "bGames" | "kind">
) {
  return set.kind !== "tiebreak" && set.aGames > 0 && set.aGames === set.bGames;
}

/**
 * Se a linha oferece o botão "Tie-break" (DEC-0005, opção A): só linha de
 * placar com placar elegível (empatado além do 0x0) e sem mini-placar já
 * anexado (remoção é pelo X da sub-linha). O menu de linhas segue livre em
 * qualquer estado (RUL-0019).
 */
export function canAttachTieBreak(set: ScoreDraftSet) {
  return !set.tieBreak && hasTieBreakEligibleScore(set);
}

/**
 * BUG-0035/IBX-0055 — o update do dialog troca a linha inteira: ao mudar o
 * placar de games de uma linha com tie-break anexado, dissolve o anexo
 * quando o placar novo deixa de ser elegível (desempatado ou 0x0). Mudou e
 * segue empatado (4x4 → 5x5), mantém; placar intacto (edição só dos pontos
 * do próprio tie-break), NUNCA mexe — o mini-placar edita pela mesma via
 * de onUpdate.
 */
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

/**
 * Rótulo de uma linha: placares numeram ("Set 1", contando placares e super
 * tie-breaks); a linha avulsa de tie-break e o super tie-break têm nome
 * próprio.
 */
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

/**
 * Contagem crua de linhas vencidas: mais games decide a linha; empate em
 * games é decidido pelo tie-break anexo (mais pontos no TB — 6x6 com TB 7-3
 * é linha do lado A); TB empatado, como o empate sem TB, não é linha de
 * ninguém.
 */
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
