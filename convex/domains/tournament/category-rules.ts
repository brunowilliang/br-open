/**
 * Regras puras das categorias: o diff do update (por `id`) e o gate de "uma
 * inscricao por tipo". O I/O fica nas procedures; aqui so a decisao.
 */
import {
  MAX_TOURNAMENT_CATEGORIES,
  normalizeCategoryNameKey,
  findDuplicateCategoryName,
  type TournamentGender,
  type TournamentModality,
} from "./contract";
import { isLiveEntryStatus } from "./entry-rules";

export type CategorySyncInput = {
  entryFeeCents: number;
  gender: TournamentGender;
  /** Presente = categoria EXISTENTE (o diff casa por ele); ausente = nova. */
  id?: string;
  maxEntries: null | number;
  modality: TournamentModality;
  name: string;
};

export type CategorySyncExistingRow = {
  /** Inscricoes ACTIVE: piso do `maxEntries`. */
  activeEntryCount: number;
  gender: string;
  id: string;
  /** Inscricoes de status vivo (reservam vaga): travam tipo e remocao. */
  liveEntryCount: number;
  /** Confrontos ja sorteados da categoria. */
  matchCount: number;
  modality: string;
  name: string;
};

export type CategorySyncPlan = {
  deletes: string[];
  inserts: Array<{
    entryFeeCents: number;
    gender: TournamentGender;
    maxEntries: null | number;
    modality: TournamentModality;
    name: string;
    nameKey: string;
  }>;
  updates: Array<{
    entryFeeCents: number;
    gender: TournamentGender;
    id: string;
    maxEntries: null | number;
    modality: TournamentModality;
    name: string;
    nameKey: string;
  }>;
};

export type CategorySyncError = {
  code: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND";
  message: string;
};

/**
 * Diff do `categories` do create/update. Nunca delete+recreate: a cascata
 * levaria inscricoes/chave da categoria e orfanaria cobranca paga. Regras:
 * `id` desconhecido e erro; nome repetido no tipo e erro; tipo (modalidade,
 * genero) so muda sem inscricao viva e sem chave; `maxEntries` tem piso nas
 * inscricoes ativas; remocao com inscricao viva ou chave e recusada.
 */
export function resolveCategorySyncPlan(input: {
  existing: readonly CategorySyncExistingRow[];
  next: readonly CategorySyncInput[];
}): { error: CategorySyncError } | { plan: CategorySyncPlan } {
  if (input.next.length > MAX_TOURNAMENT_CATEGORIES) {
    return {
      error: {
        code: "BAD_REQUEST",
        message: `O torneio aceita no máximo ${MAX_TOURNAMENT_CATEGORIES} categorias.`,
      },
    };
  }

  const duplicateIndex = findDuplicateCategoryName(input.next);
  if (duplicateIndex !== null) {
    return {
      error: {
        code: "BAD_REQUEST",
        message: "Já existe uma categoria com esse nome nesse tipo.",
      },
    };
  }

  const existingById = new Map(
    input.existing.map((category) => [category.id, category])
  );
  const plan: CategorySyncPlan = { deletes: [], inserts: [], updates: [] };
  const keptIds = new Set<string>();

  for (const category of input.next) {
    const nameKey = normalizeCategoryNameKey(category.name);
    if (!category.id) {
      plan.inserts.push({
        entryFeeCents: category.entryFeeCents,
        gender: category.gender,
        maxEntries: category.maxEntries,
        modality: category.modality,
        name: category.name,
        nameKey,
      });
      continue;
    }

    const current = existingById.get(category.id);
    if (!current) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Uma das categorias não existe mais nesse torneio.",
        },
      };
    }
    keptIds.add(current.id);

    const changesType =
      current.modality !== category.modality ||
      current.gender !== category.gender;
    if (changesType && current.liveEntryCount > 0) {
      return {
        error: {
          code: "CONFLICT",
          message: `A categoria ${current.name} tem inscrições e o tipo não pode mudar.`,
        },
      };
    }
    if (changesType && current.matchCount > 0) {
      return {
        error: {
          code: "CONFLICT",
          message: `A categoria ${current.name} já está na chave e o tipo não pode mudar.`,
        },
      };
    }

    if (
      category.maxEntries !== null &&
      category.maxEntries < current.activeEntryCount
    ) {
      return {
        error: {
          code: "BAD_REQUEST",
          message: `A categoria ${current.name} já tem ${current.activeEntryCount} inscrições — o limite não pode ser menor que isso.`,
        },
      };
    }

    plan.updates.push({
      entryFeeCents: category.entryFeeCents,
      gender: category.gender,
      id: current.id,
      maxEntries: category.maxEntries,
      modality: category.modality,
      name: category.name,
      nameKey,
    });
  }

  for (const category of input.existing) {
    if (keptIds.has(category.id)) {
      continue;
    }
    if (category.liveEntryCount > 0) {
      return {
        error: {
          code: "CONFLICT",
          message: `A categoria ${category.name} tem inscrições e não pode ser removida.`,
        },
      };
    }
    if (category.matchCount > 0) {
      return {
        error: {
          code: "CONFLICT",
          message: `A categoria ${category.name} já está na chave e não pode ser removida.`,
        },
      };
    }
    plan.deletes.push(category.id);
  }

  return { plan };
}

/**
 * Gate do `allowMultipleEntriesPerType` DESLIGADO: o jogador nao pode ter
 * inscricao VIVA em outra categoria do MESMO tipo (modalidade + genero). Nao
 * olha a categoria alvo (a repeticao nela e do `assertPlayersNotInCategory`) e
 * nao retroage: inscricao ja criada nunca cai por desligar a opcao.
 */
export function resolveDuplicateTypeEntryError(input: {
  allowMultipleEntriesPerType: boolean;
  categories: readonly { gender: string; id: string; modality: string }[];
  liveEntries: readonly {
    categoryId: string;
    playerAId: string;
    playerBId: null | string;
    status: string;
  }[];
  playerProfileIds: readonly string[];
  subject: "caller" | "partner";
  targetCategoryId: string;
}) {
  if (input.allowMultipleEntriesPerType) {
    return null;
  }
  const target = input.categories.find(
    (category) => category.id === input.targetCategoryId
  );
  if (!target) {
    return null;
  }

  const siblingIds = new Set(
    input.categories
      .filter(
        (category) =>
          category.id !== target.id &&
          category.modality === target.modality &&
          category.gender === target.gender
      )
      .map((category) => category.id)
  );
  if (siblingIds.size === 0) {
    return null;
  }

  const playerIds = new Set(input.playerProfileIds);
  const repeated = input.liveEntries.some(
    (entry) =>
      siblingIds.has(entry.categoryId) &&
      isLiveEntryStatus(entry.status) &&
      (playerIds.has(entry.playerAId) ||
        (entry.playerBId !== null && playerIds.has(entry.playerBId)))
  );
  if (!repeated) {
    return null;
  }

  return input.subject === "caller"
    ? "Você já tem uma inscrição nesse tipo de categoria."
    : "Esse jogador já tem uma inscrição nesse tipo de categoria.";
}
