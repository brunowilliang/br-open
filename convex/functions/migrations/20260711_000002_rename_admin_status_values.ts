import { defineMigration } from "../generated/migrations.gen";

const STATUS_RENAMES: Record<string, string> = {
  pending_admin_challenge_validation: "pending_organizer_challenge_validation",
  pending_admin_decision: "pending_organizer_decision",
  pending_admin_result_validation: "pending_organizer_result_validation",
};

export const migration = defineMigration({
  description: "rename_admin_status_values",
  id: "20260711_000002_rename_admin_status_values",
  up: {
    migrateOne: (ctx, doc) => {
      const status = doc.status as string | undefined;
      if (!status) {
        return;
      }
      const newStatus = STATUS_RENAMES[status];

      if (!newStatus) {
        return;
      }

      return ctx.db.patch(doc._id as Parameters<typeof ctx.db.patch>[0], {
        status: newStatus,
      });
    },
    table: "leagueChallenge",
  },
});
