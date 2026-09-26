import { describe, expect, it } from "bun:test";

import type { MatchScore } from "../contract";
import { resolveMatchScoreOutcome } from "../score-rules";

describe("resolveMatchScoreOutcome", () => {
  const freeScore = (input: {
    sets: MatchScore["sets"];
    winnerMembershipId?: null | string;
  }) => ({
    challengedMembershipId: "membership-2",
    challengerMembershipId: "membership-1",
    score: input,
  });

  it("deriva o vencedor pelas linhas vencidas (explícito null)", () => {
    const outcome = resolveMatchScoreOutcome(
      freeScore({
        sets: [
          { challengedGames: 3, challengerGames: 6, kind: "set" },
          { challengedGames: 4, challengerGames: 6, kind: "set" },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("aceita 3x3 e números livres; empate total exige vencedor explícito", () => {
    const explicit = resolveMatchScoreOutcome(
      freeScore({
        sets: [{ challengedGames: 3, challengerGames: 3, kind: "set" }],
        winnerMembershipId: "membership-2",
      })
    );

    expect(explicit.error).toBeNull();
    expect(explicit.winnerMembershipId).toBe("membership-2");

    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 3, challengerGames: 3, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("linha avulsa de tie-break conta como linha e aceita pontos livres", () => {
    const outcome = resolveMatchScoreOutcome(
      freeScore({
        sets: [
          { challengedGames: 3, challengerGames: 6, kind: "set" },
          { challengedGames: 3, challengerGames: 7, kind: "tiebreak" },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("tieBreak anexo é livre (sem forma exigida), inclusive em super TB", () => {
    const sets: MatchScore["sets"] = [
      {
        challengedGames: 7,
        challengerGames: 6,
        kind: "set",
        tieBreak: { challengedPoints: 6, challengerPoints: 7 },
      },
      {
        challengedGames: 5,
        challengerGames: 7,
        kind: "set",
        tieBreak: { challengedPoints: 3, challengerPoints: 7 },
      },
      {
        challengedGames: 8,
        challengerGames: 10,
        kind: "super_tiebreak",
        tieBreak: { challengedPoints: 8, challengerPoints: 10 },
      },
    ];
    expect(
      resolveMatchScoreOutcome(freeScore({ sets, winnerMembershipId: null }))
        .error
    ).toBeNull();
  });

  it("6x6 com TB anexo decide a linha (sem vencedor explícito)", () => {
    const outcome = resolveMatchScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 6,
            kind: "set",
            tieBreak: { challengedPoints: 3, challengerPoints: 7 },
          },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("6x6 sem TB é empate real (explícito exigido)", () => {
    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 6, challengerGames: 6, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("7x6 com TB segue decidido pelos games da linha", () => {
    const outcome = resolveMatchScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 7,
            kind: "set",
            // TB invertido de propósito: na linha, os games mandam.
            tieBreak: { challengedPoints: 7, challengerPoints: 3 },
          },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("TB anexo empatado = linha de ninguém", () => {
    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [
            {
              challengedGames: 6,
              challengerGames: 6,
              kind: "set",
              tieBreak: { challengedPoints: 5, challengerPoints: 5 },
            },
          ],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("multi-linha: o TB anexo decide o confronto", () => {
    const outcome = resolveMatchScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 6,
            kind: "set",
            tieBreak: { challengedPoints: 7, challengerPoints: 3 },
          },
          { challengedGames: 4, challengerGames: 4, kind: "set" },
        ],
        winnerMembershipId: null,
      })
    );

    // Linha 1 vai pro desafiado pelo TB; linha 2 (4x4 sem TB) é de ninguém.
    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-2");
  });

  it("rejeita vencedor explícito que contradiz o placar", () => {
    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [
            { challengedGames: 3, challengerGames: 6, kind: "set" },
            { challengedGames: 4, challengerGames: 6, kind: "set" },
          ],
          winnerMembershipId: "membership-2",
        })
      ).error
    ).toBe("O vencedor informado não corresponde ao resultado.");
  });

  it("rejeita vencedor fora dos participantes", () => {
    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 3, challengerGames: 6, kind: "set" }],
          winnerMembershipId: "membership-3",
        })
      ).error
    ).toBe("O vencedor informado não participa dessa partida.");
  });

  it("sanidade da regra: valores inválidos e placar vazio são rejeitados", () => {
    expect(
      resolveMatchScoreOutcome(
        freeScore({
          sets: [{ challengedGames: -1, challengerGames: 6, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("Placar inválido.");

    expect(
      resolveMatchScoreOutcome(
        freeScore({ sets: [], winnerMembershipId: null })
      ).error
    ).toBe("Informe pelo menos uma linha do placar.");
  });
});
