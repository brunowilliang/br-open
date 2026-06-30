import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const definePaymentRelations = (r: RelationsBuilder<typeof tables>) => ({
  organization: {
    wooviAccount: r.one.organizationWooviAccount({
      from: r.organization.id,
      to: r.organizationWooviAccount.organizationId,
    }),
  },
  leaguePayment: {
    league: r.one.league({
      from: r.leaguePayment.leagueId,
      to: r.league.id,
    }),
    membership: r.one.leagueMembership({
      from: r.leaguePayment.leagueMembershipId,
      to: r.leagueMembership.id,
    }),
    organization: r.one.organization({
      from: r.leaguePayment.organizationId,
      to: r.organization.id,
    }),
    playerProfile: r.one.playerProfile({
      from: r.leaguePayment.playerProfileId,
      to: r.playerProfile.id,
    }),
  },
});
