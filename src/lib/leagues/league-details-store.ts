import { observable } from "@legendapp/state";
import type { ApiOutputs } from "@convex/shared/api";

import { buildChallengeTabCounts } from "./challenge-tab-counts";
import {
  buildLeagueDetailsAccess,
  buildLeagueDetailsCanOpenLeagueMenu,
  buildLeagueDetailsCanRequestJoin,
  buildLeagueDetailsRankingItems,
  buildLeagueDetailsRequestItems,
  buildLeagueDetailsRole,
  buildLeagueDetailsShowJoinFooter,
  buildLeagueRulesView,
  resolveLeagueDetailsViewerPosition,
  type LeagueDetailsRole,
} from "./league-details-derived";
import { getMembershipActionLabel } from "./presentation";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];
type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];
type OccupiedChallengeSlot =
  ApiOutputs["league"]["challenges"]["listOccupiedSlots"][number];

type ViewerActor = {
  id: string;
  kind: "organization" | "player";
};

export type LeagueDetailsRoute =
  | "overview"
  | "ranking"
  | "challenges"
  | "requests"
  | "rules";

export type LeagueDetailsChallengeCreateTarget = {
  membershipId: string;
  name: string;
};

type LeagueDetailsBucket = ReturnType<typeof createLeagueDetailsBucket>;

const leagueDetailsBuckets = new Map<string, LeagueDetailsBucket>();

