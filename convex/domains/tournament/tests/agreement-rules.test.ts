import { describe, expect, it } from "bun:test";

import type { MatchConfig } from "../../match/contract";
import { DEFAULT_MATCH_CONFIG } from "../../match/contract";
import type { TournamentMatchScore } from "../contract";
import {
  buildAgreementChannelView,
  readEventProposal,
  resolveAcceptanceTransition,
  resolveAgreementNoticeEntryId,
  resolveDeclineTransition,
  resolveMatchSideAccess,
  resolveAgreementSweep,
  resolveCancellationTransition,
  resolveProposalTransition,
  resolveReceivedAgreement,
  resolveScheduleProposal,
  resolveScoreProposal,
  toAgreementStateFields,
  type MatchAgreementStateFields,
} from "../agreement-rules";
import type { TournamentScheduledMatch } from "../scheduling-rules";

const matchConfig = { defaultDurationMinutes: 90 } as MatchConfig;

const entryA = { playerAId: "profile-a1", playerBId: "profile-a2" };
const entryB = { playerAId: "profile-b1", playerBId: "profile-b2" };

const openMatch = {
  entryAId: "entry-a",
  entryBId: "entry-b",
  id: "match-1",
  publishedAt: false,
  status: "pending",
};

const tournamentWithCourts = {
  blocks: [],
  courts: [
    { id: "court-1", name: "Quadra Central" },
    { id: "court-2", name: "Quadra 2" },
  ],
  matchConfig,
  status: "drawn",
  window: { endDayKey: null, startDayKey: "2026-09-01" },
};

const scheduledMatch: TournamentScheduledMatch = {
  courtId: "court-1",
  id: "match-9",
  matchDate: "2026-09-28",
  startMinute: 600,
};

const proposedAt = Date.UTC(2026, 8, 20, 12);

function stateFields(
  overrides: Partial<MatchAgreementStateFields>
): MatchAgreementStateFields {
  return {
    agreedAt: null,
    proposal: { matchDate: "2026-09-28", startMinute: 480 },
    proposedAt,
    proposedBySide: "a",
    proposedByUserId: "user-a",
    state: "negotiating",
    ...overrides,
  };
}

describe("acerto: lado do ator", () => {
  it("resolves the side by the profile of the caller", () => {
    expect(
      resolveMatchSideAccess({
        entryA,
        entryB,
        playerProfileId: "profile-a2",
      }).side
    ).toBe("a");
    expect(
      resolveMatchSideAccess({
        entryA,
        entryB,
        playerProfileId: "profile-b1",
      }).side
    ).toBe("b");
  });

  it("refuses a stranger with FORBIDDEN and no side", () => {
    const access = resolveMatchSideAccess({
      entryA,
      entryB,
      playerProfileId: "profile-z",
    });

    expect(access.side).toBeNull();
    expect(access.error).toBe(
      "Só quem joga esse confronto pode combinar horário e placar."
    );
  });

  it("refuses a half entry that has no second player", () => {
    expect(
      resolveMatchSideAccess({
        entryA: { playerAId: "profile-a1", playerBId: null },
        entryB: null,
        playerProfileId: "profile-b1",
      }).side
    ).toBeNull();
  });
});

