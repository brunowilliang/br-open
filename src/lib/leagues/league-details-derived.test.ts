import { describe, expect, it } from "bun:test";

import {
  buildLeagueDetailsAccess,
  buildLeagueDetailsCanOpenLeagueMenu,
  buildLeagueDetailsCanRequestJoin,
  buildLeagueDetailsMenuActionCounts,
  buildLeagueDetailsShowJoinFooter,
  buildLeagueDetailsRankingItems,
  buildLeagueDetailsRequestItems,
  buildLeagueDetailsRole,
  resolveLeagueDetailsRequestContentState,
  resolveLeagueDetailsVisibleRequestItems,
  buildLeagueRulesView,
  resolveLeagueDetailsViewerPosition,
  shouldFetchLeagueDetailsMembershipOverview,
} from "./league-details-derived";

describe("buildLeagueDetailsRole", () => {
  it("resolves owner before active membership when the viewer can manage the league", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: true,
        isLeagueOrganizer: true,
        viewerMembershipStatus: "active",
      })
    ).toBe("organizer");
  });

  it("resolves participant for an active member who cannot manage the league", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: false,
        isLeagueOrganizer: false,
        viewerMembershipStatus: "active",
      })
    ).toBe("player");
  });

  it("does not elevate a manager owner without organizer capability", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: false,
        isLeagueOrganizer: true,
        viewerMembershipStatus: "active",
      })
    ).toBe("player");
  });

  it("falls back to visitor when the viewer is not an active member", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: false,
        isLeagueOrganizer: false,
        viewerMembershipStatus: "pending",
      })
    ).toBe("guest");
  });
});

describe("buildLeagueDetailsAccess", () => {
  it("opens all operational routes for owner", () => {
    expect(
      buildLeagueDetailsAccess({
        role: "organizer",
        scheduleVisibility: "public",
      })
    ).toEqual({
      canOpenChallenges: true,
      canOpenRanking: true,
      canOpenRequests: true,
      canOpenRules: true,
      canOpenSchedule: true,
    });
  });

  it("keeps requests closed for participants", () => {
    expect(
      buildLeagueDetailsAccess({
        role: "player",
        scheduleVisibility: "public",
      })
    ).toEqual({
      canOpenChallenges: true,
      canOpenRanking: true,
      canOpenRequests: false,
      canOpenRules: true,
      canOpenSchedule: true,
    });
  });

  it("keeps ranking and challenges closed for visitors", () => {
    expect(
      buildLeagueDetailsAccess({
        role: "guest",
        scheduleVisibility: "public",
      })
    ).toEqual({
      canOpenChallenges: false,
      canOpenRanking: false,
      canOpenRequests: false,
      canOpenRules: true,
      canOpenSchedule: true,
    });
  });

  it("restricts schedule to members when visibility is members_only", () => {
    expect(
      buildLeagueDetailsAccess({
        role: "guest",
        scheduleVisibility: "members_only",
      })
    ).toMatchObject({ canOpenSchedule: false });
    expect(
      buildLeagueDetailsAccess({
        role: "player",
        scheduleVisibility: "members_only",
      })
    ).toMatchObject({ canOpenSchedule: true });
  });
});

describe("buildLeagueDetailsCanOpenLeagueMenu", () => {
  it("shows the league menu when at least one operational route is available", () => {
    expect(
      buildLeagueDetailsCanOpenLeagueMenu({
        canOpenChallenges: false,
        canOpenRanking: true,
        canOpenRequests: false,
        canOpenRules: true,
        canOpenSchedule: false,
      })
    ).toBe(true);
  });

  it("shows the league menu when only rules are available", () => {
    expect(
      buildLeagueDetailsCanOpenLeagueMenu({
        canOpenChallenges: false,
        canOpenRanking: false,
        canOpenRequests: false,
        canOpenRules: true,
        canOpenSchedule: false,
      })
    ).toBe(true);
  });
});

describe("buildLeagueDetailsMenuActionCounts", () => {
  it("sums only actionable menu counts from routes the viewer can open", () => {
    expect(
      buildLeagueDetailsMenuActionCounts({
        access: {
          canOpenChallenges: true,
          canOpenRanking: true,
          canOpenRequests: true,
          canOpenRules: true,
          canOpenSchedule: true,
        },
        challengeActionCount: 2,
        requestActionCount: 3,
      })
    ).toEqual({
      challenges: 2,
      requests: 3,
      total: 5,
    });
  });

  it("hides counts for closed menu routes", () => {
    expect(
      buildLeagueDetailsMenuActionCounts({
        access: {
          canOpenChallenges: true,
          canOpenRanking: true,
          canOpenRequests: false,
          canOpenRules: true,
          canOpenSchedule: true,
        },
        challengeActionCount: 1,
        requestActionCount: 4,
      })
    ).toEqual({
      challenges: 1,
      requests: 0,
      total: 1,
    });
  });
});

