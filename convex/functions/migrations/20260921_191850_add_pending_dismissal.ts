import { defineMigration } from "../generated/migrations.gen";

/**
 * A tabela `pendingDismissal` nasce VAZIA (nao ha recibo anterior a esta
 * feature): nao existe dado a backfillar. O registro existe para o journal do
 * DEV/PROD acompanhar a mudanca de schema junto com o resto da entrega.
 */
export const migration = defineMigration({
  id: "20260921_191850_add_pending_dismissal",
  description: "add pendingDismissal (tabela nova: nada a backfillar)",
  up: {
    table: "pendingDismissal",
    migrateOne: async () => undefined,
  },
});