function createLeagueDetailsBucket(leagueId: string) {
  const bucket$ = observable({
    identity: {
      activeRoute: "overview" as LeagueDetailsRoute,
      bootstrapStatus: "idle" as "bootstrapping" | "error" | "idle" | "ready",
      leagueId,
      resetVersion: 0,
    },
    viewer: {
      actorId: null as null | string,
      actorKind: null as null | ViewerActor["kind"],
      canJoinLeagues: false,
      membershipStatus: null as LeagueOverview["viewerMembershipStatus"],
      role: "visitor" as LeagueDetailsRole,
      viewerPlayerProfileId: null as null | string,
    },
    data: {
      challenges: [] as ChallengeItem[],
      league: null as LeagueOverview | null,
      membershipOverview: null as MembershipOverview | null,
      occupiedSlots: [] as OccupiedChallengeSlot[],
    },
    ui: {
      challengeCreateTarget: null as LeagueDetailsChallengeCreateTarget | null,
    },
    derived: {
      access: () => buildLeagueDetailsAccess(bucket$.viewer.role.get()),
      canManageLeague: () => bucket$.viewer.role.get() === "owner",
      canOpenChallenges: () => bucket$.derived.access.get().canOpenChallenges,
      canOpenLeagueMenu: () =>
        buildLeagueDetailsCanOpenLeagueMenu(bucket$.derived.access.get()),
      canOpenRanking: () => bucket$.derived.access.get().canOpenRanking,
      canOpenRequests: () => bucket$.derived.access.get().canOpenRequests,
      canOpenRules: () => bucket$.derived.access.get().canOpenRules,
      canRequestJoin: () =>
        buildLeagueDetailsCanRequestJoin({
          canJoinLeagues: bucket$.viewer.canJoinLeagues.get(),
          role: bucket$.viewer.role.get(),
          viewerMembershipStatus: bucket$.viewer.membershipStatus.get(),
        }),
      challengeCounts: () =>
        buildChallengeTabCounts({
          canManage: bucket$.derived.canManageLeague.get(),
          challenges: bucket$.data.challenges.get(),
          viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
        }),
      joinActionLabel: () =>
        getMembershipActionLabel(bucket$.viewer.membershipStatus.get(), {
          isManagerOwner: bucket$.derived.canManageLeague.get(),
        }),
      showJoinFooter: () =>
        buildLeagueDetailsShowJoinFooter({
          canJoinLeagues: bucket$.viewer.canJoinLeagues.get(),
          role: bucket$.viewer.role.get(),
        }),
      rankingItems: () => {
        const membershipOverview = bucket$.data.membershipOverview.get();
        const league = bucket$.data.league.get();

        if (!(membershipOverview && league)) {
          return [];
        }

        return buildLeagueDetailsRankingItems({
          maxChallengeDistance: league.ruleConfig.maxChallengeDistance,
          ranking: membershipOverview.ranking,
          role: bucket$.viewer.role.get(),
          viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
        });
      },
      requestItems: () =>
        buildLeagueDetailsRequestItems(bucket$.data.membershipOverview.get()),
      rulesView: () => {
        const league = bucket$.data.league.get();
        return league ? buildLeagueRulesView(league.ruleConfig) : null;
      },
      viewerPosition: () =>
        resolveLeagueDetailsViewerPosition({
          rankingItems: bucket$.derived.rankingItems.get(),
          viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
        }),
    },
    actions: {
      bootstrap: () => {
        bucket$.identity.bootstrapStatus.set("bootstrapping");
      },
      hydrateChallenges: (input: ChallengeItem[]) => {
        bucket$.data.challenges.set(input);
      },
      hydrateMembershipOverview: (input: MembershipOverview | null) => {
        bucket$.data.membershipOverview.set(input);
      },
      hydrateOccupiedSlots: (input: OccupiedChallengeSlot[]) => {
        bucket$.data.occupiedSlots.set(input);
      },
      hydrateOverview: (input: {
        canJoinLeagues: boolean;
        canUseOrganizerCapabilities: boolean;
        league: LeagueOverview;
        viewerActor: null | ViewerActor;
        viewerPlayerProfileId?: null | string;
      }) => {
        bucket$.data.league.set(input.league);
        bucket$.viewer.actorId.set(input.viewerActor?.id ?? null);
        bucket$.viewer.actorKind.set(input.viewerActor?.kind ?? null);
        bucket$.viewer.canJoinLeagues.set(input.canJoinLeagues);
        bucket$.viewer.membershipStatus.set(
          input.league.viewerMembershipStatus ?? null
        );
        bucket$.viewer.viewerPlayerProfileId.set(
          input.viewerPlayerProfileId ??
            (input.viewerActor?.kind === "player" ? input.viewerActor.id : null)
        );
        bucket$.viewer.role.set(
          buildLeagueDetailsRole({
            canUseOrganizerCapabilities: input.canUseOrganizerCapabilities,
            isManagerOwner: input.league.isManagerOwner === true,
            viewerMembershipStatus: input.league.viewerMembershipStatus,
          })
        );
        bucket$.identity.bootstrapStatus.set("ready");
      },
      setViewerMembershipStatus: (
        status: LeagueOverview["viewerMembershipStatus"]
      ) => {
        const nextStatus = status ?? null;

        bucket$.viewer.membershipStatus.set(nextStatus);

        const league = bucket$.data.league.get();

        if (league) {
          bucket$.data.league.set({
            ...league,
            viewerMembershipStatus: nextStatus,
          });
        }

        if (bucket$.viewer.role.get() !== "owner") {
          bucket$.viewer.role.set(
            nextStatus === "active" ? "participant" : "visitor"
          );
        }
      },
      reset: () => {
        bucket$.data.assign({
          challenges: [],
          league: null,
          membershipOverview: null,
          occupiedSlots: [],
        });
        bucket$.identity.activeRoute.set("overview");
        bucket$.identity.bootstrapStatus.set("idle");
        bucket$.identity.resetVersion.set(
          bucket$.identity.resetVersion.get() + 1
        );
        bucket$.ui.challengeCreateTarget.set(null);
        bucket$.viewer.assign({
          actorId: null,
          actorKind: null,
          canJoinLeagues: false,
          membershipStatus: null,
          role: "visitor",
          viewerPlayerProfileId: null,
        });
      },
      setActiveRoute: (route: LeagueDetailsRoute) => {
        bucket$.identity.activeRoute.set(route);
      },
      setBootstrapStatus: (
        status: "bootstrapping" | "error" | "idle" | "ready"
      ) => {
        bucket$.identity.bootstrapStatus.set(status);
      },
      setChallengeCreateTarget: (
        target: LeagueDetailsChallengeCreateTarget | null
      ) => {
        bucket$.ui.challengeCreateTarget.set(target);
      },
    },
  });

  return bucket$;
}

export const leagueDetailsStore$ = observable({
  bucketIds: [] as string[],
});

function syncLeagueDetailsBucketIds() {
  leagueDetailsStore$.bucketIds.set(Array.from(leagueDetailsBuckets.keys()));
}

export function getLeagueDetailsBucket$(leagueId: string) {
  const existing = leagueDetailsBuckets.get(leagueId);

  if (existing) {
    return existing;
  }

  const bucket$ = createLeagueDetailsBucket(leagueId);
  leagueDetailsBuckets.set(leagueId, bucket$);
  syncLeagueDetailsBucketIds();

  return bucket$;
}

export function resetLeagueDetailsStore() {
  for (const bucket$ of leagueDetailsBuckets.values()) {
    bucket$.actions.reset();
  }

  leagueDetailsBuckets.clear();
  syncLeagueDetailsBucketIds();
}
