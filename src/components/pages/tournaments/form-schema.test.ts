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
    allowMultipleEntriesPerType: true,
    approvalMode: "auto",
    avatarStorageId: null,
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
    city: "Sao Paulo",
    courts: [],
    coverStorageId: null,
    description: undefined,
    endDate: "2026-09-20",
    locationNotes: undefined,
    matchConfig: {
      ...DEFAULT_MATCH_CONFIG,
    },
    name: "Circuito Paulista",
    registrationDeadlineAt: "2026-09-14",
    startDate: "2026-09-15",
    state: "SP",
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

describe("TournamentSchema tournament window", () => {
  test("end after the start day passes", () => {
    expect(
      TournamentSchema.safeParse({
        ...buildValidValues(),
        endDate: "2026-09-30",
      }).success
    ).toBeTrue();
  });

  test("end on the start day is rejected with the next-day copy", () => {
    const result = TournamentSchema.safeParse({
      ...buildValidValues(),
      endDate: "2026-09-15",
    });

    expect(result.success).toBeFalse();
    if (!result.success) {
      const endIssue = result.error.issues.find(
        (issue) => issue.path[0] === "endDate"
      );

      expect(endIssue?.message).toBe(
        "O fim do torneio deve ser pelo menos o dia seguinte ao início."
      );
    }
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
