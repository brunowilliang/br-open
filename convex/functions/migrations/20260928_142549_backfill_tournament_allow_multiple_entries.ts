import { defineMigration } from "../generated/migrations.gen";

type LegacyTournamentDoc = {
  allowMultipleEntriesPerType?: boolean | null;
};

/**
 * A flag nasce LIGADA no produto (DEFAULT_ALLOW_MULTIPLE_ENTRIES_PER_TYPE):
 * todo torneio que ja existia aceitava mais de uma inscricao no mesmo tipo.
 */
export const migration = defineMigration({
  description: "backfill tournament allowMultipleEntriesPerType",
  id: "20260928_142549_backfill_tournament_allow_multiple_entries",
  up: {
    migrateOne: (_ctx, doc) => {
      const tournament = doc as LegacyTournamentDoc;

      if (tournament.allowMultipleEntriesPerType !== undefined) {
        return;
      }

      return { allowMultipleEntriesPerType: true };
    },
    table: "tournament",
  },
});
