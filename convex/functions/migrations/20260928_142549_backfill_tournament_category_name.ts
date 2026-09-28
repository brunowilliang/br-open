import { defineMigration } from "../generated/migrations.gen";

type LegacyCategoryDoc = {
  displayName?: null | string;
  name?: null | string;
  nameKey?: null | string;
};

/** Mesma regra do normalizeCategoryNameKey do contrato (trim + caixa baixa pt-BR). */
function normalizeNameKey(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

/**
 * O nome livre substitui o displayName derivado: `name` = displayName atual,
 * `nameKey` = normalizado (chave do indice unico) e o displayName sai do doc.
 */
export const migration = defineMigration({
  description: "backfill tournamentCategory name/nameKey",
  id: "20260928_142549_backfill_tournament_category_name",
  up: {
    migrateOne: (_ctx, doc) => {
      const category = doc as LegacyCategoryDoc;
      const name = category.name ?? category.displayName ?? null;

      if (!name) {
        return;
      }

      const nameKey = category.nameKey ?? normalizeNameKey(name);
      const isMigrated =
        category.displayName === undefined &&
        category.name === name &&
        category.nameKey === nameKey;

      if (isMigrated) {
        return;
      }

      return { displayName: undefined, name, nameKey };
    },
    table: "tournamentCategory",
  },
});
