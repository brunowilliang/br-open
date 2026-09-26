import { DEFAULT_MATCH_CONFIG } from "@convex/domains/match/contract";
import { describe, expect, test } from "bun:test";

import {
  epochMsToTournamentDate,
  TournamentSchema,
  tournamentDateToEpochMs,
} from "./form-schema";

function buildValidValues() {
  return {
    approvalMode: "auto",
    avatarStorageId: null,
    categories: [
      {
        entryFeeCents: 0,
        gender: "male",
        maxEntries: null,
        modality: "singles",
      },
    ],
    city: "Sao Paulo",
    courts: [],
    coverStorageId: null,
    description: undefined,
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

describe("tournament date conversion", () => {
  test("epoch ms round-trips through the local calendar date", () => {
    const epochMs = tournamentDateToEpochMs("2026-09-15");

    expect(epochMsToTournamentDate(epochMs)).toBe("2026-09-15");
  });
});
