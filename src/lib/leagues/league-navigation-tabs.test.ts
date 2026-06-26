import { describe, expect, it } from "bun:test";

import {
  buildLeagueNavigationTabItems,
  formatLeagueNavigationBadgeCount,
  resolveLeagueNavigationTabValue,
} from "./league-navigation-tabs";

const visitorAccess = {
  canOpenChallenges: false,
  canOpenRanking: false,
  canOpenRequests: false,
  canOpenRules: true,
  canOpenSchedule: true,
};

const participantAccess = {
  canOpenChallenges: true,
  canOpenRanking: true,
  canOpenRequests: false,
  canOpenRules: true,
  canOpenSchedule: true,
};

const ownerAccess = {
  canOpenChallenges: true,
  canOpenRanking: true,
  canOpenRequests: true,
  canOpenRules: true,
  canOpenSchedule: true,
};

describe("buildLeagueNavigationTabItems", () => {
  it("hides league navigation tabs for visitors", () => {
    expect(
      buildLeagueNavigationTabItems({
        access: visitorAccess,
        challengeActionCount: 3,
        requestActionCount: 2,
      })
    ).toEqual([]);
  });

  it("shows overview, ranking, and challenges for active participants", () => {
    expect(
      buildLeagueNavigationTabItems({
        access: participantAccess,
        challengeActionCount: 4,
        requestActionCount: 2,
      })
    ).toEqual([
      { badgeCount: 0, label: "Overview", value: "overview" },
      { badgeCount: 0, label: "Ranking", value: "ranking" },
      { badgeCount: 4, label: "Desafios", value: "challenges" },
    ]);
  });

  it("shows requests with pending count for owners", () => {
    expect(
      buildLeagueNavigationTabItems({
        access: ownerAccess,
        challengeActionCount: 1,
        requestActionCount: 3,
      })
    ).toEqual([
      { badgeCount: 0, label: "Overview", value: "overview" },
      { badgeCount: 0, label: "Ranking", value: "ranking" },
      { badgeCount: 1, label: "Desafios", value: "challenges" },
      { badgeCount: 3, label: "Solicitações", value: "requests" },
    ]);
  });
});

describe("resolveLeagueNavigationTabValue", () => {
  it("resolves active league route tabs from the pathname", () => {
    expect(resolveLeagueNavigationTabValue("/leagues/abc")).toBe("overview");
    expect(resolveLeagueNavigationTabValue("/leagues/abc/ranking")).toBe(
      "ranking"
    );
    expect(resolveLeagueNavigationTabValue("/leagues/abc/challenges")).toBe(
      "challenges"
    );
    expect(resolveLeagueNavigationTabValue("/leagues/abc/requests")).toBe(
      "requests"
    );
  });

  it("does not select a tab for secondary league pages", () => {
    expect(resolveLeagueNavigationTabValue("/leagues/abc/rules")).toBeNull();
  });
});

describe("formatLeagueNavigationBadgeCount", () => {
  it("caps large tab badge counts", () => {
    expect(formatLeagueNavigationBadgeCount(0)).toBe("0");
    expect(formatLeagueNavigationBadgeCount(99)).toBe("99");
    expect(formatLeagueNavigationBadgeCount(100)).toBe("99+");
  });
});
