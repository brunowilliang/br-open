import type {
  TournamentEntryWithPlayers,
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";
import {
  buildCategoryDisplayName,
  isRegistrationOpen,
} from "@convex/domains/tournament/entry-rules";

import {
  formatPlayerCardName,
  UNDEFINED_PLAYER_NAME,
} from "@/lib/matches/match-display";

type CategoryKey = {
  gender: TournamentGender;
  modality: TournamentModality;
};

export type TournamentDetailsRole = "guest" | "organizer" | "player";

export type TournamentDetailsAccess = {
  canManage: boolean;
  canOpenBracket: boolean;
  canOpenSchedule: boolean;
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

export type TournamentDetailsScreenState = "error" | "loading" | "ready";

/**
 * Gate da tela de detalhe: só `ready` libera superfície de papel. O payload é do
 * ATOR ativo (o MODO decide a superfície) — enquanto o ator não resolveu, ou o
 * dado é de antes da troca de ator (`payloadUpdatedAt` não passou do piso
 * `actorSwitchAt`), o que existe é loading: nunca o papel do ator anterior
 * pintado na tela.
 */
export function buildTournamentDetailsScreenState(input: {
  actorKey: null | string;
  actorSwitchAt: number;
  bootstrapStatus: "error" | "loading" | "ready";
  hasTournament: boolean;
  payloadUpdatedAt: number;
}): TournamentDetailsScreenState {
  if (input.bootstrapStatus === "error") {
    return "error";
  }

  const isResolved =
    input.bootstrapStatus === "ready" &&
    input.hasTournament &&
    input.actorKey !== null &&
    input.payloadUpdatedAt > input.actorSwitchAt;

  return isResolved ? "ready" : "loading";
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
    canOpenSchedule: canManage || bracketPublic,
  };
}

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

/** Abas filtradas pelo acesso do papel; a barra só é montada com 2+ itens. */
export function buildTournamentNavigationTabItems(
  access: TournamentDetailsAccess
): TournamentNavigationTabItem[] {
  const allItems: TournamentNavigationTabItem[] = [
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

    return true;
  });

  return items.length > 1 ? items : [];
}

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

export type TournamentStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
};

const TOURNAMENT_STATUS_CHIPS: Record<string, TournamentStatusChip> = {
  cancelled: { color: "danger", label: "Cancelado" },
  draft: { color: "default", label: "Rascunho" },
  finished: { color: "default", label: "Encerrado" },
  ongoing: { color: "warning", label: "Em andamento" },
};

/** O par `published`/`drawn` não tem rótulo próprio: quem diz se as inscrições
 *  estão abertas é a JANELA (`isRegistrationOpen`, a mesma regra do servidor). */
export function getTournamentStatusChip(input: {
  nowMs: number;
  registrationDeadlineMs: number;
  status: string;
}): TournamentStatusChip {
  if (input.status === "published" || input.status === "drawn") {
    return isRegistrationOpen(input)
      ? { color: "success", label: "Inscrições abertas" }
      : { color: "warning", label: "Inscrições encerradas" };
  }

  return (
    TOURNAMENT_STATUS_CHIPS[input.status] ?? {
      color: "default",
      label: input.status,
    }
  );
}

/** Lado que venceu o W.O. JOGADO (`a` = challenger, `b` = challenged), o sinal
 * que o card recebe para pintar sem placar. O bye do sorteio também carrega
 * `walkover: true`, mas não é jogo: só a partida `finished` conta. `null` é o
 * "não é W.O." — e também o W.O. cujo vencedor não é um dos dois lados. */
export function walkoverWinnerSide(match: {
  entryAId: null | string;
  entryBId: null | string;
  status: string;
  walkover: boolean;
  winnerEntryId: null | string;
}): "a" | "b" | null {
  if (!(match.status === "finished" && match.walkover)) {
    return null;
  }

  if (match.entryAId !== null && match.winnerEntryId === match.entryAId) {
    return "a";
  }

  return match.entryBId !== null && match.winnerEntryId === match.entryBId
    ? "b"
    : null;
}

/** Nomes do lado na ordem de exibição — um (simples) ou dois (dupla); lado
 * vazio vira `["A definir"]`. O card da chave desenha um por linha: o rótulo de
 * uma linha (placar na mesma row) comia o parceiro pelo fim da string. */
export function formatEntryPlayerNames(
  entry: null | TournamentEntryWithPlayers
): string[] {
  if (!entry) {
    return [UNDEFINED_PLAYER_NAME];
  }

  const players = entry.playerB
    ? [entry.playerA, entry.playerB]
    : [entry.playerA];

  return players.map((player) => formatPlayerCardName(player));
}

/** Rótulo do lado: `null` vira "A definir"; dupla junta os dois nomes curtos. */
export function formatEntrySideLabel(
  entry: null | TournamentEntryWithPlayers
): string {
  return formatEntryPlayerNames(entry).join(" / ");
}

