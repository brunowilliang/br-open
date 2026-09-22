import { defineMigration } from "../generated/migrations.gen";

/**
 * Rollback do par seed/fase: a tela perdeu os controles e nada mais escreve
 * `seedRank`/`entryRound`, mas o SORTEIO ainda os honra — uma linha esquecida
 * continuaria guiando um chaveamento novo sem UI para ver ou corrigir. Os
 * campos são DELETADOS (não setados a null) para não deixar resíduo, e todo
 * leitor já trata ausência como primeira rodada / sem seed. Partidas não são
 * tocadas. Não reversível: os valores são exatamente o que o produto removeu.
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
