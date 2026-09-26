/**
 * Conclusao do torneio: o ENCERRAMENTO e ato do organizador. A regra pura
 * responde as duas pontas com a mesma verdade — quando a pendencia "Concluir
 * torneio" existe e quando a procedure pode virar o status em `finished`.
 */

/** Partida da categoria com o que a decisao da final precisa. */
export type TournamentConclusionMatch = {
  round: number;
  slotInRound: number;
  // Convex omite chave nao gravada: o runtime entrega undefined onde o tipo diz null.
  winnerEntryId: null | string | undefined;
};

export type TournamentConclusionCategory = {
  matches: readonly TournamentConclusionMatch[];
};

/** Campeao da categoria: o vencedor da final, partida de MAIOR rodada no slot 0. */
export function resolveCategoryChampion(
  matches: readonly TournamentConclusionMatch[]
): null | string {
  const maxRound = matches.reduce(
    (max, match) => Math.max(max, match.round),
    0
  );
  const final = matches.find(
    (match) => match.round === maxRound && match.slotInRound === 0
  );

  return final?.winnerEntryId ?? null;
}

/**
 * So conclui com o torneio EM ANDAMENTO e com toda categoria sorteada ja com
 * campeao. Categoria sem chave (menos de 2 inscricoes ativas, fora do sorteio)
 * nao bloqueia o encerramento.
 */
export function canConcludeTournament(input: {
  categories: readonly TournamentConclusionCategory[];
  status: string;
}): boolean {
  if (input.status !== "ongoing" || input.categories.length === 0) {
    return false;
  }

  return input.categories.every(
    (category) =>
      category.matches.length === 0 ||
      resolveCategoryChampion(category.matches) !== null
  );
}

/** Recusa da conclusao (`null` = pode concluir): sem campeao em toda categoria, ou fora do andamento. */
export function resolveTournamentConclusionError(input: {
  categories: readonly TournamentConclusionCategory[];
  status: string;
}): null | string {
  if (canConcludeTournament(input)) {
    return null;
  }

  return input.status === "ongoing"
    ? "Todas as categorias precisam ter campeão antes de concluir o torneio."
    : "Só um torneio em andamento pode ser concluído.";
}