describe("acerto: proposta de horário", () => {
  it("approves a free window and derives the occupied end", () => {
    const proposal = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: "court-1",
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: tournamentWithCourts,
    });

    expect(proposal.error).toBeNull();
    expect(proposal.plan).toEqual({
      courtId: "court-1",
      endMinute: 570,
      matchDate: "2026-09-28",
      startMinute: 480,
    });
  });

  it("refuses a window that collides with another match on the same court", () => {
    const proposal = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: "court-1",
        endMinute: 660,
        matchDate: "2026-09-28",
        startMinute: 600,
      },
      scheduledMatches: [scheduledMatch],
      tournament: tournamentWithCourts,
    });

    expect(proposal.plan).toBeNull();
    expect(proposal.error).toBe(
      "Esse horário já está reservado para outro confronto."
    );
  });

  it("ignores the match being rescheduled in the collision check", () => {
    const proposal = resolveScheduleProposal({
      match: { ...openMatch, id: "match-9" },
      proposal: {
        courtId: "court-1",
        endMinute: 660,
        matchDate: "2026-09-28",
        startMinute: 600,
      },
      scheduledMatches: [scheduledMatch],
      tournament: tournamentWithCourts,
    });

    expect(proposal.error).toBeNull();
  });

  it("refuses a court outside the tournament and a missing court when there are courts", () => {
    const unknownCourt = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: "court-9",
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: tournamentWithCourts,
    });
    expect(unknownCourt.error).toBe("Quadra inválida.");

    const missingCourt = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: null,
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: tournamentWithCourts,
    });
    expect(missingCourt.error).toBe("Escolha uma quadra para este horário.");
  });

  it("agrees on date and time alone when the tournament has no court", () => {
    const withCourt = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: "court-1",
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: { ...tournamentWithCourts, courts: [] },
    });
    expect(withCourt.error).toBe("Quadra inválida.");

    const withoutCourt = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: null,
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: { ...tournamentWithCourts, courts: [] },
    });
    expect(withoutCourt.error).toBeNull();
    expect(withoutCourt.plan?.courtId).toBeNull();
  });

  it("refuses before the draw, after the result and on a vacant slot", () => {
    const base = {
      match: openMatch,
      proposal: {
        courtId: "court-1",
        endMinute: 600,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: tournamentWithCourts,
    };

    expect(
      resolveScheduleProposal({
        ...base,
        tournament: { ...tournamentWithCourts, status: "published" },
      }).error
    ).toBe("Agendamento exige chave sorteada ou torneio em andamento.");
    expect(
      resolveScheduleProposal({
        ...base,
        tournament: { ...tournamentWithCourts, status: "finished" },
      }).error
    ).toBe("Agendamento exige chave sorteada ou torneio em andamento.");
    expect(
      resolveScheduleProposal({
        ...base,
        match: { ...openMatch, publishedAt: true },
      }).error
    ).toBe("Confronto encerrado não pode ser reagendado.");
    expect(
      resolveScheduleProposal({
        ...base,
        match: { ...openMatch, status: "vacant" },
      }).error
    ).toBe("Essa vaga da chave está vazia e não pode ser agendada.");
    expect(
      resolveScheduleProposal({
        ...base,
        match: { ...openMatch, entryBId: null },
      }).error
    ).toBe("Esse confronto ainda não tem os dois lados definidos.");
  });

  it("refuses an inverted window", () => {
    const proposal = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        courtId: "court-1",
        endMinute: 480,
        matchDate: "2026-09-28",
        startMinute: 480,
      },
      scheduledMatches: [],
      tournament: tournamentWithCourts,
    });

    expect(proposal.error).toBe(
      "O horário de início deve ser antes do término."
    );
  });
});

describe("acerto: proposta de placar", () => {
  const score: TournamentMatchScore = {
    sets: [{ aGames: 6, bGames: 4, kind: "set" }],
    winnerEntryId: null,
  };

  it("validates the score and resolves the winner", () => {
    const proposal = resolveScoreProposal({
      match: { ...openMatch, status: "scheduled" },
      score,
      tournament: { matchConfig, status: "ongoing" },
      walkover: false,
    });

    expect(proposal.error).toBeNull();
    expect(proposal.plan?.winnerEntryId).toBe("entry-a");
    expect(proposal.plan?.walkover).toBe(false);
  });

  it("resolves a walkover winner and refuses a stranger as winner", () => {
    const accepted = resolveScoreProposal({
      match: { ...openMatch, status: "scheduled" },
      score: {
        sets: [{ aGames: 0, bGames: 0, kind: "set" }],
        winnerEntryId: "entry-b",
      },
      tournament: { matchConfig, status: "ongoing" },
      walkover: true,
    });
    expect(accepted.plan?.winnerEntryId).toBe("entry-b");

    const refused = resolveScoreProposal({
      match: { ...openMatch, status: "scheduled" },
      score: {
        sets: [{ aGames: 0, bGames: 0, kind: "set" }],
        winnerEntryId: "entry-z",
      },
      tournament: { matchConfig, status: "ongoing" },
      walkover: true,
    });
    expect(refused.plan).toBeNull();
    expect(refused.error).not.toBeNull();
  });

  it("refuses a closed tournament and one that has not started", () => {
    const base = {
      match: { ...openMatch, status: "scheduled" },
      score,
      walkover: false,
    };

    expect(
      resolveScoreProposal({
        ...base,
        tournament: { matchConfig, status: "finished" },
      }).error
    ).toBe(
      "Torneio encerrado ou cancelado: o resultado não pode ser combinado."
    );
    expect(
      resolveScoreProposal({
        ...base,
        tournament: { matchConfig, status: "cancelled" },
      }).error
    ).toBe(
      "Torneio encerrado ou cancelado: o resultado não pode ser combinado."
    );
    expect(
      resolveScoreProposal({
        ...base,
        tournament: { matchConfig, status: "drawn" },
      }).error
    ).toBe("Resultados só podem ser combinados com o torneio em andamento.");
  });

  it("refuses a published result, a vacant slot and a half match", () => {
    const base = {
      score,
      tournament: { matchConfig, status: "ongoing" },
      walkover: false,
    };

    expect(
      resolveScoreProposal({
        ...base,
        match: { ...openMatch, publishedAt: true },
      }).error
    ).toBe("Esse confronto já tem resultado publicado.");
    expect(
      resolveScoreProposal({
        ...base,
        match: { ...openMatch, status: "vacant" },
      }).error
    ).toBe("Essa vaga da chave está vazia e não tem resultado.");
    expect(
      resolveScoreProposal({
        ...base,
        match: { ...openMatch, entryAId: null },
      }).error
    ).toBe("Esse confronto ainda não tem os dois lados definidos.");
  });

  it("refuses an incoherent score with the shared validator message", () => {
    const proposal = resolveScoreProposal({
      match: { ...openMatch, status: "scheduled" },
      score: { sets: [], winnerEntryId: null } as TournamentMatchScore,
      tournament: { matchConfig, status: "ongoing" },
      walkover: false,
    });

    expect(proposal.plan).toBeNull();
    expect(proposal.error).not.toBeNull();
  });
});

