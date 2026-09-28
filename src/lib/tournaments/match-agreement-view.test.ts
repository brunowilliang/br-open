import { describe, expect, test } from "bun:test";

import type { TournamentMatch } from "@convex/domains/tournament/contract";

import {
  buildPlayerAgreementChip,
  buildPlayerAgreementMenu,
  buildPlayerAgreementScheduleProposal,
  buildPlayerAgreementScoreProposal,
  isMatchAgreementLocked,
  resolveTableWalkoverWinnerEntryId,
  selectNegotiablePlayerMatches,
  type PlayerMatch,
} from "./match-agreement-view";

type ChannelView = PlayerMatch["agreements"]["schedule"];

function buildIdleChannel(): ChannelView {
  return {
    agreedAt: null,
    proposal: null,
    proposedAt: null,
    proposedByMe: false,
    proposedBySide: null,
    state: "idle",
  };
}

function buildChannel(
  overrides: Partial<ChannelView> & { proposal?: unknown }
): ChannelView {
  return { ...buildIdleChannel(), ...overrides } as ChannelView;
}

type ScoreChannelView = PlayerMatch["agreements"]["score"];

function buildScoreChannel(
  overrides: Partial<ScoreChannelView> & { proposal?: unknown }
): ScoreChannelView {
  return { ...buildIdleChannel(), ...overrides } as ScoreChannelView;
}

function buildPlayerMatch(input: {
  agreements?: Partial<PlayerMatch["agreements"]>;
  match?: Partial<TournamentMatch>;
  mySide?: "a" | "b";
}): PlayerMatch {
  const match = {
    categoryId: "cat-1",
    courtId: "court-qa",
    entryAId: "entry-me",
    entryBId: "entry-them",
    id: "match-1",
    matchDate: null,
    round: 2,
    score: null,
    slotInRound: 0,
    startMinute: null,
    status: "pending",
    walkover: false,
    winnerEntryId: null,
    ...input.match,
  } as TournamentMatch;

  return {
    agreements: {
      matchId: match.id,
      schedule: buildChannel({}),
      score: buildScoreChannel({}),
      ...input.agreements,
    },
    match,
    mySide: input.mySide ?? "a",
    totalRounds: 2,
  };
}

const SCHEDULE_PROPOSAL = {
  courtId: "court-qa",
  endMinute: 690,
  matchDate: "2026-10-08",
  startMinute: 600,
};

const SCORE_PROPOSAL: NonNullable<
  PlayerMatch["agreements"]["score"]["proposal"]
> = {
  score: {
    sets: [
      { aGames: 6, bGames: 4, kind: "set" },
      { aGames: 3, bGames: 6, kind: "set" },
      { aGames: 7, bGames: 5, kind: "set" },
    ],
    winnerEntryId: "entry-me",
  },
  walkover: false,
};

describe("selectNegotiablePlayerMatches", () => {
  test("keeps what can still be combined and sorts by round", () => {
    const selected = selectNegotiablePlayerMatches([
      buildPlayerMatch({ match: { id: "final", round: 2 } }),
      buildPlayerMatch({
        match: { id: "finished", round: 1, status: "finished" },
      }),
      buildPlayerMatch({ match: { id: "bye", round: 1, status: "walkover" } }),
      buildPlayerMatch({ match: { entryBId: null, id: "half", round: 1 } }),
      buildPlayerMatch({
        match: { id: "first", round: 1, status: "scheduled" },
      }),
    ]);

    expect(selected.map((playerMatch) => playerMatch.match.id)).toEqual([
      "first",
      "final",
    ]);
  });

  test("a decided match leaves the list even with a scheduled status", () => {
    const selected = selectNegotiablePlayerMatches([
      buildPlayerMatch({
        match: {
          id: "decided",
          status: "scheduled",
          winnerEntryId: "entry-me",
        },
      }),
    ]);

    expect(selected).toEqual([]);
  });
});

describe("isMatchAgreementLocked", () => {
  test("closed tournament or decided match locks the negotiation", () => {
    const open = {
      matchStatus: "scheduled",
      tournamentStatus: "ongoing",
      winnerEntryId: null,
    };

    expect(isMatchAgreementLocked(open)).toBe(false);
    expect(
      isMatchAgreementLocked({ ...open, tournamentStatus: "cancelled" })
    ).toBe(true);
    expect(
      isMatchAgreementLocked({ ...open, tournamentStatus: "finished" })
    ).toBe(true);
    expect(isMatchAgreementLocked({ ...open, matchStatus: "finished" })).toBe(
      true
    );
    expect(isMatchAgreementLocked({ ...open, winnerEntryId: "entry-me" })).toBe(
      true
    );
  });
});

