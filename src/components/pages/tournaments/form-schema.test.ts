import { DEFAULT_MATCH_CONFIG } from "@convex/domains/match/contract";
import { describe, expect, test } from "bun:test";

import {
  buildTournamentRangeOption,
  epochMsToTournamentDate,
  parseTournamentRangeValue,
  TournamentSchema,
  tournamentDateToEpochMs,
} from "./form-schema";

function buildValidValues() {
  return {
    address: {
      cep: "01001000",
      city: "Sao Paulo",
      number: "120",
      state: "SP",
      street: "Rua das Palmeiras",
    },
    allowMultipleEntriesPerType: true,
    approvalMode: "auto",
    avatarStorageId: null,
    bracketReleaseAt: "2026-09-14",
    categories: [
      {
        entryFeeCents: 0,
        gender: "male",
        id: "category-a",
        maxEntries: null,
        modality: "singles",
        name: "Categoria A",
      },
    ],
    courts: [],
    coverStorageId: null,
    description: undefined,
    endDate: "2026-09-20",
    matchConfig: {
      ...DEFAULT_MATCH_CONFIG,
    },
    name: "Circuito Paulista",
    registrationDeadlineAt: "2026-09-14",
    startDate: "2026-09-15",
    visibility: "public",
  };
}

describe("TournamentSchema registration window", () => {
  test("deadline on the eve of the start date passes", () => {
    const result = TournamentSchema.safeParse(buildValidValues());

    expect(result.success).toBeTrue();
  });

  test("deadline on the same day as the start is rejected", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      registrationDeadlineAt: "2026-09-15",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === "registrationDeadlineAt"
        )
      ).toBeTrue();
    }
  });

  test("deadline after the start is rejected", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      registrationDeadlineAt: "2026-09-16",
    });

    expect(result.success).toBeFalse();
  });
});

describe("TournamentSchema bracket release", () => {
  test("em branco é recusada com 'Informe a data.'", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      bracketReleaseAt: "",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path[0] === "bracketReleaseAt"
      );

      expect(issue?.message).toBe("Informe a data.");
    }
  });

  test("no mesmo dia do prazo ou do início passa", () => {
    expect(
      TournamentSchema.safeParse({
        ...buildValidValues(),
        bracketReleaseAt: "2026-09-14",
      }).success
    ).toBeTrue();
    expect(
      TournamentSchema.safeParse({
        ...buildValidValues(),
        bracketReleaseAt: "2026-09-15",
      }).success
    ).toBeTrue();
  });

  test("antes do prazo é recusada com a mensagem do servidor", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      bracketReleaseAt: "2026-09-13",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path[0] === "bracketReleaseAt"
      );

      expect(issue?.message).toBe(
        "A divulgação da chave não pode ser antes do prazo de inscrições."
      );
    }
  });

  test("depois do início é recusada com a mensagem do servidor", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      bracketReleaseAt: "2026-09-16",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path[0] === "bracketReleaseAt"
      );

      expect(issue?.message).toBe(
        "A divulgação da chave não pode ser depois do início do torneio."
      );
    }
  });
});

describe("TournamentSchema tournament window", () => {
  test("end after the start day passes", () => {
    expect(
      TournamentSchema.safeParse({
        ...buildValidValues(),
        endDate: "2026-09-30",
      }).success
    ).toBeTrue();
  });

  test("end on the start day passes", () => {
    expect(
      TournamentSchema.safeParse({
        ...buildValidValues(),
        endDate: "2026-09-15",
      }).success
    ).toBeTrue();
  });

  test("end before the start is rejected on the end field", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      endDate: "2026-09-14",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "endDate")
      ).toBeTrue();
    }
  });

  test("torneio LEGADO sem fim abre mas o salvar recusa até escolher o período", () => {
    // O form do legado chega com `endDate: ""` (fim nulo no servidor): a
    // opção do picker monta só com o início e o SALVAR exige o fim.
    expect(
      buildTournamentRangeOption({ startDate: "2026-09-15" })
    ).toBeDefined();

    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      endDate: "",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const endIssue = result.error.issues.find(
        (issue) => issue.path[0] === "endDate"
      );

      expect(endIssue?.message).toBe("Informe a data.");
    }
  });
});

