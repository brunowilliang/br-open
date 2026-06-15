import { describe, expect, it } from "bun:test";
import type { FieldErrors } from "react-hook-form";

import type { LeagueScreenValues } from "./form-schema";
import { resolveLeagueFormInvalidSubmission } from "./form-validation";

describe("resolveLeagueFormInvalidSubmission", () => {
  it("points category errors to the categories tab", () => {
    const result = resolveLeagueFormInvalidSubmission({
      categories: {
        message: "Informe pelo menos uma categoria.",
        type: "too_small",
      },
    } as FieldErrors<LeagueScreenValues>);

    expect(result).toEqual({
      description: "Informe pelo menos uma categoria.",
      label: "Categorias incompletas",
      tab: "categories",
    });
  });

  it("points location errors to the location tab", () => {
    const result = resolveLeagueFormInvalidSubmission({
      city: {
        message: "Informe a cidade.",
        type: "too_small",
      },
      state: {
        message: "Informe o estado.",
        type: "too_small",
      },
    } as FieldErrors<LeagueScreenValues>);

    expect(result).toEqual({
      description: "Informe a cidade.",
      label: "Localização incompleta",
      tab: "location",
    });
  });

  it("points nested rule errors to the rules tab", () => {
    const result = resolveLeagueFormInvalidSubmission({
      ruleConfig: {
        matchConfig: {
          bestOfSets: {
            message: "Use melhor de 1, 3 ou 5 sets.",
            type: "custom",
          },
        },
      },
    } as FieldErrors<LeagueScreenValues>);

    expect(result).toEqual({
      description: "Use melhor de 1, 3 ou 5 sets.",
      label: "Regras incompletas",
      tab: "rules",
    });
  });
});
