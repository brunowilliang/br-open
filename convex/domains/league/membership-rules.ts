import {
  LEAGUE_MEMBERSHIP_STATUSES,
  type LeagueMembershipStatus,
} from "./contract";

type LeagueAvailabilityInput = {
  activeMembershipCount: number;
  maxPlayers?: null | number;
};

type ApprovedMembershipRankingInput = {
  currentRankingPosition?: null | number;
  highestRankingPosition?: null | number;
};

type RankingReorderInput = {
  activeMembershipIds: string[];
  requestedMembershipIds: string[];
};

const RANKING_REORDER_ERROR =
  "O ranking enviado não corresponde aos jogadores ativos.";

export function canLeagueAcceptMember(input: LeagueAvailabilityInput) {
  return (
    input.maxPlayers === null ||
    input.maxPlayers === undefined ||
    input.activeMembershipCount < input.maxPlayers
  );
}

export function resolveApprovedMembershipRankingPosition(
  input: ApprovedMembershipRankingInput
) {
  return (
    input.currentRankingPosition ?? (input.highestRankingPosition ?? 0) + 1
  );
}

export function resolveRankingReorderError(input: RankingReorderInput) {
  if (
    input.activeMembershipIds.length !== input.requestedMembershipIds.length
  ) {
    return RANKING_REORDER_ERROR;
  }

  const activeMembershipIds = new Set(input.activeMembershipIds);
  const requestedMembershipIds = new Set(input.requestedMembershipIds);

  if (activeMembershipIds.size !== requestedMembershipIds.size) {
    return RANKING_REORDER_ERROR;
  }

  for (const membershipId of activeMembershipIds) {
    if (!requestedMembershipIds.has(membershipId)) {
      return RANKING_REORDER_ERROR;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Review de solicitacao de entrada (BUG-0048 / IBX-0077)
// ---------------------------------------------------------------------------

/**
 * Status em que o manager pode APROVAR ou RECUSAR a solicitacao. Depois disso a
 * solicitacao esta resolvida e nao volta atras por este caminho.
 */
export const REVIEWABLE_MEMBERSHIP_STATUS = LEAGUE_MEMBERSHIP_STATUSES.PENDING;

/**
 * Erro de review fora de `pending` (BUG-0048): sem este gate, `approve` setava
 * `active` para QUALQUER status anterior (reativando uma solicitacao ja
 * recusada ou removida) e `reject` derrubava uma membership ja `active`. Com
 * botao na notificacao, uma linha velha agiria sobre coisa ja resolvida.
 */
export const MEMBERSHIP_REVIEW_CONFLICT_MESSAGE =
  "Essa solicitação de entrada já foi resolvida.";

/** Mensagem de conflito para status nao revisavel, ou `null` quando pode. */
export function resolveMembershipReviewError(
  status: LeagueMembershipStatus | string
): string | null {
  return status === REVIEWABLE_MEMBERSHIP_STATUS
    ? null
    : MEMBERSHIP_REVIEW_CONFLICT_MESSAGE;
}

// ---------------------------------------------------------------------------
// Payment-related helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the league requires payment (has a positive price).
 */
export function isLeaguePaid(league: {
  monthlyPriceCents?: number | null;
}): boolean {
  return (league.monthlyPriceCents ?? 0) > 0;
}
