import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineTournamentRelations = (
  r: RelationsBuilder<typeof tables>
) => ({
  tournament: {
    categories: r.many.tournamentCategory({
      from: r.tournament.id,
      to: r.tournamentCategory.tournamentId,
    }),
    organization: r.one.organization({
      from: r.tournament.organizationId,
      to: r.organization.id,
    }),
  },
  tournamentCategory: {
    entries: r.many.tournamentEntry({
      from: r.tournamentCategory.id,
      to: r.tournamentEntry.categoryId,
    }),
    matches: r.many.tournamentMatch({
      from: r.tournamentCategory.id,
      to: r.tournamentMatch.categoryId,
    }),
    tournament: r.one.tournament({
      from: r.tournamentCategory.tournamentId,
      to: r.tournament.id,
    }),
  },
  tournamentEntry: {
    category: r.one.tournamentCategory({
      from: r.tournamentEntry.categoryId,
      to: r.tournamentCategory.id,
    }),
    playerA: r.one.playerProfile({
      alias: "playerAId",
      from: r.tournamentEntry.playerAId,
      to: r.playerProfile.id,
    }),
    playerB: r.one.playerProfile({
      alias: "playerBId",
      from: r.tournamentEntry.playerBId,
      to: r.playerProfile.id,
    }),
  },
  tournamentMatch: {
    category: r.one.tournamentCategory({
      from: r.tournamentMatch.categoryId,
      to: r.tournamentCategory.id,
    }),
    entryA: r.one.tournamentEntry({
      alias: "entryAId",
      from: r.tournamentMatch.entryAId,
      to: r.tournamentEntry.id,
    }),
    entryB: r.one.tournamentEntry({
      alias: "entryBId",
      from: r.tournamentMatch.entryBId,
      to: r.tournamentEntry.id,
    }),
    winnerEntry: r.one.tournamentEntry({
      alias: "winnerEntryId",
      from: r.tournamentMatch.winnerEntryId,
      to: r.tournamentEntry.id,
    }),
  },
});
