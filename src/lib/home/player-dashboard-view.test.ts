import { describe, expect, it } from "bun:test";

import type { PlayerDashboardUpcomingMatch } from "@convex/domains/player/contract";

import {
  buildPlayerResultsChart,
  buildUpcomingMatchItems,
  formatDashboardMonthLabel,
} from "./player-dashboard-view";

describe("formatDashboardMonthLabel", () => {
  it("renders the short pt-BR month of the key", () => {
    expect(formatDashboardMonthLabel("2026-09")).toBe("set.");
    expect(formatDashboardMonthLabel("2026-01")).toBe("jan.");
  });

  it("returns the raw key when it is not parseable", () => {
    expect(formatDashboardMonthLabel("livre")).toBe("livre");
  });
});

describe("buildPlayerResultsChart", () => {
  it("maps month keys to short labels keeping wins and losses", () => {
    expect(
      buildPlayerResultsChart([
        { losses: 1, month: "2026-08", wins: 0 },
        { losses: 0, month: "2026-09", wins: 3 },
      ])
    ).toEqual([
      { label: "ago.", losses: 1, wins: 0 },
      { label: "set.", losses: 0, wins: 3 },
    ]);
  });
});

const viewer = {
  avatarUrl: "https://cdn/eu.png",
  fullName: "Bruno Garcia",
  nickname: "Bruninho",
};

const doublesMatch = {
  categoryDisplayName: "Duplas Mistas",
  categoryId: "cat-1",
  competitionId: "t-1",
  competitionName: "Copa Guarujá",
  courtName: "Quadra 2",
  endMinute: null,
  id: "match-1",
  matchDate: "2026-10-04",
  opponents: [
    {
      avatarUrl: "https://cdn/a.png",
      fullName: "Ana Souza",
      nickname: "Aninha",
      playerProfileId: "p-a",
    },
    {
      avatarUrl: null,
      fullName: "Diego Lima",
      nickname: null,
      playerProfileId: "p-d",
    },
  ],
  partner: {
    avatarUrl: "https://cdn/parceiro.png",
    fullName: "Rafael Lima",
    nickname: "Rafa",
    playerProfileId: "p-r",
  },
  round: 2,
  startMinute: 540,
  totalRounds: 4,
};

describe("buildUpcomingMatchItems", () => {
  it("põe o lado do viewer em A e a dupla adversária em B, com o apelido no lugar do nome", () => {
    expect(
      buildUpcomingMatchItems({ matches: [doublesMatch], viewer })
    ).toEqual([
      {
        competitionId: "t-1",
        courtName: "Quadra 2",
        id: "match-1",
        matchDate: "2026-10-04",
        matchStatus: "scheduled",
        sideAAvatarUrl: "https://cdn/eu.png",
        sideAName: "Bruninho",
        sideAPartnerAvatarUrl: "https://cdn/parceiro.png",
        sideAPartnerName: "Rafa",
        sideBAvatarUrl: "https://cdn/a.png",
        sideBName: "Aninha",
        sideBPartnerAvatarUrl: null,
        sideBPartnerName: "Diego Lima",
        stageLabel: "Quartas de final",
        startMinute: 540,
      },
    ]);
  });

  it("sem apelido, sem parceiro e sem quadra: nome completo, um lado só e a quadra vazia", () => {
    expect(
      buildUpcomingMatchItems({
        matches: [
          {
            categoryDisplayName: "Simples Masculino",
            categoryId: "cat-2",
            competitionId: "t-2",
            competitionName: "Copa Guarujá",
            courtName: null,
            endMinute: 660,
            id: "match-2",
            matchDate: "2026-10-05",
            opponents: [],
            partner: null,
            round: 1,
            startMinute: 600,
            totalRounds: 3,
          },
        ],
        viewer: { avatarUrl: null, fullName: "Bruno Garcia", nickname: null },
      })
    ).toEqual([
      {
        competitionId: "t-2",
        courtName: "",
        id: "match-2",
        matchDate: "2026-10-05",
        matchStatus: "scheduled",
        sideAAvatarUrl: null,
        sideAName: "Bruno Garcia",
        sideAPartnerAvatarUrl: null,
        sideAPartnerName: null,
        sideBAvatarUrl: null,
        sideBName: "A definir",
        sideBPartnerAvatarUrl: null,
        sideBPartnerName: null,
        stageLabel: "Quartas de final",
        startMinute: 600,
      },
    ]);
  });

  it("payload antigo, sem a rodada e o tamanho do quadro: o card sai sem o chip de fase", () => {
    const legacy = {
      ...doublesMatch,
      round: undefined,
      totalRounds: undefined,
    } as unknown as PlayerDashboardUpcomingMatch;

    expect(
      buildUpcomingMatchItems({ matches: [legacy], viewer })[0].stageLabel
    ).toBeNull();
  });
});
