import type { ApiOutputs } from "@convex/shared/api";
import { beforeEach, describe, expect, it } from "bun:test";

import {
  getLeagueDetailsBucket$,
  leagueDetailsStore$,
  resetLeagueDetailsStore,
} from "./league-details-store";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];

function makeLeagueOverview(
  overrides: Partial<LeagueOverview> = {}
): LeagueOverview {
  return {
    activePlayerCount: 0,
    avatarStorageId: null,
    categories: [],
    city: "Sao Paulo",
    courts: [],
    coverStorageId: null,
    createdAt: 1,
    id: "league-1",
    isManagerOwner: false,
    maxPlayers: null,
    mode: "challenges",
    monthlyPriceCents: 9000,
    name: "Liga 1",
    organizationId: "org-1",
    priceBillingInterval: "month",
    ruleConfig: {
      challengeValidationMode: "manual",
      hasInactivityPenalty: false,
      lossBehavior: "stay_put",
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
      maxActiveChallengesPerPlayer: 2,
      maxChallengeDistance: 3,
      maxChallengesPerMonth: 4,
      newPlayerPlacement: "end_of_ranking",
      responseDeadlineHours: 48,
      resultValidationMode: "automatic",
      walkoverBehavior: "automatic_loss",
      winBehavior: "take_opponent_position",
    },
    state: "active",
    updatedAt: 1,
    viewerMembershipStatus: null,
    visibility: "public",
    ...overrides,
  };
}

function makeMembershipOverview(
  overrides: Partial<MembershipOverview> = {}
): MembershipOverview {
  return {
    pendingRequests: [],
    ranking: [],
    ...overrides,
  };
}

describe("leagueDetailsStore$", () => {
  beforeEach(() => {
    resetLeagueDetailsStore();
  });

  it("keeps one isolated bucket per leagueId", () => {
    const alpha$ = getLeagueDetailsBucket$("league-alpha");
    const beta$ = getLeagueDetailsBucket$("league-beta");

    alpha$.actions.setActiveRoute("ranking");
    beta$.actions.setActiveRoute("overview");

    expect(String(alpha$.identity.leagueId)).toBe("league-alpha");
    expect(String(beta$.identity.leagueId)).toBe("league-beta");
    expect(getLeagueDetailsBucket$("league-alpha")).toBe(alpha$);
    expect(leagueDetailsStore$.bucketIds.get()).toEqual([
      "league-alpha",
      "league-beta",
    ]);
  });

  it("hydrates viewer role and route access from overview data", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: false,
      canUseOrganizerCapabilities: true,
      league: makeLeagueOverview({
        isManagerOwner: true,
        viewerMembershipStatus: "active",
      }),
      viewerActor: {
        id: "org-1",
        kind: "organization",
      },
    });

    expect(String(bucket$.viewer.role)).toBe("owner");
    expect(bucket$.derived.canOpenRequests()).toBe(true);
  });

  it("centralizes join, manager, and menu decisions in derived state", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: true,
      canUseOrganizerCapabilities: false,
      league: makeLeagueOverview(),
      viewerActor: {
        id: "player-1",
        kind: "player",
      },
    });

    expect(String(bucket$.viewer.canJoinLeagues)).toBe("true");
    expect(bucket$.derived.canManageLeague()).toBe(false);
    expect(bucket$.derived.canOpenLeagueMenu()).toBe(true);
    expect(bucket$.derived.canRequestJoin()).toBe(true);
    expect(bucket$.derived.showJoinFooter()).toBe(true);
  });

  it("updates menu request badges from hydrated membership overview", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: false,
      canUseOrganizerCapabilities: true,
      league: makeLeagueOverview({
        isManagerOwner: true,
      }),
      viewerActor: {
        id: "org-1",
        kind: "organization",
      },
    });

    bucket$.actions.hydrateMembershipOverview(
      makeMembershipOverview({
        pendingRequests: [
          {
            createdAt: 1,
            id: "membership-pending-1",
            leagueId: "league-1",
            player: {
              avatarUrl: null,
              fullName: "Ana",
              nickname: "ana",
            },
            playerProfileId: "player-1",
            status: "pending",
            updatedAt: 1,
          },
          {
            createdAt: 1,
            id: "membership-pending-2",
            leagueId: "league-1",
            player: {
              avatarUrl: null,
              fullName: "Bia",
              nickname: "bia",
            },
            playerProfileId: "player-2",
            status: "pending",
            updatedAt: 1,
          },
        ],
      })
    );

    expect(bucket$.derived.menuActionCounts()).toEqual({
      challenges: 0,
      requests: 2,
      total: 2,
    });
  });

  it("keeps the join footer visible after a request is pending", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: true,
      canUseOrganizerCapabilities: false,
      league: makeLeagueOverview({
        viewerMembershipStatus: "pending",
      }),
      viewerActor: {
        id: "player-1",
        kind: "player",
      },
    });

    expect(bucket$.derived.canRequestJoin()).toBe(false);
    expect(bucket$.derived.showJoinFooter()).toBe(true);
    expect(bucket$.derived.joinActionLabel()).toBe("Pendente");
  });

  it("updates the join footer immediately from a membership mutation status", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: true,
      canUseOrganizerCapabilities: false,
      league: makeLeagueOverview(),
      viewerActor: {
        id: "player-1",
        kind: "player",
      },
    });

    bucket$.actions.setViewerMembershipStatus("pending");

    expect(String(bucket$.viewer.membershipStatus)).toBe("pending");
    expect(String(bucket$.data.league?.viewerMembershipStatus)).toBe("pending");
    expect(bucket$.derived.canRequestJoin()).toBe(false);
    expect(bucket$.derived.showJoinFooter()).toBe(true);
    expect(bucket$.derived.joinActionLabel()).toBe("Pendente");

    bucket$.actions.setViewerMembershipStatus("left");

    expect(String(bucket$.viewer.membershipStatus)).toBe("left");
    expect(String(bucket$.data.league?.viewerMembershipStatus)).toBe("left");
    expect(bucket$.derived.canRequestJoin()).toBe(true);
    expect(bucket$.derived.showJoinFooter()).toBe(true);
    expect(bucket$.derived.joinActionLabel()).toBe("Solicitar entrada");
  });

  it("marks bucket resets so mounted league layouts can rehydrate cached data", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canJoinLeagues: true,
      canUseOrganizerCapabilities: false,
      league: makeLeagueOverview(),
      viewerActor: {
        id: "player-1",
        kind: "player",
      },
    });
    bucket$.actions.setActiveRoute("rules");

    const resetVersion = bucket$.identity.resetVersion.get();

    resetLeagueDetailsStore();

    expect(bucket$.identity.resetVersion.get()).toBe(resetVersion + 1);
    expect(String(bucket$.identity.activeRoute)).toBe("overview");
    expect(String(bucket$.identity.bootstrapStatus)).toBe("idle");
    expect(bucket$.data.league.get()).toBeNull();
    expect(getLeagueDetailsBucket$("league-1")).not.toBe(bucket$);
  });

  it("preserves a challenge create target across route changes inside the same bucket", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.setChallengeCreateTarget({
      membershipId: "membership-2",
      name: "Bob",
    });
    bucket$.actions.setActiveRoute("challenges");

    const target = bucket$.ui.challengeCreateTarget;

    if (!target) {
      throw new Error("Expected challenge create target to be set.");
    }

    expect(String(target.membershipId)).toBe("membership-2");
    expect(String(target.name)).toBe("Bob");
    expect(String(bucket$.identity.activeRoute)).toBe("challenges");
  });
});
