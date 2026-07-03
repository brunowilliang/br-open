import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const definePaymentRelations = (r: RelationsBuilder<typeof tables>) => ({
  leaguePayment: {
    organization: r.one.organization({
      from: r.leaguePayment.organizationId,
      to: r.organization.id,
    }),
    league: r.one.league({
      from: r.leaguePayment.leagueId,
      to: r.league.id,
    }),
    playerProfile: r.one.playerProfile({
      from: r.leaguePayment.playerProfileId,
      to: r.playerProfile.id,
    }),
    membership: r.one.leagueMembership({
      from: r.leaguePayment.membershipId,
      to: r.leagueMembership.id,
    }),
  },
  organizationWooviAccount: {
    organization: r.one.organization({
      from: r.organizationWooviAccount.organizationId,
      to: r.organization.id,
    }),
  },
});
