import type { Court } from "@convex/domains/match/contract";
import type { TournamentMatch } from "@convex/domains/tournament/contract";

import type { ScoreSet } from "@/lib/matches/score-display";
import type { PlayerMatch } from "@/lib/tournaments/match-agreement-view";

/** Palco da galeria: o card não usa a quadra, mas o diálogo de horário lê a
 * disponibilidade dela para oferecer os horários. */
export const MATCH_AGREEMENT_GALLERY_COURTS: Court[] = [
  {
    availability: {
      fri: [{ endMinute: 1320, startMinute: 480 }],
      mon: [{ endMinute: 1320, startMinute: 480 }],
      sat: [{ endMinute: 1320, startMinute: 480 }],
      sun: [{ endMinute: 1320, startMinute: 480 }],
      thu: [{ endMinute: 1320, startMinute: 480 }],
      tue: [{ endMinute: 1320, startMinute: 480 }],
      wed: [{ endMinute: 1320, startMinute: 480 }],
    },
    id: "court-qa",
    name: "Quadra QA",
  },
];

export const MATCH_AGREEMENT_GALLERY_DURATION_MINUTES = 90;

export const MATCH_AGREEMENT_GALLERY_SIDE_A_NAME = "Um";
export const MATCH_AGREEMENT_GALLERY_SIDE_B_NAME = "Tres";

type ChannelView = PlayerMatch["agreements"]["schedule"];
type ScoreChannelView = PlayerMatch["agreements"]["score"];

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

function buildScheduleChannel(
  overrides: Partial<ChannelView> & { proposal?: unknown }
): ChannelView {
  return { ...buildIdleChannel(), ...overrides } as ChannelView;
}

function buildScoreChannel(
  overrides: Partial<ScoreChannelView> & { proposal?: unknown }
): ScoreChannelView {
  return { ...buildIdleChannel(), ...overrides } as ScoreChannelView;
}

const GALLERY_SCHEDULE_PROPOSAL = {
  courtId: "court-qa",
  endMinute: 780,
  matchDate: "2026-10-09",
  startMinute: 690,
};

const GALLERY_REOPENED_PROPOSAL = {
  courtId: "court-qa",
  endMinute: 1140,
  matchDate: "2026-10-11",
  startMinute: 1050,
};

const GALLERY_SCORE_SETS: ScoreSet[] = [
  { aGames: 6, bGames: 4, kind: "set" },
  { aGames: 3, bGames: 6, kind: "set" },
  { aGames: 7, bGames: 5, kind: "set" },
];

const GALLERY_SCORE_PROPOSAL = {
  score: { sets: GALLERY_SCORE_SETS, winnerEntryId: "entry-me" },
  walkover: false,
};

function buildGalleryPlayerMatch(input: {
  agreements?: Partial<PlayerMatch["agreements"]>;
  match?: Partial<TournamentMatch>;
}): PlayerMatch {
  const match = {
    categoryId: "cat-1",
    courtId: "court-qa",
    entryAId: "entry-me",
    entryBId: "entry-them",
    id: "match-gallery",
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
      schedule: buildScheduleChannel({}),
      score: buildScoreChannel({}),
      ...input.agreements,
    },
    match,
    mySide: "a",
    totalRounds: 2,
  };
}

export type MatchAgreementGalleryCase = {
  /** Campos do `MatchCard` real do estado (nomes, data e quadra são do palco). */
  card: {
    challengedName: string;
    challengerName: string;
    courtName: string;
    matchDate: null | string;
    matchStatus: string;
    scoreSets: null | ScoreSet[];
    stageLabel: string;
    startMinute: number;
  };
  id: string;
  isMatchLocked: boolean;
  note: string;
  opponentName: string;
  playerMatch: PlayerMatch;
  title: string;
  /** Status do torneio do exemplo: em `drawn` o menu não oferece placar. */
  tournamentStatus: null | string;
};

const GALLERY_CARD_BASE = {
  challengedName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
  challengerName: MATCH_AGREEMENT_GALLERY_SIDE_A_NAME,
  courtName: "Quadra QA",
  matchDate: null,
  matchStatus: "pending",
  scoreSets: null,
  stageLabel: "Semifinal",
  startMinute: 690,
} as const;

/**
 * O acerto em cada estado do fluxo: propor horário, responder, propor outro e
 * publicar. Os itens do menu e as linhas do card saem dos builders reais; aqui
 * só mora o confronto de exemplo de cada estado.
 */
