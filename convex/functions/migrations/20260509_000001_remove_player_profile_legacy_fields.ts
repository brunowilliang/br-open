import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  id: "20260509_000001_remove_player_profile_legacy_fields",
  description: "remove_player_profile_legacy_fields",
  up: {
    table: "playerProfile",
    migrateOne: (_ctx, doc) => {
      if (
        doc.address !== undefined ||
        doc.birthDate !== undefined ||
        doc.city !== undefined ||
        doc.country !== undefined ||
        doc.cpf !== undefined ||
        doc.state !== undefined ||
        doc.zipCode !== undefined
      ) {
        return {
          address: undefined,
          birthDate: undefined,
          city: undefined,
          country: undefined,
          cpf: undefined,
          state: undefined,
          zipCode: undefined,
        };
      }
    },
  },
});
