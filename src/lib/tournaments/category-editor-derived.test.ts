import { describe, expect, test } from "bun:test";

import {
  buildCategoryCardSummary,
  buildCategoryCreateDefaults,
  buildCategoryId,
  buildCategoryNameKey,
  buildCategoryTypeLabel,
  buildCategoryUpdatePayload,
  buildLiveEntryCountLabel,
  buildLockedFieldsReason,
  buildRemoveBlockedReason,
  collectDuplicateCategoryIds,
  isCategoryNameTaken,
  resolveCategoryGender,
  type TournamentCategoryDraft,
} from "./category-editor-derived";

function buildCategory(
  overrides: Partial<TournamentCategoryDraft> & { id: string }
): TournamentCategoryDraft {
  return {
    entryFeeCents: 0,
    gender: "male",
    maxEntries: null,
    modality: "singles",
    name: "Categoria",
    ...overrides,
  };
}

describe("buildCategoryTypeLabel", () => {
  test("concorda em gênero e número com a modalidade", () => {
    expect(buildCategoryTypeLabel("singles", "male")).toBe("Simples masculino");
    expect(buildCategoryTypeLabel("singles", "female")).toBe(
      "Simples feminino"
    );
    expect(buildCategoryTypeLabel("doubles", "male")).toBe("Duplas masculinas");
    expect(buildCategoryTypeLabel("doubles", "female")).toBe(
      "Duplas femininas"
    );
    expect(buildCategoryTypeLabel("doubles", "mixed")).toBe("Duplas mistas");
  });
});

describe("resolveCategoryGender", () => {
  test("simples com misto cai para masculino", () => {
    expect(resolveCategoryGender("singles", "mixed")).toBe("male");
  });

  test("duplas mantêm misto e os demais gêneros passam intactos", () => {
    expect(resolveCategoryGender("doubles", "mixed")).toBe("mixed");
    expect(resolveCategoryGender("singles", "female")).toBe("female");
    expect(resolveCategoryGender("doubles", "male")).toBe("male");
  });
});

describe("buildCategoryCardSummary", () => {
  test("tipo, taxa e vagas na mesma linha", () => {
    expect(
      buildCategoryCardSummary(
        buildCategory({ entryFeeCents: 3000, id: "a", maxEntries: 8 })
      )
    ).toBe("Simples masculino | R$ 30,00 | 8 vagas");
  });

  test("taxa zero sai como Grátis e sem teto como Sem limite", () => {
    expect(
      buildCategoryCardSummary(
        buildCategory({ entryFeeCents: 0, id: "a", maxEntries: null })
      )
    ).toBe("Simples masculino | Grátis | Sem limite");
  });
});

describe("buildCategoryNameKey", () => {
  test("ignora caixa e espaços nas pontas", () => {
    expect(
      buildCategoryNameKey({ gender: "male", modality: "singles", name: " A " })
    ).toBe(
      buildCategoryNameKey({ gender: "male", modality: "singles", name: "a" })
    );
  });

  test("modalidade e gênero separam a chave", () => {
    expect(
      buildCategoryNameKey({ gender: "male", modality: "singles", name: "a" })
    ).not.toBe(
      buildCategoryNameKey({ gender: "female", modality: "singles", name: "a" })
    );
  });
});

describe("collectDuplicateCategoryIds", () => {
  test("marca TODAS as linhas do mesmo tipo e nome", () => {
    expect(
      collectDuplicateCategoryIds([
        buildCategory({ id: "a", name: "Manhã" }),
        buildCategory({ id: "b", name: " manhã " }),
        buildCategory({ id: "c", modality: "doubles", name: "Manhã" }),
      ])
    ).toEqual(["a", "b"]);
  });

  test("sem colisão devolve lista vazia", () => {
    expect(
      collectDuplicateCategoryIds([
        buildCategory({ id: "a", name: "A" }),
        buildCategory({ id: "b", name: "B" }),
      ])
    ).toEqual([]);
  });
});

describe("isCategoryNameTaken", () => {
  const categories = [
    buildCategory({ id: "a", name: "Manhã" }),
    buildCategory({ gender: "female", id: "b", name: "Manhã" }),
  ];

  test("colide com outra linha do mesmo tipo", () => {
    expect(
      isCategoryNameTaken(categories, {
        gender: "male",
        modality: "singles",
        name: "manhã",
      })
    ).toBe(true);
  });

  test("o próprio id fica de fora na edição", () => {
    expect(
      isCategoryNameTaken(categories, {
        gender: "male",
        id: "a",
        modality: "singles",
        name: "Manhã",
      })
    ).toBe(false);
  });

  test("mesmo nome em outro gênero passa", () => {
    expect(
      isCategoryNameTaken(categories, {
        gender: "mixed",
        modality: "doubles",
        name: "Manhã",
      })
    ).toBe(false);
  });
});

describe("contagem de inscrições vivas", () => {
  test("singular e plural", () => {
    expect(buildLiveEntryCountLabel(1)).toBe("1 inscrição");
    expect(buildLiveEntryCountLabel(4)).toBe("4 inscrições");
  });

  test("motivos prontos do bloqueio e da trava", () => {
    expect(buildRemoveBlockedReason(1)).toBe(
      "Essa categoria tem 1 inscrição e não pode ser removida."
    );
    expect(buildRemoveBlockedReason(3)).toBe(
      "Essa categoria tem 3 inscrições e não pode ser removida."
    );
    expect(buildLockedFieldsReason(2)).toBe(
      "Essa categoria tem 2 inscrições: modalidade e gênero ficam travados."
    );
  });
});

describe("buildCategoryId", () => {
  test("não repete sob uso rápido e tem prefixo próprio", () => {
    const ids = new Set(Array.from({ length: 200 }, () => buildCategoryId()));

    expect(ids.size).toBe(200);
    expect(buildCategoryId().startsWith("category-")).toBe(true);
  });
});

describe("buildCategoryCreateDefaults", () => {
  test("nasce simples masculino, grátis e sem teto", () => {
    expect(buildCategoryCreateDefaults()).toEqual({
      entryFeeCents: 0,
      gender: "male",
      maxEntries: null,
      modality: "singles",
    });
  });
});

describe("buildCategoryUpdatePayload", () => {
  test("categoria do servidor leva o id (e nunca o contador)", () => {
    const payload = buildCategoryUpdatePayload(
      buildCategory({ id: "server-1", liveEntryCount: 0, name: "A" })
    );

    expect(payload).toEqual({
      entryFeeCents: 0,
      gender: "male",
      id: "server-1",
      maxEntries: null,
      modality: "singles",
      name: "A",
    });
    expect("liveEntryCount" in payload).toBe(false);
  });

  test("categoria nova sai SEM id: o diff leria id local como linha existente", () => {
    const payload = buildCategoryUpdatePayload(
      buildCategory({ id: buildCategoryId(), name: "B" })
    );

    expect("id" in payload).toBe(false);
    expect(payload).toEqual({
      entryFeeCents: 0,
      gender: "male",
      maxEntries: null,
      modality: "singles",
      name: "B",
    });
  });
});
