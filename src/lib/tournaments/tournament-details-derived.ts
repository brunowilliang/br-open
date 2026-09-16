import type {
  TournamentEntryWithPlayers,
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";
import { buildCategoryDisplayName } from "@convex/domains/tournament/entry-rules";

import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";

type CategoryKey = {
  gender: TournamentGender;
  modality: TournamentModality;
};

export type TournamentDetailsRole = "guest" | "organizer" | "player";

export type TournamentDetailsAccess = {
  canManage: boolean;
  canOpenBracket: boolean;
  canOpenEntries: boolean;
  canOpenSchedule: boolean;
};

export type TournamentNavigationTabValue =
  | "bracket"
  | "entries"
  | "overview"
  | "schedule";

export type TournamentNavigationTabItem = {
  badgeCount: number;
  label: string;
  value: TournamentNavigationTabValue;
};

/** Chave pública só a partir de `ongoing` (a fase `drawn` é do organizador). */
export function isBracketPublic(status: string): boolean {
  return status === "ongoing" || status === "finished";
}

export function buildTournamentDetailsRole(input: {
  isTournamentOrganizer: boolean;
  viewerEntryIds: string[];
}): TournamentDetailsRole {
  if (input.isTournamentOrganizer) {
    return "organizer";
  }

  return input.viewerEntryIds.length > 0 ? "player" : "guest";
}

export function buildTournamentDetailsAccess(input: {
  role: TournamentDetailsRole;
  status: string;
}): TournamentDetailsAccess {
  const canManage = input.role === "organizer";
  const bracketPublic = isBracketPublic(input.status);

  return {
    canManage,
    canOpenBracket: canManage || bracketPublic,
    canOpenEntries: true,
    canOpenSchedule: canManage || bracketPublic,
  };
}

export function buildTournamentNavigationTabItems(
  access: TournamentDetailsAccess
): TournamentNavigationTabItem[] {
  const allItems: Array<{
    badgeCount: number;
    label: string;
    value: TournamentNavigationTabValue;
  }> = [
    { badgeCount: 0, label: "Overview", value: "overview" },
    { badgeCount: 0, label: "Chave", value: "bracket" },
    { badgeCount: 0, label: "Agenda", value: "schedule" },
    { badgeCount: 0, label: "Inscrições", value: "entries" },
  ];

  const items = allItems.filter((item) => {
    if (item.value === "bracket") {
      return access.canOpenBracket;
    }

    if (item.value === "schedule") {
      return access.canOpenSchedule;
    }

    if (item.value === "entries") {
      return access.canOpenEntries;
    }

    return true;
  });

  return items.length > 1 ? items : [];
}

/** Placeholder da aba Chave enquanto a chave não é pública (spec: drawn). */
export function buildBracketPlaceholder(input: {
  access: TournamentDetailsAccess;
  startDateMs: number;
}): null | string {
  if (input.access.canOpenBracket) {
    return null;
  }

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
  }).format(new Date(input.startDateMs));

  return `Chave disponível a partir de ${formatted}, quando o torneio começar.`;
}

export function buildTournamentCategoryChips(
  categories: Array<
    CategoryKey & {
      displayName: string;
      entryFeeCents: number;
      id: string;
    }
  >
) {
  return categories.map((category) => ({
    displayName: category.displayName,
    entryFeeLabel:
      category.entryFeeCents > 0
        ? formatEntryFeeLabel(category.entryFeeCents)
        : "Grátis",
    id: category.id,
  }));
}

export function formatEntryFeeLabel(entryFeeCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(entryFeeCents / 100);
}

export type TournamentEntryStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
};

const ENTRY_STATUS_CHIPS: Record<string, TournamentEntryStatusChip> = {
  active: { color: "success", label: "Confirmada" },
  awaiting_payment: { color: "warning", label: "Aguardando pagamento" },
  cancelled: { color: "default", label: "Cancelada" },
  pending_approval: { color: "warning", label: "Aguardando aprovação" },
  pending_partner: { color: "warning", label: "Aguardando parceiro" },
  rejected: { color: "danger", label: "Recusada" },
};

export function getEntryStatusChip(status: string): TournamentEntryStatusChip {
  return ENTRY_STATUS_CHIPS[status] ?? { color: "default", label: status };
}

export type TournamentMatchStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
};

const MATCH_STATUS_CHIPS: Record<string, TournamentMatchStatusChip> = {
  finished: { color: "success", label: "Encerrado" },
  pending: { color: "default", label: "A definir" },
  scheduled: { color: "accent", label: "Agendado" },
  walkover: { color: "warning", label: "W.O." },
};

export function getMatchStatusChip(status: string): TournamentMatchStatusChip {
  return MATCH_STATUS_CHIPS[status] ?? { color: "default", label: status };
}

/**
 * Linha de agendamento do card do chaveamento (IBX-0033): "12 de set. ·
 * 14:00 · Quadra 2". `null` enquanto a partida não tem os três dados.
 */
export function formatMatchScheduleSummary(input: {
  courtName: null | string;
  matchDate: null | string;
  startMinute: null | number;
}): null | string {
  if (
    input.matchDate === null ||
    input.startMinute === null ||
    input.courtName === null
  ) {
    return null;
  }

  return `${formatMatchMonthDay(input.matchDate)} · ${formatMinuteToHHMM(
    input.startMinute
  )} · ${input.courtName}`;
}

/** Nome de exibição de um lado da partida (dupla junta os dois nomes curtos). */
export function formatEntrySideLabel(
  entry: null | TournamentEntryWithPlayers
): string {
  if (!entry) {
    return "A definir";
  }

  const nameA = entry.playerA?.nickname ?? entry.playerA?.fullName ?? "Jogador";

  if (!entry.playerB) {
    return nameA;
  }

  const nameB = entry.playerB.nickname ?? entry.playerB.fullName ?? "Jogador";

  return `${nameA} / ${nameB}`;
}

export function isDoublesEntry(entry: TournamentEntryWithPlayers): boolean {
  return entry.playerB !== null;
}

/**
 * Stage of a match by draw size (2^(totalRounds - round + 1) slots):
 * Final, Semifinal, Quartas de final, Oitavas de final; uncommon draw
 * sizes fall back to "Rodada N".
 */
export function formatBracketStage(round: number, totalRounds: number): string {
  const drawSize = 2 ** (totalRounds - round + 1);

  switch (drawSize) {
    case 2:
      return "Final";
    case 4:
      return "Semifinal";
    case 8:
      return "Quartas de final";
    case 16:
      return "Oitavas de final";
    default:
      return `Rodada ${round}`;
  }
}

export function buildCategoryDisplayNameFromKey(key: CategoryKey) {
  return buildCategoryDisplayName(key.modality, key.gender);
}
