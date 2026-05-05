import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  id: "20260504_181921_remove_player_profile_display_name",
  description: "remove_player_profile_display_name",
  up: {
    table: "playerProfile",
    migrateOne: (_ctx, doc) => {
      if (doc.displayName !== undefined) {
        return { displayName: undefined };
      }
    },
  },
});