describe("buildPlayerAgreementMenu", () => {
  test("sem nada na mesa: só o horário, nenhum verbo de placar", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({}),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.kind)).toEqual(["propose_schedule"]);
    expect(items.map((item) => item.label)).toEqual(["Propor horário"]);
  });

  test("torneio só sorteado: o placar não aparece no menu", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            agreedAt: 1,
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: false,
            proposedBySide: "b",
            state: "agreed",
          }),
        },
        match: {
          matchDate: "2026-10-08",
          startMinute: 600,
          status: "scheduled",
        },
      }),
      tournamentStatus: "drawn",
    });

    // O servidor só deixa combinar resultado com o torneio em andamento; o
    // horário combinado continua remarcável.
    expect(items.map((item) => item.kind)).toEqual(["counter_schedule"]);
    expect(items.map((item) => item.label)).toEqual(["Propor outro horário"]);
  });

  test("horário do outro lado: aprovar, recusar ou propor outro, sem placar", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: false,
            proposedBySide: "b",
            state: "negotiating",
          }),
        },
      }),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.kind)).toEqual([
      "approve_schedule",
      "decline_schedule",
      "counter_schedule",
    ]);
    expect(items.map((item) => item.label)).toEqual([
      "Aprovar horário",
      "Recusar horário",
      "Propor outro horário",
    ]);
  });

  test("placar do outro lado: só placar, mesmo com o horário aberto", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          score: buildScoreChannel({
            proposal: SCORE_PROPOSAL,
            proposedByMe: false,
            proposedBySide: "b",
            state: "negotiating",
          }),
        },
      }),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.label)).toEqual([
      "Aprovar resultado",
      "Recusar resultado",
      "Enviar outro resultado",
    ]);
  });

  test("proposta minha: propor outro horário ou cancelar, sem verbo de placar", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: true,
            proposedBySide: "a",
            state: "negotiating",
          }),
        },
      }),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.kind)).toEqual([
      "counter_schedule",
      "cancel_schedule",
    ]);
    expect(items.map((item) => item.label)).toEqual([
      "Propor outro horário",
      "Cancelar proposta",
    ]);
  });

  test("horário combinado e placar sem nada na mesa: os dois convivem", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            agreedAt: 1,
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: false,
            proposedBySide: "b",
            state: "agreed",
          }),
        },
        match: {
          matchDate: "2026-10-08",
          startMinute: 600,
          status: "scheduled",
        },
      }),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.kind)).toEqual([
      "send_score",
      "counter_schedule",
    ]);
  });

  test("placar na mesa depois do horário combinado: só o placar", () => {
    const items = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            agreedAt: 1,
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: true,
            proposedBySide: "a",
            state: "agreed",
          }),
          score: buildScoreChannel({
            proposal: SCORE_PROPOSAL,
            proposedByMe: true,
            proposedBySide: "a",
            state: "negotiating",
          }),
        },
        match: {
          matchDate: "2026-10-08",
          startMinute: 600,
          status: "scheduled",
        },
      }),
      tournamentStatus: "ongoing",
    });

    expect(items.map((item) => item.label)).toEqual([
      "Enviar outro resultado",
      "Cancelar resultado",
    ]);
  });

  test("a dupla de quem propôs só propõe de novo; o autor retira", () => {
    const partnerMenu = buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch: buildPlayerMatch({
        agreements: {
          schedule: buildChannel({
            proposal: SCHEDULE_PROPOSAL,
            proposedByMe: false,
            proposedBySide: "a",
            state: "negotiating",
          }),
        },
        mySide: "a",
      }),
      tournamentStatus: "ongoing",
    });

    // Lado propôs (`proposedBySide` == `mySide`), perfil não: sem Aprovar/Recusar
    // e sem Cancelar — o servidor recusa a resposta e a retirada do parceiro.
    expect(partnerMenu.map((item) => item.label)).toEqual([
      "Propor outro horário",
    ]);

    expect(
      buildPlayerAgreementMenu({
        isMatchLocked: false,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
          mySide: "a",
        }),
        tournamentStatus: "ongoing",
      }).map((item) => item.label)
    ).toEqual(["Propor outro horário", "Cancelar proposta"]);

    expect(
      buildPlayerAgreementMenu({
        isMatchLocked: false,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
          mySide: "a",
        }),
        tournamentStatus: "ongoing",
      }).map((item) => item.label)
    ).toEqual(["Aprovar horário", "Recusar horário", "Propor outro horário"]);
  });

  test("decided match or closed tournament: no menu at all", () => {
    expect(
      buildPlayerAgreementMenu({
        isMatchLocked: true,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
        tournamentStatus: "ongoing",
      })
    ).toEqual([]);
  });
});

