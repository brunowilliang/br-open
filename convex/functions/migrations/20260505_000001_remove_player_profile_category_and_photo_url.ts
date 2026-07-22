import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  description: "remove_player_profile_category_and_photo_url",
  id: "20260505_000001_remove_player_profile_category_and_photo_url",
  up: {
    migrateOne: (_ctx, doc) => {
      if (doc.category !== undefined || doc.photoUrl !== undefined) {
        return {
          category: undefined,
          photoUrl: undefined,
        };
      }
    },
    table: "playerProfile",
  },
});