export function isDoublesEntry(entry: TournamentEntryWithPlayers): boolean {
  return entry.playerB !== null;
}

export type TournamentEntriesTab = "confirmed" | "mine" | "pending";

export type TournamentEntriesTabItem = {
  label: string;
  value: TournamentEntriesTab;
};

/** Itens pelo PAPEL RESOLVIDO: papel nulo (a descoberta ainda não hidratou) zera
 * a barra; é nessa janela que a barra pintada não pode ser a do jogador para um
 * gestor. */
export function buildTournamentEntriesTabItems(input: {
  role: null | TournamentDetailsRole;
}): TournamentEntriesTabItem[] {
  if (input.role === "organizer") {
    return [
      { label: "Confirmados", value: "confirmed" },
      { label: "Pendências", value: "pending" },
    ];
  }

  if (input.role === "player") {
    return [
      { label: "Minhas", value: "mine" },
      { label: "Confirmados", value: "confirmed" },
    ];
  }

  return [];
}

/** Aba ATIVA DERIVADA a cada render: um `useState` inicializado uma vez perderia
 * o `initialTab=pending`, que só chega com o contexto do organizador no
 * re-render. `userTab` só vale se ainda estiver na lista do papel resolvido. */
export function resolveTournamentEntriesTab(input: {
  initialTab?: string;
  role: null | TournamentDetailsRole;
  userTab: null | TournamentEntriesTab;
}): TournamentEntriesTab {
  const items = buildTournamentEntriesTabItems({ role: input.role });
  const isUserTabAvailable =
    input.userTab !== null &&
    items.some((item) => item.value === input.userTab);

  if (input.userTab && isUserTabAvailable) {
    return input.userTab;
  }

  if (input.role === "organizer") {
    return input.initialTab === "pending" ? "pending" : "confirmed";
  }

  return input.role === "player" ? "mine" : "confirmed";
}

/** Nome do estágio pelo tamanho do quadro (2^(totalRounds - round + 1));
 * tamanhos incomuns caem em "Rodada N". */
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

export type TournamentRegistrationWindowState = {
  open: boolean;
};

/** Mesma regra do servidor (`isRegistrationOpen`): aberta só em
 * `published`/`drawn` com prazo futuro. */
export function buildRegistrationWindowState(input: {
  nowMs: number;
  registrationDeadlineMs: number;
  status: string;
}): TournamentRegistrationWindowState {
  const open = isRegistrationOpen({
    nowMs: input.nowMs,
    registrationDeadlineMs: input.registrationDeadlineMs,
    status: input.status,
  });

  return { open };
}

/** Mesma semântica do servidor (`assertCategoryCapacity`, só entries `active`):
 * "{ativas}/{max} vagas", ou "Lotada" quando enche. Sem teto, nada a mostrar. */
export function buildTournamentCategoryVacancy(input: {
  activeEntriesCount: number;
  maxEntries: null | number;
}): { isFull: boolean; label: null | string } {
  if (input.maxEntries === null) {
    return { isFull: false, label: null };
  }

  if (input.activeEntriesCount >= input.maxEntries) {
    return { isFull: true, label: "Lotada" };
  }

  return {
    isFull: false,
    label: `${input.activeEntriesCount}/${input.maxEntries} vagas`,
  };
}

export function buildTournamentActiveEntriesCountByCategory(
  entries: ReadonlyArray<{ categoryId: string; status: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.status !== "active") {
      continue;
    }

    counts[entry.categoryId] = (counts[entry.categoryId] ?? 0) + 1;
  }

  return counts;
}

export type TournamentJoinOptions = {
  joinedCategoryIds: string[];
  joinableCategoryIds: string[];
};

/** Categoria com inscrição viva sai do seletor (o servidor recusa jogador
 * repetido); `viewerEntryIds` já exclui cancelled, então cancelar devolve a
 * categoria às escolhíveis. */
export function buildTournamentJoinOptions(input: {
  categoryIds: readonly string[];
  entries: ReadonlyArray<{ categoryId: string; id: string }>;
  viewerEntryIds: readonly string[];
}): TournamentJoinOptions {
  const viewerEntryIdSet = new Set(input.viewerEntryIds);
  const joined = new Set(
    input.entries
      .filter((entry) => viewerEntryIdSet.has(entry.id))
      .map((entry) => entry.categoryId)
  );

  return {
    joinableCategoryIds: input.categoryIds.filter((id) => !joined.has(id)),
    joinedCategoryIds: input.categoryIds.filter((id) => joined.has(id)),
  };
}

/** Só entry viva em torneio pré-início (`published`/`drawn`) — mesma guard do
 * servidor, entries.cancel. */
export function canCancelTournamentEntry(input: {
  entryStatus: string;
  tournamentStatus: string;
}): boolean {
  if (input.entryStatus === "cancelled" || input.entryStatus === "rejected") {
    return false;
  }

  return (
    input.tournamentStatus === "published" || input.tournamentStatus === "drawn"
  );
}
