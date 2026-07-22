import { describe, expect, it } from "bun:test";

import { getCreateChallengeErrorToast } from "./challenge-feedback";

describe("getCreateChallengeErrorToast", () => {
  it("uses the opponent-specific copy before the generic active-limit copy", () => {
    const result = getCreateChallengeErrorToast(
      "O adversário já atingiu o limite de desafios ativos."
    );

    expect(result).toEqual({
      description:
        "Esse jogador já tem o máximo de desafios ativos nesta liga.",
      id: "create-challenge-opponent-limit-error",
      label: "Adversário indisponível",
      variant: "danger",
    });
  });

  it("keeps the viewer active-limit copy for own limit failures", () => {
    const result = getCreateChallengeErrorToast(
      "Você já atingiu o limite de desafios ativos."
    );

    expect(result).toEqual({
      description:
        "Você já tem o máximo de desafios em andamento. Conclua um para criar outro.",
      id: "create-challenge-active-limit-error",
      label: "Limite de desafios ativos",
      variant: "danger",
    });
  });
});
