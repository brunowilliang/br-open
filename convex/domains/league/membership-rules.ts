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
  "O ranking enviado não corresponde aos participantes ativos.";

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
