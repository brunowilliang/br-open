import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const definePaymentRelations = (r: RelationsBuilder<typeof tables>) => ({
  paymentCharge: {
    organization: r.one.organization({
      from: r.paymentCharge.organizationId,
      to: r.organization.id,
    }),
    league: r.one.league({
      from: r.paymentCharge.leagueId,
      to: r.league.id,
    }),
    playerProfile: r.one.playerProfile({
      from: r.paymentCharge.playerProfileId,
      to: r.playerProfile.id,
    }),
    membership: r.one.leagueMembership({
      from: r.paymentCharge.membershipId,
      to: r.leagueMembership.id,
    }),
  },
});
