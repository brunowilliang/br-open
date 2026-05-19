type LeagueMembership = {
  leagueId: string;
  role: "manager" | "member" | string;
};

export function getLeaguePlayerMembership(
  memberships: LeagueMembership[],
  leagueId: string
) {
  return (
    memberships.find(
      (membership) =>
        membership.leagueId === leagueId && membership.role === "member"
    ) ?? null
  );
}

export function createLeaguePlayerMembershipMap(
  memberships: LeagueMembership[]
) {
  return new Map(
    memberships
      .filter((membership) => membership.role === "member")
      .map((membership) => [membership.leagueId, membership] as const)
  );
}
