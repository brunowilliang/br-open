import { defineMigration } from "../generated/migrations.gen";

/**
 * Os índices únicos de tournamentEntry saíram de
 * `categoryId_playerAId`/`categoryId_playerBId` (playerAId é NOT NULL, então
 * uma inscrição cancelada travava a reinscrição com um 500 cru) para as colunas
 * espelho `activeAId`/`activeBId`, preenchidas só enquanto a inscrição está
 * viva. Este backfill preenche os espelhos das linhas vivas existentes; linhas
 * terminais ficam fora dos índices novos.
 *
 * SELF-CONTAINED ON PURPOSE: migração aplicada NÃO importa código do app — o
 * checksum cobre o bundle publicado, e um import de domínio faz o checksum
 * divergir quando aquele arquivo muda. Mantenha a lista de status viva em
 * sincronia manual com `ENTRY_LIVE_STATUSES`.
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
