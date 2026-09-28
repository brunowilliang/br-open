import { describe, expect, it } from "bun:test";

import {
  type CategorySyncExistingRow,
  type CategorySyncInput,
  resolveCategorySyncPlan,
  resolveDuplicateTypeEntryError,
} from "../category-rules";
import { MAX_TOURNAMENT_CATEGORIES } from "../contract";

function buildNext(
  overrides: Partial<CategorySyncInput> = {}
): CategorySyncInput {
  return {
    entryFeeCents: 0,
    gender: "male",
    maxEntries: null,
    modality: "singles",
    name: "Simples Masculino A",
    ...overrides,
  };
}

function buildExisting(
  overrides: Partial<CategorySyncExistingRow> & { id: string }
): CategorySyncExistingRow {
  return {
    activeEntryCount: 0,
    gender: "male",
    liveEntryCount: 0,
    matchCount: 0,
    modality: "singles",
    name: "Simples Masculino A",
    ...overrides,
  };
}

describe("resolveCategorySyncPlan", () => {
  it("categoria nova entra como insert, com o nameKey normalizado", () => {
    const result = resolveCategorySyncPlan({
      existing: [],
      next: [buildNext({ name: "  Amador A  " })],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.inserts).toEqual([
        {
          entryFeeCents: 0,
          gender: "male",
          maxEntries: null,
          modality: "singles",
          name: "  Amador A  ",
          nameKey: "amador a",
        },
      ]);
      expect(result.plan.deletes).toEqual([]);
      expect(result.plan.updates).toEqual([]);
    }
  });

  it("o `id` casa a categoria existente: vira update, nao insert", () => {
    const result = resolveCategorySyncPlan({
      existing: [buildExisting({ id: "c1" })],
      next: [buildNext({ entryFeeCents: 5000, id: "c1", maxEntries: 16 })],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.inserts).toEqual([]);
      expect(result.plan.deletes).toEqual([]);
      expect(result.plan.updates).toHaveLength(1);
      expect(result.plan.updates[0]).toMatchObject({
        entryFeeCents: 5000,
        id: "c1",
        maxEntries: 16,
        nameKey: "simples masculino a",
      });
    }
  });

  it("categoria fora do payload sumiu: vira delete quando nada a segura", () => {
    const result = resolveCategorySyncPlan({
      existing: [buildExisting({ id: "c1" })],
      next: [],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.deletes).toEqual(["c1"]);
    }
  });

  it("`id` desconhecido e recusado", () => {
    const result = resolveCategorySyncPlan({
      existing: [],
      next: [buildNext({ id: "fantasma" })],
    });

    expect(result).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Uma das categorias não existe mais nesse torneio.",
      },
    });
  });

  it("mesmo nome no mesmo tipo e recusado (mesma regra do contrato)", () => {
    const result = resolveCategorySyncPlan({
      existing: [],
      next: [buildNext({ name: "Amador A" }), buildNext({ name: "amador a" })],
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toBe(
        "Já existe uma categoria com esse nome nesse tipo."
      );
    }
  });

  it("passa do teto de categorias: recusa pelo cap", () => {
    const result = resolveCategorySyncPlan({
      existing: [],
      next: Array.from({ length: MAX_TOURNAMENT_CATEGORIES + 1 }, (_, index) =>
        buildNext({ name: `Categoria ${index + 1}` })
      ),
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toContain(
        `${MAX_TOURNAMENT_CATEGORIES} categorias`
      );
    }
  });

  it("troca de modalidade/genero com inscricao viva: recusa com o nome", () => {
    const result = resolveCategorySyncPlan({
      existing: [
        buildExisting({
          id: "c1",
          liveEntryCount: 2,
          name: "Simples Masculino A",
        }),
      ],
      next: [buildNext({ gender: "female", id: "c1" })],
    });

    expect(result).toEqual({
      error: {
        code: "CONFLICT",
        message:
          "A categoria Simples Masculino A tem inscrições e o tipo não pode mudar.",
      },
    });
  });

  it("troca de modalidade/genero com chave montada: recusa", () => {
    const result = resolveCategorySyncPlan({
      existing: [buildExisting({ id: "c1", matchCount: 3 })],
      next: [buildNext({ id: "c1", modality: "doubles" })],
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toContain("já está na chave");
    }
  });

  it("troca de tipo sem inscricao viva e sem chave: passa", () => {
    const result = resolveCategorySyncPlan({
      existing: [
        buildExisting({ activeEntryCount: 2, id: "c1", liveEntryCount: 0 }),
      ],
      next: [buildNext({ gender: "female", id: "c1" })],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.updates[0]).toMatchObject({ gender: "female" });
    }
  });

  it("limite abaixo das inscricoes ATIVAS: recusa com o piso", () => {
    const result = resolveCategorySyncPlan({
      existing: [
        buildExisting({
          activeEntryCount: 5,
          id: "c1",
          liveEntryCount: 5,
          name: "Amador A",
        }),
      ],
      next: [buildNext({ id: "c1", maxEntries: 4 })],
    });

    expect(result).toEqual({
      error: {
        code: "BAD_REQUEST",
        message:
          "A categoria Amador A já tem 5 inscrições — o limite não pode ser menor que isso.",
      },
    });
  });

  it("remocao com inscricao viva: recusa (mesmo terminal nao trava)", () => {
    const blocked = resolveCategorySyncPlan({
      existing: [
        buildExisting({ activeEntryCount: 0, id: "c1", liveEntryCount: 1 }),
      ],
      next: [],
    });

    expect("error" in blocked).toBe(true);
    if ("error" in blocked) {
      expect(blocked.error.message).toContain("não pode ser removida");
    }
  });

  it("remocao com chave montada: recusa", () => {
    const result = resolveCategorySyncPlan({
      existing: [buildExisting({ id: "c1", matchCount: 2 })],
      next: [],
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toContain("já está na chave");
    }
  });

  it("libera um nome no mesmo payload: delete entra antes de qualquer insert", () => {
    const result = resolveCategorySyncPlan({
      existing: [buildExisting({ id: "c1", name: "Amador A" })],
      next: [buildNext({ name: "Amador B" })],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.deletes).toEqual(["c1"]);
      expect(result.plan.inserts).toHaveLength(1);
    }
  });

  it("duas categorias do MESMO tipo com nomes diferentes convivem", () => {
    const result = resolveCategorySyncPlan({
      existing: [],
      next: [
        buildNext({ name: "A" }),
        buildNext({ name: "B" }),
        buildNext({ entryFeeCents: 1000, maxEntries: 8, name: "C" }),
      ],
    });

    expect("plan" in result).toBe(true);
    if ("plan" in result) {
      expect(result.plan.inserts).toHaveLength(3);
    }
  });
});

describe("resolveDuplicateTypeEntryError — allowMultipleEntriesPerType", () => {
  const CATEGORIES = [
    { gender: "male", id: "c-atual", modality: "singles" },
    { gender: "male", id: "c-irma", modality: "singles" },
    { gender: "female", id: "c-feminina", modality: "singles" },
  ];

  function buildEntry(overrides: {
    categoryId: string;
    playerAId?: string;
    playerBId?: null | string;
    status?: string;
  }) {
    return {
      categoryId: overrides.categoryId,
      playerAId: overrides.playerAId ?? "p1",
      playerBId: overrides.playerBId ?? null,
      status: overrides.status ?? "active",
    };
  }

  const BASE = {
    categories: CATEGORIES,
    playerProfileIds: ["p1"],
    targetCategoryId: "c-atual",
  } as const;

  it("opcao LIGADA nunca barra", () => {
    const error = resolveDuplicateTypeEntryError({
      ...BASE,
      allowMultipleEntriesPerType: true,
      liveEntries: [buildEntry({ categoryId: "c-irma" })],
      subject: "caller",
    });

    expect(error).toBeNull();
  });

  it("opcao DESLIGADA barra quem ja tem inscricao viva no mesmo tipo", () => {
    expect(
      resolveDuplicateTypeEntryError({
        ...BASE,
        allowMultipleEntriesPerType: false,
        liveEntries: [buildEntry({ categoryId: "c-irma" })],
        subject: "caller",
      })
    ).toBe("Você já tem uma inscrição nesse tipo de categoria.");
    expect(
      resolveDuplicateTypeEntryError({
        ...BASE,
        allowMultipleEntriesPerType: false,
        liveEntries: [buildEntry({ categoryId: "c-irma" })],
        subject: "partner",
      })
    ).toBe("Esse jogador já tem uma inscrição nesse tipo de categoria.");
  });

  it("outro tipo e categoria terminal nao contam", () => {
    const error = resolveDuplicateTypeEntryError({
      ...BASE,
      allowMultipleEntriesPerType: false,
      liveEntries: [
        buildEntry({ categoryId: "c-feminina" }),
        buildEntry({ categoryId: "c-irma", status: "cancelled" }),
        buildEntry({ categoryId: "c-irma", status: "rejected" }),
      ],
      subject: "caller",
    });

    expect(error).toBeNull();
  });

  it("a propria categoria alvo nao bloqueia a si mesma", () => {
    const error = resolveDuplicateTypeEntryError({
      ...BASE,
      allowMultipleEntriesPerType: false,
      liveEntries: [buildEntry({ categoryId: "c-atual" })],
      subject: "caller",
    });

    expect(error).toBeNull();
  });

  it("barra tambem pelo lado B (parceiro) da inscricao viva", () => {
    const error = resolveDuplicateTypeEntryError({
      ...BASE,
      allowMultipleEntriesPerType: false,
      liveEntries: [
        buildEntry({
          categoryId: "c-irma",
          playerAId: "outro",
          playerBId: "p1",
        }),
      ],
      subject: "caller",
    });

    expect(error).toBe("Você já tem uma inscrição nesse tipo de categoria.");
  });

  it("tipo sem categoria irma nunca barra", () => {
    const error = resolveDuplicateTypeEntryError({
      allowMultipleEntriesPerType: false,
      categories: [{ gender: "mixed", id: "c-mista", modality: "doubles" }],
      liveEntries: [buildEntry({ categoryId: "c-outra" })],
      playerProfileIds: ["p1"],
      subject: "caller",
      targetCategoryId: "c-mista",
    });

    expect(error).toBeNull();
  });
});