describe("shouldFetchLeagueDetailsMembershipOverview", () => {
  it("loads membership overview for ranking and request badges", () => {
    expect(
      shouldFetchLeagueDetailsMembershipOverview({
        canOpenChallenges: false,
        canOpenRanking: false,
        canOpenRequests: true,
        canOpenRules: true,
        canOpenSchedule: false,
      })
    ).toBe(true);
    expect(
      shouldFetchLeagueDetailsMembershipOverview({
        canOpenChallenges: false,
        canOpenRanking: true,
        canOpenRequests: false,
        canOpenRules: true,
        canOpenSchedule: false,
      })
    ).toBe(true);
  });

  it("skips membership overview when the viewer can only open static rules", () => {
    expect(
      shouldFetchLeagueDetailsMembershipOverview({
        canOpenChallenges: false,
        canOpenRanking: false,
        canOpenRequests: false,
        canOpenRules: true,
        canOpenSchedule: false,
      })
    ).toBe(false);
  });
});

describe("buildLeagueDetailsCanRequestJoin", () => {
  it("allows visitors with join capability to request entry", () => {
    expect(
      buildLeagueDetailsCanRequestJoin({
        canJoinLeagues: true,
        role: "guest",
        viewerMembershipStatus: null,
      })
    ).toBe(true);
  });

  it("blocks requests when the viewer already has a pending request", () => {
    expect(
      buildLeagueDetailsCanRequestJoin({
        canJoinLeagues: true,
        role: "guest",
        viewerMembershipStatus: "pending",
      })
    ).toBe(false);
  });

  it("blocks requests when the viewer is awaiting payment", () => {
    expect(
      buildLeagueDetailsCanRequestJoin({
        canJoinLeagues: true,
        role: "guest",
        viewerMembershipStatus: "awaiting_payment",
      })
    ).toBe(false);
  });

  it("blocks requests for members and managers", () => {
    expect(
      buildLeagueDetailsCanRequestJoin({
        canJoinLeagues: true,
        role: "player",
        viewerMembershipStatus: "active",
      })
    ).toBe(false);
    expect(
      buildLeagueDetailsCanRequestJoin({
        canJoinLeagues: true,
        role: "organizer",
        viewerMembershipStatus: "active",
      })
    ).toBe(false);
  });
});

describe("buildLeagueDetailsShowJoinFooter", () => {
  it("keeps the join footer visible for visitors who can join leagues", () => {
    expect(
      buildLeagueDetailsShowJoinFooter({
        canJoinLeagues: true,
        role: "guest",
      })
    ).toBe(true);
  });

  it("hides the join footer for participants, owners, and users who cannot join leagues", () => {
    expect(
      buildLeagueDetailsShowJoinFooter({
        canJoinLeagues: true,
        role: "player",
      })
    ).toBe(false);
    expect(
      buildLeagueDetailsShowJoinFooter({
        canJoinLeagues: true,
        role: "organizer",
      })
    ).toBe(false);
    expect(
      buildLeagueDetailsShowJoinFooter({
        canJoinLeagues: false,
        role: "guest",
      })
    ).toBe(false);
  });
});

describe("buildLeagueDetailsRankingItems", () => {
  it("marks only reachable higher positions as challengeable for the viewer", () => {
    const items = buildLeagueDetailsRankingItems({
      maxChallengeDistance: 2,
      ranking: [
        {
          createdAt: 1,
          id: "membership-1",
          leagueId: "league-1",
          player: { avatarUrl: null, fullName: "Alice", nickname: "ali" },
          playerProfileId: "player-1",
          status: "active",
          updatedAt: 1,
          rankingPosition: 1,
        },
        {
          createdAt: 1,
          id: "membership-2",
          leagueId: "league-1",
          player: { avatarUrl: null, fullName: "Bob", nickname: "bob" },
          playerProfileId: "player-2",
          status: "active",
          updatedAt: 1,
          rankingPosition: 2,
        },
        {
          createdAt: 1,
          id: "membership-3",
          leagueId: "league-1",
          player: { avatarUrl: null, fullName: "Carol", nickname: "car" },
          playerProfileId: "viewer",
          status: "active",
          updatedAt: 1,
          rankingPosition: 3,
        },
        {
          createdAt: 1,
          id: "membership-4",
          leagueId: "league-1",
          player: { avatarUrl: null, fullName: "Dora", nickname: "dor" },
          playerProfileId: "player-4",
          status: "active",
          updatedAt: 1,
          rankingPosition: 4,
        },
      ],
      role: "player",
      viewerPlayerProfileId: "viewer",
    });

    expect(
      items.map((item) => ({
        id: item.id,
        isChallengeable: item.isChallengeable,
        isViewerItem: item.isViewerItem,
      }))
    ).toEqual([
      { id: "membership-1", isChallengeable: true, isViewerItem: false },
      { id: "membership-2", isChallengeable: true, isViewerItem: false },
      { id: "membership-3", isChallengeable: false, isViewerItem: true },
      { id: "membership-4", isChallengeable: false, isViewerItem: false },
    ]);
  });
});

