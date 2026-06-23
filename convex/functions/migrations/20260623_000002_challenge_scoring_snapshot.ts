import { defineMigration } from "../generated/migrations.gen";
import { renameScoringValues } from "./20260623_000001_toggleable_rule_config";

// Challenge match config snapshots are frozen per challenge, so they must be
// migrated independently of the league rule config. This migration rewrites
// any no_ad scoring values inside the snapshot to no_advantage.
export const migration = defineMigration({
  id: "20260623_000002_challenge_scoring_snapshot",
  description: "challenge_scoring_snapshot",
  up: {
    table: "leagueChallenge",
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const renamedMatchConfig = renameScoringValues(
        record.matchConfigSnapshot
      );
      if (!renamedMatchConfig) {
        return;
      }

      return ctx.db.patch(record._id as Parameters<typeof ctx.db.patch>[0], {
        matchConfigSnapshot: renamedMatchConfig,
      });
    },
  },
});
