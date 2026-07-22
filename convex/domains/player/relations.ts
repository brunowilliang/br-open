import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const definePlayerRelations = (r: RelationsBuilder<typeof tables>) => ({
  playerProfile: {
    leagueMemberships: r.many.leagueMembership({
      from: r.playerProfile.id,
      to: r.leagueMembership.playerProfileId,
    }),
    user: r.one.user({
      from: r.playerProfile.userId,
      to: r.user.id,
    }),
  },
});