describe("buildLeagueDetailsRequestItems", () => {
  it("maps pending requests into a UI-only list shape", () => {
    expect(
      buildLeagueDetailsRequestItems({
        pendingRequests: [
          {
            createdAt: 1,
            id: "membership-pending",
            leagueId: "league-1",
            player: {
              avatarUrl: "https://cdn.example/avatar.png",
              fullName: "Debora",
              nickname: "deb",
            },
            playerProfileId: "player-pending",
            status: "pending",
            updatedAt: 1,
          },
        ],
      })
    ).toEqual([
      {
        avatarUrl: "https://cdn.example/avatar.png",
        id: "membership-pending",
        name: "Debora",
        nickname: "deb",
      },
    ]);
  });
});

describe("resolveLeagueDetailsVisibleRequestItems", () => {
  it("uses fresh query data before the store hydration effect runs", () => {
    expect(
      resolveLeagueDetailsVisibleRequestItems({
        membershipOverview: {
          pendingRequests: [
            {
              createdAt: 1,
              id: "fresh-pending",
              leagueId: "league-1",
              player: {
                avatarUrl: null,
                fullName: "Ana",
                nickname: "ana",
              },
              playerProfileId: "player-fresh",
              status: "pending",
              updatedAt: 1,
            },
          ],
        },
        requestItems: [],
      })
    ).toEqual([
      {
        avatarUrl: null,
        id: "fresh-pending",
        name: "Ana",
        nickname: "ana",
      },
    ]);
  });
});

describe("resolveLeagueDetailsRequestContentState", () => {
  it("keeps the requests route loading while an empty list is still fetching", () => {
    expect(
      resolveLeagueDetailsRequestContentState({
        isError: false,
        isFetching: true,
        isPending: false,
        requestCount: 0,
      })
    ).toBe("loading");
  });

  it("keeps visible requests on screen while refreshing", () => {
    expect(
      resolveLeagueDetailsRequestContentState({
        isError: false,
        isFetching: true,
        isPending: false,
        requestCount: 1,
      })
    ).toBe("list");
  });
});

describe("resolveLeagueDetailsViewerPosition", () => {
  it("returns the viewer ranking position when present", () => {
    expect(
      resolveLeagueDetailsViewerPosition({
        rankingItems: [
          { playerProfileId: "other", position: 1 },
          { playerProfileId: "viewer", position: 2 },
        ],
        viewerPlayerProfileId: "viewer",
      })
    ).toBe(2);
  });
});

describe("buildLeagueRulesView", () => {
  it("builds a readable rules view from the league ruleConfig", () => {
    const view = buildLeagueRulesView({
      challengeValidationMode: "manual",
      hasInactivityPenalty: true,
      inactivityPenaltyDays: 21,
      inactivityPenaltyType: "drop_one_position",
      lossBehavior: "stay_put",
      scheduleVisibility: "public",
      matchConfig: {
        bestOfSets: 3,
        defaultDurationMinutes: 90,
        finalSetGamesPerSet: 6,
        finalSetHasTieBreak: true,
        finalSetMode: "same_as_previous",
        finalSetMustWinByTwoGames: true,
        finalSetScoringMode: "advantage",
        finalSetSuperTieBreakMustWinByTwo: true,
        finalSetSuperTieBreakPoints: 10,
        finalSetTieBreakAtGamesAll: 6,
        finalSetTieBreakMustWinByTwo: true,
        finalSetTieBreakPoints: 7,
        gamesPerSet: 6,
        hasTieBreak: true,
        scoringMode: "advantage",
        setMustWinByTwoGames: true,
        tieBreakAtGamesAll: 6,
        tieBreakMustWinByTwo: true,
        tieBreakPoints: 7,
      },
      maxActiveChallengesPerPlayer: { enabled: true, value: 2 },
      maxChallengeDistance: { enabled: true, value: 3 },
      maxChallengesPerMonth: { enabled: true, value: 4 },
      newPlayerPlacement: "end_of_ranking",
      responseDeadlineHours: { enabled: true, value: 48 },
      resultValidationMode: "automatic",
      walkoverBehavior: "automatic_loss",
      winBehavior: "take_opponent_position",
    });

    expect(view.validation.result).toBe("Automática");
    expect(view.validation.challenge).toBe("Manual");
    expect(view.challenge.maxDistance).toContain("3");
    expect(view.challenge.activeLimit).toContain("2");
    expect(view.inactivity).toContain("21 dias");
    expect(view.progression.winBehavior).toContain("posição do adversário");
    expect(view.progression.walkoverBehavior).toContain("derrota automática");
    expect(view.match.format).toContain("Melhor de 3 sets");
  });
});
