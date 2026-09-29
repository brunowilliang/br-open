import type {
  TournamentGender,
  TournamentModality,
} from "@convex/domains/tournament/contract";
import { normalizeCategoryNameKey } from "@convex/domains/tournament/contract";

import { buildCategoryTypeLabel } from "./category-editor-derived";

export type CategorySelectOption = {
  id: string;
  name: string;
};

/** Categoria como as leituras do torneio a expõem: o bastante para agrupar e
 * rotular sem tocar no servidor. */
export type CategorySelectSource = CategorySelectOption & {
  gender: TournamentGender;
  modality: TournamentModality;
};

export type CategorySelectGroup = {
  items: CategorySelectOption[];
  key: string;
  label: string;
};

/** Chave do grupo: o mesmo par que o servidor usa na unicidade do nome. */
export function buildCategorySelectGroupKey(category: {
  gender: TournamentGender;
  modality: TournamentModality;
}): string {
  return `${category.modality}:${category.gender}`;
}

/** Ordem canônica dos grupos: simples antes de duplas e, dentro da modalidade,
 * o gênero na ordem do contrato (masculino, feminino, misto), então duplas
 * femininas entra entre masculinas e mistas. */
const CATEGORY_SELECT_GROUP_ORDER = [
  { gender: "male", modality: "singles" },
  { gender: "female", modality: "singles" },
  { gender: "male", modality: "doubles" },
  { gender: "female", modality: "doubles" },
  { gender: "mixed", modality: "doubles" },
] as const satisfies ReadonlyArray<{
  gender: TournamentGender;
  modality: TournamentModality;
}>;

/** Agrupa na ordem canônica (sem grupo vazio), rotula pelo tipo do contrato e
 * ordena os itens pelo nome normalizado — a MESMA chave do servidor. */
export function buildCategorySelectGroups(
  categories: readonly CategorySelectSource[]
): CategorySelectGroup[] {
  return CATEGORY_SELECT_GROUP_ORDER.flatMap(({ gender, modality }) => {
    const items = categories
      .filter(
        (category) =>
          category.gender === gender && category.modality === modality
      )
      .map((category) => ({ id: category.id, name: category.name }))
      .sort((left, right) =>
        normalizeCategoryNameKey(left.name).localeCompare(
          normalizeCategoryNameKey(right.name),
          "pt-BR"
        )
      );

    return items.length === 0
      ? []
      : [
          {
            items,
            key: buildCategorySelectGroupKey({ gender, modality }),
            label: buildCategoryTypeLabel(modality, gender),
          },
        ];
  });
}

/** Como as abas do seletor se organizam: "active" = uma aba com a seleção (abre
 * a lista inteira); "type" = uma aba por tipo (abre o grupo dela). */
export type CategorySelectTabMode = "active" | "type";

export type CategorySelectTab = {
  /** Grupos que o popover desta aba abre. */
  groups: CategorySelectGroup[];
  name: string;
  option: { label: string; value: string } | undefined;
  tabValue: string;
  typeLabel: string;
};

/** Monta as abas do seletor e o valor ativo da barra. Aba sem seleção mostra o
 * primeiro nome do próprio grupo. */
export function buildCategorySelectTabs(input: {
  categories: readonly CategorySelectSource[];
  mode: CategorySelectTabMode;
  selectedId: string;
}): { tabs: CategorySelectTab[]; value: string } {
  const groups = buildCategorySelectGroups(input.categories);
  const selected =
    input.categories.find((category) => category.id === input.selectedId) ??
    null;

  if (!(selected && groups.length > 0)) {
    return { tabs: [], value: "" };
  }

  if (input.mode === "active") {
    return {
      tabs: [
        {
          groups,
          name: selected.name,
          option: { label: selected.name, value: selected.id },
          tabValue: "active",
          typeLabel: buildCategoryTypeLabel(selected.modality, selected.gender),
        },
      ],
      value: "active",
    };
  }

  const selectedKey = buildCategorySelectGroupKey(selected);
  const activeKey = groups.some((group) => group.key === selectedKey)
    ? selectedKey
    : (groups[0]?.key ?? "");

  return {
    tabs: groups.map((group) => {
      const selectedInGroup =
        group.items.find((item) => item.id === input.selectedId) ?? null;
      const current = selectedInGroup ?? group.items[0] ?? null;

      return {
        groups: [group],
        name: current?.name ?? "",
        option: selectedInGroup
          ? { label: selectedInGroup.name, value: selectedInGroup.id }
          : undefined,
        tabValue: group.key,
        typeLabel: group.label,
      };
    }),
    value: activeKey,
  };
}
