import { defineMigration } from "../generated/migrations.gen";

/**
 * Seed/entry-phase rollback (16-09): the entries screen lost the seed and the
 * "avanço de fase" controls, so nothing in the product writes these fields
 * anymore. They did NOT become inert, though: the draw still honours them
 * (seedRank pins the entry to its standard slot and prioritizes byes —
 * bracket-rules.ts:245-256 e :294-309; entryRound >= 2 enters directly at that
 * round and prunes the round-1 subtree — bracket-rules.ts:135-158), so a
 * leftover row would keep steering a freshly drawn bracket with no UI to see
 * or fix it. Clearing both makes the draw a pure shuffle over the standard
 * seed slots.
 *
 * The fields are DELETED (not set to null) so no residue survives in the doc;
 * every reader already treats absence as round 1 / no seed (`entryRound ?? 1`,
 * `seedRank ?? null`). Matches are NOT touched here: a bracket already drawn
 * keeps its rows, walkovers, vacant lines and published results verbatim — the
 * draw path is the only consumer of these two fields, so no result or standing
 * depends on them.
 *
 * Not reversible: the dropped values are the very data the product decided to
 * remove, so there is no honest `down` (the reference allows omitting it).
 */
type LegacyEntryDoc = {
  entryRound?: null | number;
  seedRank?: null | number;
};

export const migration = defineMigration({
  description: "clear tournamentEntry seedRank/entryRound (rollback do seed/fase)",
  id: "20260916_103007_clear_entry_seed_phase",
  up: {
    batchSize: 128,
    migrateOne: (_ctx, doc) => {
      const entry = doc as LegacyEntryDoc;

      // Idempotent: a row already without both fields is the target shape.
      if (!("entryRound" in entry) && !("seedRank" in entry)) {
        return;
      }

      return { entryRound: undefined, seedRank: undefined };
    },
    table: "tournamentEntry",
  },
});
