import { describe, expect, test } from "bun:test";

import {
  buildCategorySelectGroupKey,
  buildCategorySelectGroups,
  buildCategorySelectTabs,
  type CategorySelectSource,
} from "./category-select-derived";

function buildCategory(
  overrides: Partial<CategorySelectSource> & { id: string }
): CategorySelectSource {
  return {
    gender: "male",
    modality: "singles",
    name: "Categoria",
    ...overrides,
  };
}

describe("buildCategorySelectGroups", () => {
  test("ordena os grupos na ordem canônica, mesmo com a lista fora de ordem", () => {
    const groups = buildCategorySelectGroups([
      buildCategory({ gender: "mixed", id: "c", modality: "doubles" }),
      buildCategory({ gender: "female", id: "b" }),
      buildCategory({ id: "a" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "singles:male",
      "singles:female",
      "doubles:mixed",
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Simples masculino",
      "Simples feminino",
      "Duplas mistas",
    ]);
  });

  test("não emite grupo sem categoria e cobre os cinco tipos", () => {
    const allTypes = buildCategorySelectGroups([
      buildCategory({ id: "sm" }),
      buildCategory({ gender: "female", id: "sf" }),
      buildCategory({ id: "dm", modality: "doubles" }),
      buildCategory({ gender: "female", id: "df", modality: "doubles" }),
      buildCategory({ gender: "mixed", id: "dx", modality: "doubles" }),
    ]);

    expect(allTypes.map((group) => group.label)).toEqual([
      "Simples masculino",
      "Simples feminino",
      "Duplas masculinas",
      "Duplas femininas",
      "Duplas mistas",
    ]);

    const partial = buildCategorySelectGroups([
      buildCategory({ gender: "female", id: "df", modality: "doubles" }),
    ]);

    expect(partial.map((group) => group.key)).toEqual(["doubles:female"]);
  });

  test("ordena os itens pelo nome normalizado, preservando o nome original", () => {
    const groups = buildCategorySelectGroups([
      buildCategory({ id: "b", name: "  Categoria B  " }),
      buildCategory({ id: "a", name: "categoria a" }),
      buildCategory({ id: "c", name: "CATEGORIA C" }),
    ]);

    expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(groups[0]?.items.map((item) => item.name)).toEqual([
      "categoria a",
      "  Categoria B  ",
      "CATEGORIA C",
    ]);
  });

  test("separa nomes repetidos entre tipos diferentes", () => {
    const groups = buildCategorySelectGroups([
      buildCategory({ id: "a1", name: "Categoria A" }),
      buildCategory({
        gender: "mixed",
        id: "a2",
        modality: "doubles",
        name: "Categoria A",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.items).toEqual([{ id: "a1", name: "Categoria A" }]);
    expect(groups[1]?.items).toEqual([{ id: "a2", name: "Categoria A" }]);
  });

  test("lista vazia devolve nenhum grupo", () => {
    expect(buildCategorySelectGroups([])).toEqual([]);
  });
});

describe("buildCategorySelectGroupKey", () => {
  test("chave do grupo é o par modalidade:gênero do servidor", () => {
    expect(
      buildCategorySelectGroupKey({ gender: "male", modality: "singles" })
    ).toBe("singles:male");
    expect(
      buildCategorySelectGroupKey({ gender: "mixed", modality: "doubles" })
    ).toBe("doubles:mixed");
  });
});

describe("buildCategorySelectTabs", () => {
  const categories = [
    buildCategory({ id: "sm-a", name: "Categoria A" }),
    buildCategory({ gender: "female", id: "sf-a", name: "Categoria A" }),
    buildCategory({
      gender: "mixed",
      id: "dx-a",
      modality: "doubles",
      name: "Categoria A",
    }),
  ];

  test("mode active: uma aba com a seleção e a lista inteira", () => {
    const { tabs, value } = buildCategorySelectTabs({
      categories,
      mode: "active",
      selectedId: "sf-a",
    });

    expect(value).toBe("active");
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({
      name: "Categoria A",
      option: { label: "Categoria A", value: "sf-a" },
      tabValue: "active",
      typeLabel: "Simples feminino",
    });
    expect(tabs[0]?.groups.map((group) => group.key)).toEqual([
      "singles:male",
      "singles:female",
      "doubles:mixed",
    ]);
  });

  test("mode type: uma aba por tipo e a seleção marcada no grupo dela", () => {
    const { tabs, value } = buildCategorySelectTabs({
      categories,
      mode: "type",
      selectedId: "dx-a",
    });

    expect(value).toBe("doubles:mixed");
    expect(tabs.map((tab) => tab.tabValue)).toEqual([
      "singles:male",
      "singles:female",
      "doubles:mixed",
    ]);
    expect(tabs[2]?.option).toEqual({ label: "Categoria A", value: "dx-a" });
    expect(tabs[0]?.option).toBeUndefined();
    expect(tabs[0]?.name).toBe("Categoria A");
    expect(tabs[0]?.typeLabel).toBe("Simples masculino");
    expect(tabs[0]?.groups).toHaveLength(1);
  });

  test("sem seleção válida não monta aba", () => {
    expect(
      buildCategorySelectTabs({
        categories,
        mode: "active",
        selectedId: "nope",
      }).tabs
    ).toEqual([]);
    expect(
      buildCategorySelectTabs({
        categories: [],
        mode: "type",
        selectedId: "sm-a",
      }).tabs
    ).toEqual([]);
  });
});
