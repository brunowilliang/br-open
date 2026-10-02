import { isLiveEntryStatus } from "../tournament/entry-rules";
import type {
  AccountDeletionBlocker,
  AccountDeletionResolution,
  AccountDeletionStatus,
} from "./contract";

/** Mesma trinca que o registry de pendencias usa para "inscricao viva". */
const ACTIVE_TOURNAMENT_STATUSES = ["published", "drawn", "ongoing"];

/** Nome que a organizacao de um dono assume na exclusao da conta. */
export const ORGANIZER_REMOVED_NAME = "Organizador removido";

/** Torneio ativo que trava a exclusao, com a org dona (deep link do app). */
export type AccountDeletionActiveTournament = {
  id: string;
  organizationId: string;
};

export type AccountDeletionOrgSnapshot = {
  activeTournaments: AccountDeletionActiveTournament[];
  draftTournamentIds: string[];
  lockedBalanceCents: number;
  moneyInFlightCount: number;
  organizationId: string;
  otherMemberCount: number;
};

export type AccountDeletionPlayerSnapshot = {
  cancellableEntryCount: number;
  pendingMatchCount: number;
  pendingPixCount: number;
  refundableChargeCount: number;
};

export type AccountDeletionSnapshot = {
  organizations: AccountDeletionOrgSnapshot[];
  player: AccountDeletionPlayerSnapshot | null;
};

export function isActiveTournamentForDeletion(status: string): boolean {
  return ACTIVE_TOURNAMENT_STATUSES.includes(status);
}

export type AccountDeletionEntryAction = "cancel" | "skip" | "walkover";

/**
 * O que fazer com uma inscricao viva do jogador que vai sair: antes do inicio
 * (publicado/sorteado) ela sai inteira; em andamento, com jogo pendente vira
 * W.O. e sem jogo nenhum tambem sai. Fora disso (terminal) nao ha o que fazer.
 */
export function resolveAccountDeletionEntryAction(input: {
  entryStatus: string;
  pendingMatchCount: number;
  tournamentStatus: string;
}): AccountDeletionEntryAction {
  if (!isLiveEntryStatus(input.entryStatus)) {
    return "skip";
  }
  if (
    input.tournamentStatus === "published" ||
    input.tournamentStatus === "drawn"
  ) {
    return "cancel";
  }
  if (input.tournamentStatus === "ongoing") {
    return input.pendingMatchCount > 0 ? "walkover" : "cancel";
  }
  return "skip";
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

export function buildAccountDeletionStatus(
  input: AccountDeletionSnapshot
): AccountDeletionStatus {
  const blockers: AccountDeletionBlocker[] = [];
  const resolutions: AccountDeletionResolution[] = [];

  const activeTournaments = input.organizations.flatMap(
    (org) => org.activeTournaments
  );
  if (activeTournaments.length > 0) {
    blockers.push({
      code: "organization_active_tournament",
      count: activeTournaments.length,
      organizationIds: activeTournaments.map((item) => item.organizationId),
      scope: "organization",
      summary: `Você tem ${activeTournaments.length} ${plural(activeTournaments.length, "torneio", "torneios")} em andamento ou por começar. Encerre ou cancele antes de excluir a conta.`,
      tournamentIds: activeTournaments.map((item) => item.id),
    });
  }

  const moneyInFlightCount = input.organizations.reduce(
    (total, org) => total + org.moneyInFlightCount,
    0
  );
  if (moneyInFlightCount > 0) {
    blockers.push({
      code: "organization_money_in_flight",
      count: moneyInFlightCount,
      organizationIds: [],
      scope: "organization",
      summary:
        "Sua organização tem dinheiro em processamento (saque ou recolhimento pendente). Resolva antes de excluir a conta.",
      tournamentIds: [],
    });
  }

  const lockedBalanceOrganizations = input.organizations.filter(
    (org) => org.lockedBalanceCents > 0
  ).length;
  if (lockedBalanceOrganizations > 0) {
    blockers.push({
      code: "organization_locked_balance",
      count: lockedBalanceOrganizations,
      organizationIds: [],
      scope: "organization",
      summary:
        "Sua organização ainda tem saldo. Saque o valor antes de excluir a conta.",
      tournamentIds: [],
    });
  }

  const organizationsWithOtherMembers = input.organizations.filter(
    (org) => org.otherMemberCount > 0
  ).length;
  if (organizationsWithOtherMembers > 0) {
    blockers.push({
      code: "organization_other_members",
      count: organizationsWithOtherMembers,
      organizationIds: [],
      scope: "organization",
      summary:
        "Sua organização tem outros membros. Transfira a gestão antes de excluir a conta.",
      tournamentIds: [],
    });
  }

  const player = input.player;
  if (player && player.cancellableEntryCount > 0) {
    resolutions.push({
      code: "entries_cancelled",
      count: player.cancellableEntryCount,
      scope: "player",
      summary: `${player.cancellableEntryCount} ${plural(player.cancellableEntryCount, "inscrição", "inscrições")} sem partidas ${plural(player.cancellableEntryCount, "será cancelada", "serão canceladas")} e as vagas liberadas.`,
    });
  }
  if (player && player.refundableChargeCount > 0) {
    resolutions.push({
      code: "entries_refunded",
      count: player.refundableChargeCount,
      scope: "player",
      summary: `${player.refundableChargeCount} ${plural(player.refundableChargeCount, "pagamento", "pagamentos")} ${plural(player.refundableChargeCount, "será estornado", "serão estornados")}.`,
    });
  }
  if (player && player.pendingPixCount > 0) {
    resolutions.push({
      code: "pix_cancelled",
      count: player.pendingPixCount,
      scope: "player",
      summary: `${player.pendingPixCount} ${plural(player.pendingPixCount, "cobrança PIX aberta", "cobranças PIX abertas")} ${plural(player.pendingPixCount, "será cancelada", "serão canceladas")}.`,
    });
  }
  if (player && player.pendingMatchCount > 0) {
    resolutions.push({
      code: "matches_walkover",
      count: player.pendingMatchCount,
      scope: "player",
      summary: `${player.pendingMatchCount} ${plural(player.pendingMatchCount, "partida pendente", "partidas pendentes")} ${plural(player.pendingMatchCount, "será decidida", "serão decididas")} por W.O. e o adversário avança.`,
    });
  }

  const draftTournamentCount = input.organizations.reduce(
    (total, org) => total + org.draftTournamentIds.length,
    0
  );
  if (draftTournamentCount > 0) {
    resolutions.push({
      code: "drafts_deleted",
      count: draftTournamentCount,
      scope: "organization",
      summary: `${draftTournamentCount} ${plural(draftTournamentCount, "rascunho sem inscrições", "rascunhos sem inscrições")} ${plural(draftTournamentCount, "será apagado", "serão apagados")}.`,
    });
  }

  return {
    blockers,
    canDelete: blockers.length === 0,
    resolutions,
  };
}