describe("TournamentSchema address", () => {
  test("com endereço preenchido passa", () => {
    expect(TournamentSchema.safeParse(buildValidValues()).success).toBeTrue();
  });

  test("cep com máscara normaliza igual ao perfil da organização", () => {
    const values = buildValidValues();
    const result = TournamentSchema.safeParse({
      ...values,
      address: { ...values.address, cep: "01001-000" },
    });

    expect(result.success).toBeTrue();
    if (result.success) {
      expect(result.data.address.cep).toBe("01001000");
    }
  });

  test("campo obrigatório vazio barra com a mensagem da organização", () => {
    const values = buildValidValues();
    const result = TournamentSchema.safeParse({
      ...values,
      address: { ...values.address, street: "" },
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "address.street"
      );

      expect(issue?.message).toBe("Campo obrigatório.");
    }
  });

  test("legado sem endereço abre vazio e o salvar exige o CEP", () => {
    // O form do legado chega com o endereço em branco (nulo no servidor): o
    // SALVAR exige o CEP com a mensagem do contrato.
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      address: { cep: "", city: "", number: "", state: "", street: "" },
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path[0] === "address"
      );

      expect(issue?.message).toBe("Informe o CEP.");
    }
  });
});

describe("TournamentSchema matchConfig bestOfSets", () => {
  test("best of 2 sets is rejected", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      matchConfig: {
        ...DEFAULT_MATCH_CONFIG,
        bestOfSets: 2,
      },
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "matchConfig" && issue.path[1] === "bestOfSets"
        )
      ).toBeTrue();
    }
  });

  test.each([1, 3, 5])("best of %d sets passes", (bestOfSets) => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      matchConfig: {
        ...DEFAULT_MATCH_CONFIG,
        bestOfSets,
      },
    });

    expect(result.success).toBeTrue();
  });
});

describe("TournamentSchema duplicate category names", () => {
  test("mesmo nome no mesmo tipo barra o submit nas DUAS linhas", () => {
    const values = buildValidValues();
    const result = TournamentSchema.safeParse({
      ...values,
      categories: [
        { ...values.categories[0], id: "a", name: "Manhã" },
        { ...values.categories[0], id: "b", name: " manhã " },
      ],
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const nameIssues = result.error.issues.filter(
        (issue) => issue.path[0] === "categories" && issue.path[2] === "name"
      );

      expect(nameIssues.map((issue) => issue.path[1])).toEqual([0, 1]);
      expect(nameIssues[0].message).toBe(
        "Já existe uma categoria com esse nome nesse tipo."
      );
    }
  });

  test("mesmo nome em tipo diferente passa", () => {
    const values = buildValidValues();
    const result = TournamentSchema.safeParse({
      ...values,
      categories: [
        { ...values.categories[0], gender: "male", name: "Manhã" },
        { ...values.categories[0], gender: "female", name: "Manhã" },
      ],
    });

    expect(result.success).toBeTrue();
  });
});

describe("tournament date conversion", () => {
  test("epoch ms round-trips through the local calendar date", () => {
    const epochMs = tournamentDateToEpochMs("2026-09-15");

    expect(epochMsToTournamentDate(epochMs)).toBe("2026-09-15");
  });
});

describe("opção do DateRangePicker", () => {
  test("monta rótulo e wire com as duas datas", () => {
    expect(
      buildTournamentRangeOption({
        endDate: "2026-10-20",
        startDate: "2026-10-13",
      })
    ).toEqual({
      label: "13/10/2026 a 20/10/2026",
      value: '{"end":"2026-10-20","start":"2026-10-13"}',
    });
  });

  test("sem o fim o campo mostra só o início (torneio legado)", () => {
    expect(buildTournamentRangeOption({ startDate: "2026-10-13" })).toEqual({
      label: "Início 13/10/2026",
      value: '{"end":"2026-10-13","start":"2026-10-13"}',
    });
  });

  test("sem início não há opção", () => {
    expect(buildTournamentRangeOption({})).toBe(undefined);
    expect(buildTournamentRangeOption({ endDate: "2026-10-20" })).toBe(
      undefined
    );
  });

  test("lê a opção de volta para as datas do formulário", () => {
    expect(
      parseTournamentRangeValue('{"start":"2026-10-13","end":"2026-10-20"}')
    ).toEqual({ endDate: "2026-10-20", startDate: "2026-10-13" });
  });

  test("wire inválido não vira data", () => {
    expect(parseTournamentRangeValue("nao-e-json")).toBeNull();
    expect(parseTournamentRangeValue('{"start":"2026-10-13"}')).toBeNull();
  });
});