export const MATCH_AGREEMENT_GALLERY_CASES: MatchAgreementGalleryCase[] = [
  {
    card: { ...GALLERY_CARD_BASE },
    id: "idle",
    isMatchLocked: false,
    note: "Sem nada na mesa. O menu já vem aberto aqui; nos outros estados, toque no ⋮ do card.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({}),
    title: "Sem proposta",
    tournamentStatus: "ongoing",
  },
  {
    card: { ...GALLERY_CARD_BASE },
    id: "mine",
    isMatchLocked: false,
    note: "Proposta minha: o menu só fala de horário, propor outro ou cancelar a proposta.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "negotiating",
        }),
      },
    }),
    title: "Proposta minha",
    tournamentStatus: "ongoing",
  },
  {
    card: { ...GALLERY_CARD_BASE },
    id: "theirs",
    isMatchLocked: false,
    note: "É a minha vez: aprovar, recusar ou propor outro horário.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedBySide: "b",
          state: "negotiating",
        }),
      },
    }),
    title: "Proposta do outro lado",
    tournamentStatus: "ongoing",
  },
  {
    card: {
      ...GALLERY_CARD_BASE,
      matchDate: "2026-10-09",
      matchStatus: "scheduled",
    },
    id: "reopened",
    isMatchLocked: false,
    note: "Já combinado e alguém pediu mudança: o chip pede reaprovação e o menu fala só de horário.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          agreedAt: 1,
          proposal: GALLERY_REOPENED_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "negotiating",
        }),
      },
      match: {
        matchDate: "2026-10-09",
        startMinute: 690,
        status: "scheduled",
      },
    }),
    title: "Horário reaberto",
    tournamentStatus: "ongoing",
  },
  {
    card: {
      ...GALLERY_CARD_BASE,
      matchDate: "2026-10-09",
      matchStatus: "scheduled",
    },
    id: "agreed",
    isMatchLocked: false,
    note: "Horário fechado: enviar o resultado e, se quiser, remarcar (os dois únicos que convivem).",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          agreedAt: 1,
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        }),
      },
      match: {
        matchDate: "2026-10-09",
        startMinute: 690,
        status: "scheduled",
      },
    }),
    title: "Horário combinado",
    tournamentStatus: "ongoing",
  },
  {
    card: {
      ...GALLERY_CARD_BASE,
      matchDate: "2026-10-09",
      matchStatus: "scheduled",
    },
    id: "score-mine",
    isMatchLocked: false,
    note: "Placar na mesa: o menu só fala de placar e o vencedor já sai em azul.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          agreedAt: 1,
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        }),
        score: buildScoreChannel({
          proposal: GALLERY_SCORE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "negotiating",
        }),
      },
      match: {
        matchDate: "2026-10-09",
        startMinute: 690,
        status: "scheduled",
      },
    }),
    title: "Placar proposto por mim",
    tournamentStatus: "ongoing",
  },
  {
    card: {
      ...GALLERY_CARD_BASE,
      matchDate: "2026-10-09",
      matchStatus: "scheduled",
    },
    id: "score-theirs",
    isMatchLocked: false,
    note: "É a minha vez: aprovar, recusar ou enviar outro resultado.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          agreedAt: 1,
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        }),
        score: buildScoreChannel({
          proposal: GALLERY_SCORE_PROPOSAL,
          proposedBySide: "b",
          state: "negotiating",
        }),
      },
      match: {
        matchDate: "2026-10-09",
        startMinute: 690,
        status: "scheduled",
      },
    }),
    title: "Placar do outro lado",
    tournamentStatus: "ongoing",
  },
  {
    card: {
      ...GALLERY_CARD_BASE,
      matchDate: "2026-10-09",
      matchStatus: "finished",
      scoreSets: GALLERY_SCORE_SETS,
    },
    id: "published",
    isMatchLocked: true,
    note: "Publicado: o card perde o menu e o chip do combinado; o placar fica ao lado dos nomes.",
    opponentName: MATCH_AGREEMENT_GALLERY_SIDE_B_NAME,
    playerMatch: buildGalleryPlayerMatch({
      agreements: {
        schedule: buildScheduleChannel({
          agreedAt: 1,
          proposal: GALLERY_SCHEDULE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        }),
        score: buildScoreChannel({
          agreedAt: 2,
          proposal: GALLERY_SCORE_PROPOSAL,
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        }),
      },
      match: {
        matchDate: "2026-10-09",
        score: { sets: GALLERY_SCORE_SETS, winnerEntryId: "entry-me" },
        startMinute: 690,
        status: "finished",
        winnerEntryId: "entry-me",
      },
    }),
    title: "Resultado publicado",
    tournamentStatus: "ongoing",
  },
];
