import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineLeagueRelations = (r: RelationsBuilder<typeof tables>) => ({
  league: {
    manager: r.one.user({
      from: r.league.managerUserId,
      to: r.user.id,
    }),
    memberships: r.many.leagueMembership({
      from: r.league.id,
      to: r.leagueMembership.leagueId,
    }),
  },
  leagueMembership: {
    league: r.one.league({
      from: r.leagueMembership.leagueId,
      to: r.league.id,
    }),
    user: r.one.user({
      from: r.leagueMembership.userId,
      to: r.user.id,
    }),
  },
});
