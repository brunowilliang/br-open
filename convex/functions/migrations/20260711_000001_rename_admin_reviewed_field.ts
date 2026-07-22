import { defineMigration } from "../generated/migrations.gen";

export const migration = defineMigration({
  description: "rename_admin_reviewed_field",
  id: "20260711_000001_rename_admin_reviewed_field",
  up: {
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const oldValue = record.adminReviewedByUserId;

      if (oldValue === undefined) {
        return;
      }

      const { adminReviewedByUserId: _drop, ...rest } = record;
      const nextRecord: Record<string, unknown> = {
        ...rest,
        organizerReviewedByUserId: oldValue,
      };

      return ctx.db.replace(
        record._id as Parameters<typeof ctx.db.replace>[0],
        nextRecord
      );
    },
    table: "leagueChallengeResultSubmission",
  },
});
