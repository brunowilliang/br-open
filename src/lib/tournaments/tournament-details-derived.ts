import type {
  TournamentEntryWithPlayers,
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";
import {
  buildCategoryDisplayName,
  isRegistrationOpen,
} from "@convex/domains/tournament/entry-rules";

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

/** Abas flutuantes da página do torneio, filtradas pelo acesso do papel
 * (restauração da navegação do PLN-0007: as tabs voltam; o conteúdo da casa
 * segue o plano de conteúdo em texto simples). */
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

/** Abas da tela de inscrições (PLN-0007 decisão 1: pendências são superfície
 * do organizador). */
export type TournamentEntriesTab = "confirmed" | "pending";

/**
 * Aba ATIVA da tela de inscrições, derivada a cada render (BUG-0045).
 *
 * O `initialTab` do item de pendência (`initialTab=pending` no deep-link do
 * alerta) só vale para o ORGANIZADOR, e o contexto do organizador NÃO existe no
 * primeiro render da entrada fria (pela home): `access` ainda é `undefined`.
 * Com estado inicializado uma única vez (`useState`), o `pending` se perdia
 * nessa entrada e o CTA "Ver" caía em Confirmados. Aqui a decisão é derivada —
 * quando o contexto chega, a mesma chamada passa a devolver `pending`.
 *
 * `userTab` é a aba tocada pelo usuário: com ela escolhida, a derivada nunca
 * volta ao `initialTab` (a escolha manual não é atropelada por um contexto que
 * carrega depois nem por re-render).
 */
export function resolveTournamentEntriesTab(input: {
  /** `initialTab` do deep-link (params do expo-router). */
  initialTab?: string;
  /** `access?.canManage`: `false` enquanto o contexto do organizador não
   * carregou. */
  isOrganizer: boolean;
  /** Aba tocada pelo usuário; `null` enquanto ele não escolheu. */
  userTab: null | TournamentEntriesTab;
}): TournamentEntriesTab {
  if (input.userTab) {
    return input.userTab;
  }

  return input.isOrganizer && input.initialTab === "pending"
    ? "pending"
    : "confirmed";
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

// ---------------------------------------------------------------------------
// Inscrição na visão geral (IBX-0067/PLN-0001, Etapa 2): estado da janela,
// vagas por categoria e categorias que o viewer ainda pode escolher.
// ---------------------------------------------------------------------------

export type TournamentRegistrationWindowState = {
  open: boolean;
};

/**
 * Mesma regra do servidor (`isRegistrationOpen`, entry-rules): janela aberta
 * em `published`/`drawn` com prazo futuro; fechada em qualquer outro estado
 * ou com prazo vencido.
 */
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

/**
 * Vagas da categoria no seletor do rodapé, na MESMA semântica do servidor
 * (`assertCategoryCapacity` conta só entries `active`): "{ativas}/{max}
 * vagas"; categoria cheia sai como "Lotada". Sem limite, nada a mostrar.
 */
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

/**
 * Contagem de entries CONFIRMADAS (`active`) por categoria — o insumo do
 * seletor de vagas. Mesmo critério do `activeEntryCount` do discovery.
 */
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
  /** Categorias onde o viewer JÁ tem inscrição viva (saem do seletor). */
  joinedCategoryIds: string[];
  /** Categorias que o viewer ainda pode escolher (decisão 22/08). */
  joinableCategoryIds: string[];
};

/**
 * Multi-categoria do jogador: o rodapé aparece pra guest E para quem já
 * está inscrito; a categoria já inscrita sai do seletor (o servidor recusa
 * jogador repetido na categoria). `viewerEntryIds` já exclui cancelled —
 * cancelou, a categoria volta a ser escolhível.
 */
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

/**
 * Cancelar inscrição (IBX-0067, Etapa 2): entry viva em torneio pré-início
 * (`published`/`drawn` — mesma guard do servidor, entries.cancel).
 */
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

// ---------------------------------------------------------------------------
// Avisos do diálogo de Iniciar (IBX-0067, Etapa 3): o usuário vê os
// problemas ANTES de tentar e tomar o erro do servidor.
// ---------------------------------------------------------------------------

type StartWarningMatch = {
  categoryId: string;
  entryAId: null | string;
  entryBId: null | string;
  round: number;
  slotInRound: number;
  status: string;
  walkover: boolean;
};

/**
 * Vagas em aberto ("A definir") que impedem o início — MESMO critério do
 * `validateBracketStartable` (bracket-rules): lado vazio na rodada 1 ou
 * alimentado por subtree podada (`vacant`); lado esperando feed vivo é o
 * desenho normal. A busca do filho é POR CATEGORIA (round/slot colidem
 * entre categorias da lista global de matches).
 */
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

/**
 * Warnings prontos pro corpo do diálogo de Iniciar: convites de dupla sem
 * resposta que ficam de fora e vagas em aberto que recusam o início.
 * Vazio = começa sem aviso.
 */
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
