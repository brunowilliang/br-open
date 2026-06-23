import { defineMigration } from "../generated/migrations.gen";

// The legacy playerProfile table carried PII fields (cpf, address, birthDate,
// city, state, zipCode, country) that are no longer part of the schema and were
// never used by the product. The previous migration (20260509) tried to remove
// them by returning `{ field: undefined }`, which Convex's db.patch treats as a
// no-op, so the data stayed in the DB. This migration rewrites each legacy doc
// via db.replace, omitting the PII fields so they are actually deleted.
const LEGACY_PII_FIELDS = [
  "address",
  "birthDate",
  "city",
  "country",
  "cpf",
  "state",
  "zipCode",
] as const;

export const migration = defineMigration({
  id: "20260619_000001_purge_player_profile_pii",
  description: "purge_player_profile_pii",
  up: {
    table: "playerProfile",
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const hasAnyPiiField = LEGACY_PII_FIELDS.some(
        (fieldName) => record[fieldName] !== undefined
      );
      if (!hasAnyPiiField) {
        return;
      }

      const nextRecord: Record<string, unknown> = { ...record };
      for (const fieldName of LEGACY_PII_FIELDS) {
        delete nextRecord[fieldName];
      }

      // Returning a patch would be a no-op for field deletion (Convex ignores
      // `undefined` in db.patch). We rewrite the whole doc via db.replace so the
      // omitted fields are actually dropped. The id is cast because the doc is
      // widened to a plain record above (legacy fields aren't on the schema).
      return ctx.db.replace(
        record._id as Parameters<typeof ctx.db.replace>[0],
        nextRecord
      );
    },
  },
});
