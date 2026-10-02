import { describe, expect, it } from "bun:test";

import type { TournamentMatchWithSides } from "./bracket-view";
import type { PlayerMatch } from "./match-agreement-view";
import { selectPlayerNextMatches } from "./player-overview-derived";

function buildMatch(
  overrides: Partial<TournamentMatchWithSides> = {}
): TournamentMatchWithSides {
  return {
    categoryId: "cat-1",
    courtId: null,
    entryA: null,
    entryAId: "entry-me",
    entryB: null,
    entryBId: "entry-them",
    id: "match-1",
    matchDate: null,
    round: 1,
    score: null,
    slotInRound: 0,
    startMinute: null,
    status: "pending",
    walkover: false,
    winnerEntryId: null,
    ...overrides,
  } as TournamentMatchWithSides;
}

const VIEWER = ["entry-me"];

const IDLE_CHANNEL = {
  agreedAt: null,
  proposal: null,
  proposedAt: null,
  proposedByMe: false,
  proposedBySide: null,
  state: "idle",
} as const;

const PROPOSAL = {
  courtId: "court-1",
  endMinute: 600,
  matchDate: "2026-10-04",
  startMinute: 540,
};

function buildPlayerMatch(input: {
  match: TournamentMatchWithSides;
  schedule?: Partial<PlayerMatch["agreements"]["schedule"]>;
  score?: Partial<PlayerMatch["agreements"]["score"]>;
}): PlayerMatch {
  return {
    agreements: {
      matchId: input.match.id,
      schedule: { ...IDLE_CHANNEL, ...input.schedule },
      score: { ...IDLE_CHANNEL, ...input.score },
    },
    match: input.match,
    mySide: "a",
    totalRounds: 1,
  };
}

function idsOf(matches: readonly TournamentMatchWithSides[]): string[] {
  return matches.map((match) => match.id);
}

describe("selectPlayerNextMatches", () => {
  it("sem data o confronto conta: a chave saiu e o jogo é dele", () => {
    const matches = selectPlayerNextMatches({
      matches: [buildMatch()],
      playerMatches: [],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual(["match-1"]);
    expect(matches[0]?.matchDate).toBeNull();
    expect(matches[0]?.status).toBe("pending");
  });

  it("fica fora o que não é jogo dele, o que tem lado indefinido e o decidido", () => {
    const matches = selectPlayerNextMatches({
      matches: [
        buildMatch({ entryAId: "entry-x", entryBId: "entry-y", id: "alheio" }),
        buildMatch({ entryBId: null, id: "lado-aberto" }),
        buildMatch({ id: "encerrado", status: "finished" }),
        buildMatch({ id: "decidido", winnerEntryId: "entry-me" }),
      ],
      playerMatches: [],
      viewerEntryIds: VIEWER,
    });

    expect(matches).toEqual([]);
  });

  it("o viewer pode estar no lado B", () => {
    const matches = selectPlayerNextMatches({
      matches: [
        buildMatch({
          entryAId: "entry-them",
          entryBId: "entry-me",
          id: "lado-b",
        }),
      ],
      playerMatches: [],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual(["lado-b"]);
  });

  it("quem espera o MEU aceite vem primeiro; a proposta enviada vem antes do A definir", () => {
    const aguardaMeuAceite = buildMatch({ id: "aguarda-meu-aceite" });
    const propostaEnviada = buildMatch({ id: "proposta-enviada" });
    const aDefinir = buildMatch({ id: "a-definir" });
    const matches = selectPlayerNextMatches({
      matches: [aDefinir, propostaEnviada, aguardaMeuAceite],
      playerMatches: [
        buildPlayerMatch({
          match: aguardaMeuAceite,
          schedule: {
            proposal: PROPOSAL,
            proposedAt: 1,
            proposedBySide: "b",
            state: "negotiating",
          },
        }),
        buildPlayerMatch({
          match: propostaEnviada,
          schedule: {
            proposal: PROPOSAL,
            proposedAt: 1,
            proposedByMe: true,
            proposedBySide: "a",
            state: "negotiating",
          },
        }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual([
      "aguarda-meu-aceite",
      "proposta-enviada",
      "a-definir",
    ]);
  });

  it("resultado pendente e agendado sem pendência ficam antes do A definir", () => {
    const pendenteDeResultado = buildMatch({ id: "pendente-resultado" });
    const agendadoLimpo = buildMatch({
      id: "agendado-limpo",
      matchDate: "2026-10-04",
      startMinute: 540,
      status: "scheduled",
    });
    const aDefinir = buildMatch({ id: "a-definir" });
    const matches = selectPlayerNextMatches({
      matches: [aDefinir, agendadoLimpo, pendenteDeResultado],
      playerMatches: [
        buildPlayerMatch({
          match: pendenteDeResultado,
          schedule: {
            agreedAt: 1,
            proposal: PROPOSAL,
            proposedAt: 1,
            proposedBySide: "a",
            state: "agreed",
          },
        }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual([
      "pendente-resultado",
      "agendado-limpo",
      "a-definir",
    ]);
  });

  it("a ação do resultado também espera o meu aceite no topo da fila", () => {
    const resultadoRecebido = buildMatch({ id: "resultado-recebido" });
    const horarioRecebido = buildMatch({ id: "horario-recebido" });
    const matches = selectPlayerNextMatches({
      matches: [horarioRecebido, resultadoRecebido],
      playerMatches: [
        buildPlayerMatch({
          match: resultadoRecebido,
          score: {
            proposal: {
              score: { sets: [], winnerEntryId: null },
              walkover: false,
            },
            proposedAt: 1,
            proposedBySide: "b",
            state: "negotiating",
          },
        }),
        buildPlayerMatch({
          match: horarioRecebido,
          schedule: {
            proposal: PROPOSAL,
            proposedAt: 1,
            proposedBySide: "b",
            state: "negotiating",
          },
        }),
      ],
      viewerEntryIds: VIEWER,
    });

    // Mesmo degrau (os dois esperam o meu aceite) e sem data para desempatar:
    // a ordem preserva a entrada, como no sort estável do motor.
    expect(idsOf(matches)).toEqual(["horario-recebido", "resultado-recebido"]);
  });

  it("sem a leitura do acerto a data decide, e o A definir fica por último", () => {
    const comData = buildMatch({
      id: "com-data",
      matchDate: "2026-10-04",
      startMinute: 540,
      status: "scheduled",
    });
    const semData = buildMatch({ id: "sem-data" });
    const matches = selectPlayerNextMatches({
      matches: [semData, comData],
      playerMatches: [],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual(["com-data", "sem-data"]);
  });

  it("dentro do mesmo degrau vale a rodada e depois a data", () => {
    const matches = selectPlayerNextMatches({
      matches: [
        buildMatch({
          id: "final",
          matchDate: "2026-10-04",
          round: 2,
          status: "scheduled",
        }),
        buildMatch({
          id: "semifinal",
          matchDate: "2026-10-05",
          round: 1,
          status: "scheduled",
        }),
      ],
      playerMatches: [],
      viewerEntryIds: VIEWER,
    });

    expect(idsOf(matches)).toEqual(["semifinal", "final"]);
  });
});