describe("buildPlayerAgreementChip", () => {
  test("nothing on the table: no chip", () => {
    expect(
      buildPlayerAgreementChip({ playerMatch: buildPlayerMatch({}) })
    ).toBeNull();
  });

  test("my schedule proposal says it was sent", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({ color: "warning", label: "Proposta enviada", variant: "soft" });
  });

  test("proposal from the other side asks me to confirm", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({ color: "accent", label: "Confirmar horário", variant: "soft" });
  });

  test("a dupla de quem propôs lê a proposta do lado como enviada", () => {
    // `proposedByMe` é do PERFIL; o chip segue o LADO (`proposedBySide`), senão
    // o parceiro veria "Confirmar horário" num canal que o lado dele já propôs.
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: false,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
          mySide: "a",
        }),
      })
    ).toEqual({ color: "warning", label: "Proposta enviada", variant: "soft" });
  });

  test("schedule agreed without a result: pending result", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "agreed",
            }),
          },
          match: {
            matchDate: "2026-10-08",
            startMinute: 600,
            status: "scheduled",
          },
        }),
      })
    ).toEqual({
      color: "warning",
      label: "Pendente de resultado",
      variant: "soft",
    });
  });

  test("my score submission says it was sent", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal: SCORE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({
      color: "warning",
      label: "Resultado enviado",
      variant: "soft",
    });
  });

  test("result from the other side asks me to confirm", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal: SCORE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({
      color: "accent",
      label: "Confirmar resultado",
      variant: "soft",
    });
  });

  test("reopened schedule asks the other side to reapprove", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({
      color: "warning",
      label: "Aguardando reaprovação",
      variant: "soft",
    });
  });

  test("reopened schedule from the other side asks me to confirm again", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({ color: "accent", label: "Confirmar horário", variant: "soft" });
  });

  test("published result or decided match: no chip (the status chip shows)", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              agreedAt: 2,
              proposal: SCORE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "agreed",
            }),
          },
          match: {
            matchDate: "2026-10-08",
            score: {
              sets: SCORE_PROPOSAL.score.sets,
              winnerEntryId: "entry-me",
            },
            startMinute: 600,
            status: "finished",
            winnerEntryId: "entry-me",
          },
        }),
      })
    ).toBeNull();

    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          match: { status: "scheduled", winnerEntryId: "entry-me" },
        }),
      })
    ).toBeNull();
  });

  test("reopened schedule asks the other side to reapprove", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({
      color: "warning",
      label: "Aguardando reaprovação",
      variant: "soft",
    });
  });

  test("reopened schedule from the other side asks me to confirm again", () => {
    expect(
      buildPlayerAgreementChip({
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({ color: "accent", label: "Confirmar horário", variant: "soft" });
  });
});

describe("buildPlayerAgreementScheduleProposal", () => {
  const courts = [{ id: "court-qa", name: "Quadra QA" }];

  test("negotiating proposal comes with the court name resolved", () => {
    expect(
      buildPlayerAgreementScheduleProposal({
        courts,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: SCHEDULE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({
      courtName: "Quadra QA",
      matchDate: "2026-10-08",
      startMinute: 600,
    });
  });

  test("court outside the list leaves the slot empty, never a fake name", () => {
    expect(
      buildPlayerAgreementScheduleProposal({
        courts,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              proposal: { ...SCHEDULE_PROPOSAL, courtId: null },
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
      })
    ).toEqual({ courtName: null, matchDate: "2026-10-08", startMinute: 600 });
  });

  test("agreed schedule is the match date, not a proposal", () => {
    expect(
      buildPlayerAgreementScheduleProposal({
        courts,
        playerMatch: buildPlayerMatch({
          agreements: {
            schedule: buildChannel({
              agreedAt: 1,
              proposal: SCHEDULE_PROPOSAL,
              proposedByMe: true,
              proposedBySide: "a",
              state: "agreed",
            }),
          },
          match: {
            matchDate: "2026-10-08",
            startMinute: 600,
            status: "scheduled",
          },
        }),
      })
    ).toBeNull();
  });
});

describe("buildPlayerAgreementScoreProposal", () => {
  test("negotiating score comes as the proposed sets", () => {
    expect(
      buildPlayerAgreementScoreProposal({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal: SCORE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        }),
        sideOrder: "match",
      })
    ).toEqual({ sets: SCORE_PROPOSAL.score.sets, walkoverWinner: null });
  });

  test("viewer drawn first on side B: the score flips with the card", () => {
    const proposal = {
      score: {
        sets: [
          { aGames: 6, bGames: 4, kind: "set" as const, tieBreak: null },
          {
            aGames: 6,
            bGames: 7,
            kind: "set" as const,
            tieBreak: { aPoints: 4, bPoints: 7 },
          },
        ],
        winnerEntryId: null,
      },
      walkover: false,
    };

    expect(
      buildPlayerAgreementScoreProposal({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal,
              proposedBySide: "a",
              state: "negotiating",
            }),
          },
          mySide: "b",
        }),
        sideOrder: "viewer",
      })
    ).toEqual({
      sets: [
        { aGames: 4, bGames: 6, kind: "set" },
        {
          aGames: 7,
          bGames: 6,
          kind: "set",
          tieBreak: { aPoints: 7, bPoints: 4 },
        },
      ],
      walkoverWinner: null,
    });
  });

  test("viewer on side A, or the match order: nothing flips", () => {
    const onSideA = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          proposal: SCORE_PROPOSAL,
          proposedBySide: "b",
          state: "negotiating",
        }),
      },
    });
    const viewerFirstOnSideB = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          proposal: SCORE_PROPOSAL,
          proposedBySide: "a",
          state: "negotiating",
        }),
      },
      mySide: "b",
    });

    expect(
      buildPlayerAgreementScoreProposal({
        playerMatch: onSideA,
        sideOrder: "viewer",
      })
    ).toEqual({ sets: SCORE_PROPOSAL.score.sets, walkoverWinner: null });
    expect(
      buildPlayerAgreementScoreProposal({
        playerMatch: viewerFirstOnSideB,
        sideOrder: "match",
      })
    ).toEqual({ sets: SCORE_PROPOSAL.score.sets, walkoverWinner: null });
  });

  test("walkover proposal: no set, only the winner side", () => {
    const playerMatch = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          proposal: { ...SCORE_PROPOSAL, walkover: true },
          proposedBySide: "b",
          state: "negotiating",
        }),
      },
    });

    // `winnerEntryId` do payload é o lado A do confronto.
    expect(
      buildPlayerAgreementScoreProposal({ playerMatch, sideOrder: "match" })
    ).toEqual({ sets: [], walkoverWinner: "a" });
  });

  test("walkover with the viewer drawn first: the winner side flips too", () => {
    const playerMatch = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          proposal: { ...SCORE_PROPOSAL, walkover: true },
          proposedBySide: "a",
          state: "negotiating",
        }),
      },
      mySide: "b",
    });

    expect(
      buildPlayerAgreementScoreProposal({ playerMatch, sideOrder: "viewer" })
    ).toEqual({ sets: [], walkoverWinner: "b" });
  });

  test("agreed score is the published one, not a proposal", () => {
    expect(
      buildPlayerAgreementScoreProposal({
        playerMatch: buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              agreedAt: 2,
              proposal: SCORE_PROPOSAL,
              proposedBySide: "b",
              state: "agreed",
            }),
          },
        }),
        sideOrder: "match",
      })
    ).toBeNull();
  });
});

