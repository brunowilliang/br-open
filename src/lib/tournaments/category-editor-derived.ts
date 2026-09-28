import { normalizeCategoryNameKey } from "@convex/domains/tournament/contract";
import type {
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";

import { formatCurrencyCents } from "@/lib/format/currency";

/** Categoria no estado em que o editor a manipula: `id` SEMPRE presente
 * (o payload de edição do servidor casa por ele; na criação ele é ignorado).
 * `liveEntryCount` vem do `management.getById` e só existe na edição. */
export type TournamentCategoryDraft = {
  entryFeeCents: number;
  gender: TournamentGender;
  id: string;
  liveEntryCount?: number;
  maxEntries: null | number;
  modality: TournamentModality;
  name: string;
};

export const CATEGORY_NAME_REQUIRED_MESSAGE = "Informe o nome da categoria.";

/** Mesma frase do refine do contrato: o card e o servidor falam a mesma língua. */
export const CATEGORY_NAME_DUPLICATE_MESSAGE =
  "Já existe uma categoria com esse nome nesse tipo.";

const MODALITY_LABELS: Record<TournamentModality, string> = {
  doubles: "Duplas",
  singles: "Simples",
};

const GENDER_LABELS: Record<
  TournamentModality,
  Record<TournamentGender, string>
> = {
  doubles: { female: "femininas", male: "masculinas", mixed: "mistas" },
  singles: { female: "feminino", male: "masculino", mixed: "misto" },
};

let categoryIdCounter = 0;

/** Contador monotônico + timestamp + sufixo aleatório: dois toques no mesmo
 * milissegundo não colidem e o `crypto` não existe no runtime Hermes. */
export function buildCategoryId(): string {
  categoryIdCounter += 1;
  return `category-${Date.now()}-${categoryIdCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Rótulo de tipo da categoria ("Simples masculino", "Duplas mistas"): a
 * segunda linha do card do jogador e o resumo do card do editor. */
export function buildCategoryTypeLabel(
  modality: TournamentModality,
  gender: TournamentGender
): string {
  return `${MODALITY_LABELS[modality]} ${GENDER_LABELS[modality][gender]}`;
}

/** Trocar a modalidade para simples com "misto" selecionado NÃO pode guardar
 * um par que o contrato recusa: cai para masculino. */
export function resolveCategoryGender(
  modality: TournamentModality,
  gender: TournamentGender
): TournamentGender {
  if (modality === "singles" && gender === "mixed") {
    return "male";
  }

  return gender;
}

/** Chave de unicidade do nome (mesma do servidor): tipo + nome normalizado. */
export function buildCategoryNameKey(category: {
  gender: string;
  modality: string;
  name: string;
}): string {
  return `${category.modality}:${category.gender}:${normalizeCategoryNameKey(
    category.name
  )}`;
}

/** Resumo do card: tipo | taxa | vagas. */
export function buildCategoryCardSummary(
  category: Pick<
    TournamentCategoryDraft,
    "entryFeeCents" | "gender" | "maxEntries" | "modality"
  >
): string {
  const feeLabel =
    category.entryFeeCents === 0
      ? "Grátis"
      : formatCurrencyCents(category.entryFeeCents);
  const slotsLabel =
    category.maxEntries === null
      ? "Sem limite"
      : `${category.maxEntries} vagas`;

  return [
    buildCategoryTypeLabel(category.modality, category.gender),
    feeLabel,
    slotsLabel,
  ].join(" | ");
}

/** Ids das categorias que dividem nome + tipo com outra: a UI marca TODAS as
 * linhas envolvidas, não só a segunda. */
export function collectDuplicateCategoryIds(
  categories: ReadonlyArray<{
    gender: string;
    id: string;
    modality: string;
    name: string;
  }>
): string[] {
  const idsByKey = new Map<string, string[]>();

  for (const category of categories) {
    const key = buildCategoryNameKey(category);
    idsByKey.set(key, [...(idsByKey.get(key) ?? []), category.id]);
  }

  const duplicateIds: string[] = [];

  for (const ids of idsByKey.values()) {
    if (ids.length > 1) {
      duplicateIds.push(...ids);
    }
  }

  return duplicateIds;
}

/** Checagem do dialog: colide com OUTRA linha do mesmo tipo (o `id` do próprio
 * candidato fica de fora na edição). */
export function isCategoryNameTaken(
  categories: ReadonlyArray<{
    gender: string;
    id: string;
    modality: string;
    name: string;
  }>,
  candidate: {
    gender: string;
    id?: string;
    modality: string;
    name: string;
  }
): boolean {
  const key = buildCategoryNameKey(candidate);

  return categories.some(
    (category) =>
      category.id !== candidate.id && buildCategoryNameKey(category) === key
  );
}

export function buildLiveEntryCountLabel(liveEntryCount: number): string {
  return liveEntryCount === 1 ? "1 inscrição" : `${liveEntryCount} inscrições`;
}

/** Motivo ANTES do toque: o "Remover" fica desabilitado com a explicação. */
export function buildRemoveBlockedReason(liveEntryCount: number): string {
  return `Essa categoria tem ${buildLiveEntryCountLabel(liveEntryCount)} e não pode ser removida.`;
}

/** Modalidade e gênero ficam travados com inscrição viva. */
export function buildLockedFieldsReason(liveEntryCount: number): string {
  return `Essa categoria tem ${buildLiveEntryCountLabel(liveEntryCount)}: modalidade e gênero ficam travados.`;
}

export function buildCategoryCreateDefaults(): Omit<
  TournamentCategoryDraft,
  "id" | "name"
> {
  return {
    entryFeeCents: 0,
    gender: "male",
    maxEntries: null,
    modality: "singles",
  };
}

/** `liveEntryCount` só existe no que veio do `management.getById`: é o que
 * separa a categoria do servidor da recém-criada no editor. */
export function isPersistedCategory(category: {
  liveEntryCount?: number;
}): boolean {
  return category.liveEntryCount !== undefined;
}

/** Payload do update: `id` presente = linha EXISTENTE pro diff do servidor —
 * a categoria nova carrega id local e sai daqui SEM ele (senão vira NOT_FOUND). */
export function buildCategoryUpdatePayload(category: TournamentCategoryDraft): {
  entryFeeCents: number;
  gender: TournamentGender;
  id?: string;
  maxEntries: null | number;
  modality: TournamentModality;
  name: string;
} {
  const payload = {
    entryFeeCents: category.entryFeeCents,
    gender: category.gender,
    maxEntries: category.maxEntries,
    modality: category.modality,
    name: category.name,
  };

  return isPersistedCategory(category)
    ? { ...payload, id: category.id }
    : payload;
}
