/**
 * A ordem de "Minhas Competições" no modo organizador: o card de criar fica
 * FORA dos grupos, sempre no índice 0 (encostado na grade ele sumia no fim da
 * lista). Os torneios vão por grupo de status e, dentro do grupo, pela data de
 * início mais próxima; encerrado e cancelado invertem, o mais recente primeiro.
 */
export type CompetitionPinnedItem = {
  kind: "create-tournament";
};

export type CompetitionTournamentItem = {
  kind: "tournament";
  /** Início do torneio (epoch ms): decide o desempate dentro do grupo. */
  startDate: number;
  status: string;
};

const STATUS_GROUPS = [
  "ongoing",
  "published",
  "drawn",
  "draft",
  "finished",
  "cancelled",
] as const;

const STATUS_RANKS = new Map<string, number>(
  STATUS_GROUPS.map((status, index) => [status, index])
);

/** Encerrado e cancelado desempatam ao contrário: o mais recente primeiro. */
const MOST_RECENT_FIRST = new Set<string>(["cancelled", "finished"]);

function statusRank(status: string): number {
  // Status fora do vocabulário (o contrato não tem nenhum hoje) cai no fim.
  return STATUS_RANKS.get(status) ?? STATUS_GROUPS.length;
}

export function compareCompetitionItems(
  a: CompetitionTournamentItem,
  b: CompetitionTournamentItem
): number {
  const rankDiff = statusRank(a.status) - statusRank(b.status);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const distance = a.startDate - b.startDate;
  return MOST_RECENT_FIRST.has(a.status) ? -distance : distance;
}

function isTournamentItem<
  T extends CompetitionPinnedItem | CompetitionTournamentItem,
>(item: T): item is T & CompetitionTournamentItem {
  return item.kind === "tournament" && "startDate" in item && "status" in item;
}

export function orderCompetitionItems<
  T extends CompetitionPinnedItem | CompetitionTournamentItem,
>(items: readonly T[]): T[] {
  const pinned: T[] = [];
  const tournaments: (T & CompetitionTournamentItem)[] = [];

  for (const item of items) {
    if (isTournamentItem(item)) {
      tournaments.push(item);
    } else {
      pinned.push(item);
    }
  }

  tournaments.sort(compareCompetitionItems);

  return [...pinned, ...tournaments];
}
