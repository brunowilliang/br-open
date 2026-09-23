import type {
  TournamentEntryWithPlayers,
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";
import {
  buildCategoryDisplayName,
  isRegistrationOpen,
} from "@convex/domains/tournament/entry-rules";

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

export type TournamentMatchStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
};

const MATCH_STATUS_CHIPS: Record<string, null | TournamentMatchStatusChip> = {
  // "champion" não existe no wire: é a FINAL decidida, que a chave lê do
  // `winnerEntryId` e manda pelo mesmo vocabulário do chip.
  champion: { color: "accent", label: "Campeão" },
  finished: { color: "success", label: "Encerrado" },
  pending: { color: "default", label: "A definir" },
  scheduled: { color: "accent", label: "Agendado" },
  // Vaga podada do sorteio: é a moldura da chave, não um jogo — sem chip.
  vacant: null,
  walkover: { color: "warning", label: "W.O." },
};

/** `null` = estado SEM chip (a vaga vazia da chave); status fora do vocabulário
 * cai no rótulo cru, com a cor default. */
export function getMatchStatusChip(
  status: string
): null | TournamentMatchStatusChip {
  return Object.hasOwn(MATCH_STATUS_CHIPS, status)
    ? MATCH_STATUS_CHIPS[status]
    : { color: "default", label: status };
}

/** Rótulo do jogador que ainda não existe (lado sem inscrição na chave). É a
 * sentinela que o card lê para não repetir "A definir" nas duas linhas da
 * dupla: o lado vazio é UMA linha, a dupla é uma unidade. */
export const UNDEFINED_PLAYER_NAME = "A definir";

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

  return players.map(
    (player) => player?.nickname ?? player?.fullName ?? "Jogador"
  );
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

type StartWarningMatch = {
  categoryId: string;
  entryAId: null | string;
  entryBId: null | string;
  round: number;
  slotInRound: number;
  status: string;
  walkover: boolean;
};

/** Lado vazio na primeira rodada ou alimentado por subtree podada (`vacant`) é
 * buraco; lado esperando feed vivo é o desenho normal. A busca do filho é POR
 * CATEGORIA (round/slot colidem entre categorias na lista global de matches). */
function countBracketStartHoles(matches: readonly StartWarningMatch[]) {
  const boardByCategory = new Map<string, Map<string, StartWarningMatch>>();

  for (const match of matches) {
    let board = boardByCategory.get(match.categoryId);

    if (!board) {
      board = new Map();
      boardByCategory.set(match.categoryId, board);
    }

    board.set(`${match.round}:${match.slotInRound}`, match);
  }

  let holes = 0;

  for (const board of boardByCategory.values()) {
    for (const match of board.values()) {
      if (match.status === "vacant" || match.walkover) {
        continue;
      }

      for (const side of ["a", "b"] as const) {
        const entryId = side === "a" ? match.entryAId : match.entryBId;

        if (entryId !== null) {
          continue;
        }

        const child =
          match.round > 1
            ? board.get(
                `${match.round - 1}:${match.slotInRound * 2 + (side === "a" ? 0 : 1)}`
              )
            : undefined;

        if (match.round <= 1 || child?.status === "vacant") {
          holes += 1;
        }
      }
    }
  }

  return holes;
}

export function buildStartWarnings(input: {
  entries: ReadonlyArray<{ status: string }>;
  matches: readonly StartWarningMatch[];
}): string[] {
  const warnings: string[] = [];

  const pendingInvites = input.entries.filter(
    (entry) => entry.status === "pending_partner"
  ).length;

  if (pendingInvites === 1) {
    warnings.push(
      "Há 1 convite de dupla sem resposta · essa inscrição ficará de fora da chave."
    );
  } else if (pendingInvites > 1) {
    warnings.push(
      `Há ${pendingInvites} convites de dupla sem resposta · essas inscrições ficarão de fora da chave.`
    );
  }

  const holes = countBracketStartHoles(input.matches);

  if (holes === 1) {
    warnings.push(
      "A chave tem 1 vaga em aberto (A definir) · o início só é liberado com a chave completa."
    );
  } else if (holes > 1) {
    warnings.push(
      `A chave tem ${holes} vagas em aberto (A definir) · o início só é liberado com a chave completa.`
    );
  }

  return warnings;
}
