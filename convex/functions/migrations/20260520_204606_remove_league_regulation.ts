import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  id: "20260520_204606_remove_league_regulation",
  description: "remove_league_regulation",
  up: {
    table: "league",
    migrateOne: (_ctx, doc) => {
      if (doc.regulation !== undefined) {
        return {
          regulation: undefined,
        };
      }
    },
  },
});
