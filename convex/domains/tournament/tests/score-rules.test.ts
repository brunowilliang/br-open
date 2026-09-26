import { describe, expect, it } from "bun:test";

import {
  resolveResultEditReverb,
  serializeMatchScore,
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "../score-rules";
import {
  EditMatchResultSchema,
  PublishMatchResultSchema,
  type TournamentMatchScore,
} from "../contract";
import { DEFAULT_MATCH_CONFIG } from "../../match/contract";

describe("resolveResultEditReverb (IBX-0028)", () => {
  it("mesmo vencedor: edição só de placar não mexe na chave", () => {
    expect(
      resolveResultEditReverb({
        newWinnerEntryId: "entry-a",
        nextMatchExists: true,
        nextMatchPublished: true,
        oldWinnerEntryId: "entry-a",
      })
    ).toEqual({ action: "keep", error: null });
  });

  it("sem partida seguinte (final): mantém", () => {
    expect(
      resolveResultEditReverb({
        newWinnerEntryId: "entry-b",
        nextMatchExists: false,
        nextMatchPublished: false,
        oldWinnerEntryId: "entry-a",
      })
    ).toEqual({ action: "keep", error: null });
  });

  it("vencedor trocado e próxima não publicada: swap", () => {
    expect(
      resolveResultEditReverb({
        newWinnerEntryId: "entry-b",
        nextMatchExists: true,
        nextMatchPublished: false,
        oldWinnerEntryId: "entry-a",
      })
    ).toEqual({ action: "swap", error: null });
  });

  it("vencedor trocado e próxima já jogada: conflito", () => {
    const result = resolveResultEditReverb({
      newWinnerEntryId: "entry-b",
      nextMatchExists: true,
      nextMatchPublished: true,
      oldWinnerEntryId: "entry-a",
    });

    expect(result.action).toBe("conflict");
    expect(result.error).toContain("rodada seguinte já foi jogada");
  });
});

describe("EditMatchResultSchema (IBX-0028)", () => {
  it("aceita placar jogado sem W.O.", () => {
    const parsed = EditMatchResultSchema.safeParse({
      matchId: "match-1",
      score: {
        sets: [{ aGames: 6, bGames: 3, kind: "set" }],
        winnerEntryId: "entry-a",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("exige exatamente 1 set placeholder em W.O.", () => {
    const twoSets = EditMatchResultSchema.safeParse({
      matchId: "match-1",
      score: {
        sets: [
          { aGames: 0, bGames: 0, kind: "set" },
          { aGames: 0, bGames: 0, kind: "set" },
        ],
        winnerEntryId: "entry-a",
      },
      walkover: true,
    });

    expect(twoSets.success).toBe(false);
    expect(
      PublishMatchResultSchema.safeParse({
        matchId: "match-1",
        score: {
          sets: [{ aGames: 0, bGames: 0, kind: "set" }],
          winnerEntryId: "entry-a",
        },
        walkover: true,
      }).success
    ).toBe(true);
  });
});

describe("validateWalkoverWinner (M4)", () => {
  it("rejeita vencedor fora dos lados do confronto", () => {
    const result = validateWalkoverWinner({
      entryAId: "entry-a",
      entryBId: "entry-b",
      winnerEntryId: "entry-c",
    });

    expect(result.error).toBe(
      "O vencedor informado não participa desse confronto."
    );
  });

  it("exige vencedor no W.O. (o campo é nullish desde o REWORK-2)", () => {
    const result = validateWalkoverWinner({
      entryAId: "entry-a",
      entryBId: "entry-b",
      winnerEntryId: null,
    });

    expect(result.error).toBe("Informe o vencedor do W.O.");
  });
});

describe("tieBreak livre do torneio (REWORK-2)", () => {
  const validate = (score: TournamentMatchScore) =>
    validateTournamentMatchScore({
      entryAId: "entry-a",
      entryBId: "entry-b",
      matchConfig: { ...DEFAULT_MATCH_CONFIG, bestOfSets: 1 },
      score,
    });

  it("7x6 com TB 7-3 no vocabulário A/B é válido", () => {
    const result = validate({
      sets: [
        {
          aGames: 7,
          bGames: 6,
          kind: "set",
          tieBreak: { aPoints: 7, bPoints: 3 },
        },
      ],
      winnerEntryId: "entry-a",
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entry-a");
  });

  it("TB livre: sem direção exigida, pontos de qualquer lado são aceitos", () => {
    const result = validate({
      sets: [
        {
          aGames: 7,
          bGames: 6,
          kind: "set",
          tieBreak: { aPoints: 3, bPoints: 7 },
        },
      ],
      winnerEntryId: "entry-a",
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entry-a");
  });

  it("TB livre: sem padrão de set exigido (7x5 com TB é aceito)", () => {
    const result = validate({
      sets: [
        {
          aGames: 7,
          bGames: 5,
          kind: "set",
          tieBreak: { aPoints: 7, bPoints: 3 },
        },
      ],
      winnerEntryId: "entry-a",
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entry-a");
  });

  it("placar sem TB segue válido (resultado antigo)", () => {
    const result = validate({
      sets: [{ aGames: 7, bGames: 6, kind: "set" }],
      winnerEntryId: "entry-a",
    });
    expect(result.error).toBeNull();
  });

  it("serializeMatchScore preserva o mini-placar do TB", () => {
    const serialized = serializeMatchScore({
      sets: [
        {
          aGames: 7,
          bGames: 6,
          kind: "set",
          tieBreak: { aPoints: 7, bPoints: 3 },
        },
      ],
      winnerEntryId: "entry-a",
    });
    expect(serialized.sets[0].tieBreak).toEqual({ aPoints: 7, bPoints: 3 });
  });

  it("PublishMatchResultSchema rejeita TB no placeholder de W.O.", () => {
    const parsed = PublishMatchResultSchema.safeParse({
      matchId: "m1",
      score: {
        sets: [
          {
            aGames: 0,
            bGames: 0,
            kind: "set",
            tieBreak: { aPoints: 7, bPoints: 3 },
          },
        ],
        winnerEntryId: "entry-a",
      },
      walkover: true,
    });
    expect(parsed.success).toBeFalse();
  });
});