describe("acerto: transições de estado", () => {
  it("opens the channel with a proposal from one side", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: null,
      nowMs: proposedAt,
      proposal: { matchDate: "2026-09-28" },
      side: "a",
      userId: "user-a",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("proposed");
    expect(transition.next?.state).toBe("negotiating");
    expect(transition.next?.proposedByUserId).toBe("user-a");
  });

  it("lets a counter-proposal from the other side replace the standing one", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({}),
      nowMs: proposedAt + 1000,
      proposal: { matchDate: "2026-09-29" },
      side: "b",
      userId: "user-b",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("proposed");
    expect(transition.next?.proposal).toEqual({ matchDate: "2026-09-29" });
    expect(transition.next?.proposedBySide).toBe("b");
    expect(transition.next?.proposedByUserId).toBe("user-b");
  });

  it("reopens a closed channel as a change request", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
      nowMs: proposedAt + 2000,
      proposal: { matchDate: "2026-09-30" },
      side: "b",
      userId: "user-b",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("reopened");
    expect(transition.next?.state).toBe("negotiating");
    // O aceite anterior fica no histórico: é ele que marca o pedido de mudança.
    expect(transition.next?.agreedAt).toBe(proposedAt);
  });

  it("refuses a proposal identical to the standing one, without event", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({}),
      nowMs: proposedAt + 1000,
      // Mesmas chaves em outra ordem: a comparacao e canonica.
      proposal: { matchDate: "2026-09-28", startMinute: 480 },
      side: "b",
      userId: "user-b",
    });

    expect(transition.error).toBe(
      "Esse horário é o mesmo que já está na mesa."
    );
    expect(transition.event).toBeNull();
    expect(transition.next).toBeNull();
  });

  it("refuses the same value over a closed agreement too", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
      nowMs: proposedAt + 1000,
      proposal: { matchDate: "2026-09-28", startMinute: 480 },
      side: "b",
      userId: "user-b",
    });

    expect(transition.error).toBe(
      "Esse horário é o mesmo que já está na mesa."
    );
    expect(transition.event).toBeNull();
    expect(transition.next).toBeNull();
  });

  it("lets the same value back in when the table is empty", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({
        proposal: null,
        proposedAt: null,
        proposedBySide: null,
        proposedByUserId: null,
        state: "idle",
      }),
      nowMs: proposedAt + 1000,
      proposal: { matchDate: "2026-09-28", startMinute: 480 },
      side: "a",
      userId: "user-a",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("proposed");
    expect(transition.next?.proposal).toEqual({
      matchDate: "2026-09-28",
      startMinute: 480,
    });
  });

  it("compares score proposals by the normalized payload", () => {
    const current = stateFields({
      proposal: {
        score: {
          sets: [{ aGames: 6, bGames: 4, kind: "set" }],
          winnerEntryId: "entry-a",
        },
        walkover: false,
      },
    });

    const identical = resolveProposalTransition({
      channel: "score",
      current,
      nowMs: proposedAt + 1000,
      proposal: {
        score: {
          sets: [{ aGames: 6, bGames: 4, kind: "set" }],
          winnerEntryId: "entry-a",
        },
        walkover: false,
      },
      side: "b",
      userId: "user-b",
    });

    expect(identical.error).toBe("Esse placar é o mesmo que já está na mesa.");
    expect(identical.event).toBeNull();
    expect(identical.next).toBeNull();

    const changed = resolveProposalTransition({
      channel: "score",
      current,
      nowMs: proposedAt + 1000,
      proposal: {
        score: {
          sets: [{ aGames: 6, bGames: 3, kind: "set" }],
          winnerEntryId: "entry-a",
        },
        walkover: false,
      },
      side: "b",
      userId: "user-b",
    });

    expect(changed.error).toBeNull();
    expect(changed.event?.kind).toBe("proposed");
  });

  it("lets a single changed field supersede the standing proposal", () => {
    const transition = resolveProposalTransition({
      channel: "schedule",
      current: stateFields({}),
      nowMs: proposedAt + 1000,
      proposal: { matchDate: "2026-09-28", startMinute: 570 },
      side: "b",
      userId: "user-b",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("proposed");
    expect(transition.next?.proposal).toEqual({
      matchDate: "2026-09-28",
      startMinute: 570,
    });
  });

  it("closes the channel with the acceptance of the other side", () => {
    const transition = resolveAcceptanceTransition({
      current: stateFields({}),
      nowMs: proposedAt + 5000,
      side: "b",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("accepted");
    expect(transition.next?.state).toBe("agreed");
    expect(transition.next?.agreedAt).toBe(proposedAt + 5000);
  });

  it("refuses self-acceptance, a missing proposal and a done deal", () => {
    expect(
      resolveAcceptanceTransition({
        current: stateFields({}),
        nowMs: proposedAt,
        side: "a",
      }).error
    ).toBe("Você fez essa proposta. Espere o outro lado responder.");
    expect(
      resolveAcceptanceTransition({
        current: null,
        nowMs: proposedAt,
        side: "b",
      }).error
    ).toBe("Não há proposta para responder.");
    expect(
      resolveAcceptanceTransition({
        current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
        nowMs: proposedAt,
        side: "b",
      }).error
    ).toBe("Esse acerto já está fechado. Proponha outro para mudar.");
  });

  it("drops the standing proposal on a decline without closing the channel", () => {
    const transition = resolveDeclineTransition({
      current: stateFields({}),
      nowMs: proposedAt + 5000,
      side: "b",
    });

    expect(transition.event?.kind).toBe("declined");
    expect(transition.next?.state).toBe("idle");
    expect(transition.next?.proposal).toBeNull();
    expect(transition.event?.before.proposal).toEqual({
      matchDate: "2026-09-28",
      startMinute: 480,
    });
  });

  it("lets the author take their own proposal off the table", () => {
    const transition = resolveCancellationTransition({
      current: stateFields({}),
      nowMs: proposedAt + 5000,
      side: "a",
      userId: "user-a",
    });

    expect(transition.error).toBeNull();
    expect(transition.event?.kind).toBe("cancelled");
    expect(transition.next?.state).toBe("idle");
    expect(transition.next?.proposal).toBeNull();
    expect(transition.next?.proposedByUserId).toBeNull();
    expect(transition.event?.before.proposal).toEqual({
      matchDate: "2026-09-28",
      startMinute: 480,
    });
  });

  it("keeps the old agreement when the author retires a change request", () => {
    const transition = resolveCancellationTransition({
      current: stateFields({ agreedAt: proposedAt, state: "negotiating" }),
      nowMs: proposedAt + 6000,
      side: "a",
      userId: "user-a",
    });

    expect(transition.next?.state).toBe("idle");
    // O acerto vigente fica: a retirada derruba a proposta, nao o acordo.
    expect(transition.next?.agreedAt).toBe(proposedAt);
  });

  it("refuses a withdrawal from anyone but the exact author", () => {
    // O gate e por USUARIO, nao por lado: numa dupla os dois perfis dividem o
    // lado, e quem nao propos nao retira pelo parceiro.
    expect(
      resolveCancellationTransition({
        current: stateFields({}),
        nowMs: proposedAt,
        side: "b",
        userId: "user-b",
      }).error
    ).toBe("Só quem propôs pode retirar a proposta.");
    expect(
      resolveCancellationTransition({
        current: stateFields({}),
        nowMs: proposedAt,
        side: "a",
        userId: "user-a2",
      }).error
    ).toBe("Só quem propôs pode retirar a proposta.");
    expect(
      resolveCancellationTransition({
        current: null,
        nowMs: proposedAt,
        side: "a",
        userId: "user-a",
      }).error
    ).toBe("Não há proposta para retirar.");
    expect(
      resolveCancellationTransition({
        current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
        nowMs: proposedAt,
        side: "a",
        userId: "user-a",
      }).error
    ).toBe("Esse acerto já está fechado. Proponha outro para mudar.");
  });

  it("closes the standing agreement only when there is one", () => {
    const override = resolveAgreementSweep({
      current: stateFields({}),
      kind: "overridden",
      nowMs: proposedAt + 9000,
    });

    expect(override?.event.kind).toBe("overridden");
    expect(override?.next.state).toBe("idle");
    expect(override?.next.proposal).toBeNull();

    const decided = resolveAgreementSweep({
      current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
      kind: "closed",
      nowMs: proposedAt + 9000,
    });
    expect(decided?.event.kind).toBe("closed");

    // Encaixe manual da chave: o par foi reescrito, entao o canal FECHADO
    // (agreed) tambem cai, preservando o `agreedAt` do historico.
    const rewritten = resolveAgreementSweep({
      current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
      kind: "overridden",
      nowMs: proposedAt + 9000,
    });
    expect(rewritten?.event.kind).toBe("overridden");
    expect(rewritten?.next.state).toBe("idle");
    expect(rewritten?.next.agreedAt).toBe(proposedAt);

    expect(
      resolveAgreementSweep({
        current: stateFields({
          proposal: null,
          proposedAt: null,
          state: "idle",
        }),
        kind: "overridden",
        nowMs: proposedAt,
      })
    ).toBeNull();
    expect(
      resolveAgreementSweep({
        current: null,
        kind: "closed",
        nowMs: proposedAt,
      })
    ).toBeNull();
  });
});

describe("acerto: leitura e pendência", () => {
  it("reads an absent row as idle without a proposal", () => {
    expect(
      buildAgreementChannelView({ current: null, userId: "user-a" })
    ).toEqual({
      agreedAt: null,
      proposal: null,
      proposedAt: null,
      proposedByMe: false,
      proposedBySide: null,
      state: "idle",
    });
  });

  it("tells who proposed, from the point of view of the reader", () => {
    const current = stateFields({});

    expect(
      buildAgreementChannelView({ current, userId: "user-a" }).proposedByMe
    ).toBe(true);
    expect(
      buildAgreementChannelView({ current, userId: "user-b" }).proposedByMe
    ).toBe(false);
  });

  it("turns a received proposal into the pending signal, never the own side", () => {
    expect(
      resolveReceivedAgreement({
        channel: "schedule",
        current: stateFields({}),
        side: "b",
      })
    ).toEqual({ channel: "schedule", kind: "proposal" });
    expect(
      resolveReceivedAgreement({
        channel: "schedule",
        current: stateFields({ agreedAt: proposedAt }),
        side: "b",
      })
    ).toEqual({ channel: "schedule", kind: "reopened" });
    expect(
      resolveReceivedAgreement({
        channel: "score",
        current: stateFields({}),
        side: "a",
      })
    ).toBeNull();
    expect(
      resolveReceivedAgreement({
        channel: "score",
        current: stateFields({ agreedAt: proposedAt, state: "agreed" }),
        side: "b",
      })
    ).toBeNull();
    expect(
      resolveReceivedAgreement({
        channel: "score",
        current: stateFields({ proposal: null, state: "idle" }),
        side: "b",
      })
    ).toBeNull();
  });

  it("leaves the doubles partner of the proposer out of the pending signal", () => {
    // O parceiro é outro usuario do MESMO lado: a escrita já é por lado, entao
    // ele nao recebe a pendencia (nem o verbo de resposta que vem dentro dela).
    const proposedByPartner = stateFields({ proposedByUserId: "user-a2" });

    expect(
      resolveReceivedAgreement({
        channel: "schedule",
        current: proposedByPartner,
        side: "a",
      })
    ).toBeNull();
    expect(
      resolveReceivedAgreement({
        channel: "schedule",
        current: proposedByPartner,
        side: "b",
      })
    ).toEqual({ channel: "schedule", kind: "proposal" });
  });

  it("keeps the declined proposal readable in the history", () => {
    expect(
      readEventProposal({
        after: { proposal: null, state: "idle" },
        before: { proposal: { matchDate: "2026-09-28" }, state: "negotiating" },
      })
    ).toEqual({ matchDate: "2026-09-28" });
  });

  it("maps a stored row to the fields the rules read", () => {
    expect(
      toAgreementStateFields({
        agreedAt: new Date(proposedAt),
        proposal: { matchDate: "2026-09-28" },
        proposedAt: new Date(proposedAt),
        proposedBySide: "b",
        proposedByUserId: "user-b",
        state: "negotiating",
      })
    ).toEqual({
      agreedAt: proposedAt,
      proposal: { matchDate: "2026-09-28" },
      proposedAt,
      proposedBySide: "b",
      proposedByUserId: "user-b",
      state: "negotiating",
    });

    expect(
      toAgreementStateFields({
        agreedAt: null,
        proposal: null,
        proposedAt: null,
        proposedBySide: "lixo",
        proposedByUserId: null,
        state: "lixo",
      })
    ).toMatchObject({ proposedBySide: null, state: "idle" });
  });
});

describe("acerto: aviso do passo (quem não agiu recebe)", () => {
  it("aponta o lado oposto ao de quem agiu", () => {
    const match = { entryAId: "entry-a", entryBId: "entry-b" };

    // Quem agiu pelo lado A avisa o B (proposta e recusa usam a mesma regra).
    expect(resolveAgreementNoticeEntryId({ ...match, side: "a" })).toBe(
      "entry-b"
    );
    expect(resolveAgreementNoticeEntryId({ ...match, side: "b" })).toBe(
      "entry-a"
    );
  });

  it("não inventa destino quando o outro lado não existe", () => {
    expect(
      resolveAgreementNoticeEntryId({
        entryAId: "entry-a",
        entryBId: null,
        side: "b",
      })
    ).toBe("entry-a");
    expect(
      resolveAgreementNoticeEntryId({
        entryAId: null,
        entryBId: "entry-b",
        side: "a",
      })
    ).toBe("entry-b");
  });
});

describe("acerto: configuração padrão do torneio", () => {
  it("uses the shared default match config shape", () => {
    // Trava o formato do fixture de placar/horário usado acima.
    expect(DEFAULT_MATCH_CONFIG.defaultDurationMinutes).toBe(90);
  });
});

describe("acerto: janela do torneio e bloqueios", () => {
  const proposal = {
    courtId: "court-1",
    endMinute: 600,
    matchDate: "2026-10-21",
    startMinute: 480,
  };

  it("recusa proposta fora da janela com a mensagem do Editar torneio", () => {
    const result = resolveScheduleProposal({
      match: openMatch,
      proposal,
      scheduledMatches: [],
      tournament: {
        ...tournamentWithCourts,
        window: { endDayKey: "2026-10-20", startDayKey: "2026-10-10" },
      },
    });

    expect(result.plan).toBeNull();
    expect(result.error).toBe(
      "O torneio vai de 10/10 a 20/10. Estenda a janela no Editar torneio para agendar fora dela."
    );
  });

  it("aceita proposta dentro da janela", () => {
    const result = resolveScheduleProposal({
      match: openMatch,
      proposal: { ...proposal, matchDate: "2026-10-15" },
      scheduledMatches: [],
      tournament: {
        ...tournamentWithCourts,
        window: { endDayKey: "2026-10-20", startDayKey: "2026-10-10" },
      },
    });

    expect(result.error).toBeNull();
    expect(result.plan?.matchDate).toBe("2026-10-15");
  });

  it("recusa proposta dentro de um bloqueio, com o motivo", () => {
    const result = resolveScheduleProposal({
      match: openMatch,
      proposal: {
        ...proposal,
        endMinute: 1050,
        matchDate: "2026-10-12",
        startMinute: 960,
      },
      scheduledMatches: [],
      tournament: {
        ...tournamentWithCourts,
        blocks: [
          {
            date: "2026-10-12",
            endMinute: 1200,
            id: "block-1",
            reason: "Chuva",
            startMinute: 960,
          },
        ],
      },
    });

    expect(result.plan).toBeNull();
    expect(result.error).toBe(
      "O período de 12/10 das 16:00 às 20:00 está indisponível (Chuva)."
    );
  });

  it("bloqueio de outra quadra não barra a proposta", () => {
    const result = resolveScheduleProposal({
      match: openMatch,
      proposal: { ...proposal, matchDate: "2026-10-12" },
      scheduledMatches: [],
      tournament: {
        ...tournamentWithCourts,
        blocks: [
          {
            courtId: "court-2",
            date: "2026-10-12",
            id: "block-1",
            reason: "Quadra alagada",
          },
        ],
      },
    });

    expect(result.error).toBeNull();
  });
});
