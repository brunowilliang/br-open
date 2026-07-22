import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  description: "remove_league_regulation",
  id: "20260520_204606_remove_league_regulation",
  up: {
    migrateOne: (_ctx, doc) => {
      if (doc.regulation !== undefined) {
        return {
          regulation: undefined,
        };
      }
    },
    table: "league",
  },
});
