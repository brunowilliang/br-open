import { defineMigration } from "../generated/migrations.gen";

/**
 * IBX-0074 r19: the tournamentEntry unique indexes moved from
 * `categoryId_playerAId`/`categoryId_playerBId` (held forever — playerAId is
 * NOT NULL, so cancelled entries blocked re-registration with a raw 500) to
 * the mirrored `activeAId`/`activeBId` columns, which are set only while the
 * entry is live. This backfill fills the mirrors for existing live rows so
 * they are protected by the new indexes; terminal rows stay out of them.
 *
 * SELF-CONTAINED ON PURPOSE: applied migrations must never import app code —
 * the checksum covers the deployed bundle, so a domain import makes the
 * checksum drift whenever that domain file changes (seen 20/09 with
 * entry-rules.ts r25 edits). Keep the live-status list in sync with
 * `ENTRY_LIVE_STATUSES` (domains/tournament/entry-rules.ts) by hand.
 */
const ENTRY_LIVE_STATUSES = [
  "pending_partner",
  "pending_approval",
  "awaiting_payment",
  "active",
];

export const migration = defineMigration({
  id: "20260920_091746_backfill_tournament_entry_slots",
  description: "backfill tournamentEntry active slot mirrors for live entries",
  up: {
    table: "tournamentEntry",
    migrateOne: async (_ctx, doc) => {
      if (
        doc.status === undefined ||
        !ENTRY_LIVE_STATUSES.includes(doc.status)
      ) {
        return;
      }
      const patch: Record<string, string> = {};
      if (doc.activeAId === undefined && doc.playerAId !== undefined) {
        patch.activeAId = String(doc.playerAId);
      }
      if (doc.playerBId && doc.activeBId === undefined) {
        patch.activeBId = String(doc.playerBId);
      }
      return Object.keys(patch).length > 0 ? patch : undefined;
    },
  },
});