describe("resolveTableWalkoverWinnerEntryId", () => {
  test("proposal on the table: the W.O. winner is the proposed one", () => {
    const playerMatch = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          proposal: {
            score: {
              sets: [{ aGames: 0, bGames: 0, kind: "set" }],
              winnerEntryId: "entry-them",
            },
            walkover: true,
          },
          proposedBySide: "b",
          state: "negotiating",
        }),
      },
    });

    expect(resolveTableWalkoverWinnerEntryId(playerMatch)).toBe("entry-them");
  });

  test("played score on the table is not a W.O., with or without a winner", () => {
    expect(
      resolveTableWalkoverWinnerEntryId(
        buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal: SCORE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
        })
      )
    ).toBeNull();
    expect(
      resolveTableWalkoverWinnerEntryId(
        buildPlayerMatch({
          agreements: {
            score: buildScoreChannel({
              proposal: SCORE_PROPOSAL,
              proposedBySide: "b",
              state: "negotiating",
            }),
          },
          match: {
            status: "finished",
            walkover: true,
            winnerEntryId: "entry-them",
          },
        })
      )
    ).toBeNull();
  });

  test("agreed channel falls back to the published W.O.", () => {
    const playerMatch = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          agreedAt: 2,
          proposal: null,
          proposedBySide: "b",
          state: "agreed",
        }),
      },
      match: {
        status: "finished",
        walkover: true,
        winnerEntryId: "entry-me",
      },
    });

    expect(resolveTableWalkoverWinnerEntryId(playerMatch)).toBe("entry-me");
  });

  test("published played score is not a W.O.", () => {
    const playerMatch = buildPlayerMatch({
      agreements: {
        score: buildScoreChannel({
          agreedAt: 2,
          proposal: null,
          state: "agreed",
        }),
      },
      match: {
        score: {
          sets: [{ aGames: 6, bGames: 4, kind: "set" }],
          winnerEntryId: "entry-me",
        },
        status: "finished",
        walkover: false,
        winnerEntryId: "entry-me",
      },
    });

    expect(resolveTableWalkoverWinnerEntryId(playerMatch)).toBeNull();
  });
});
