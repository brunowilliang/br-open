import { observable } from "@legendapp/state";
import type { ApiOutputs } from "@convex/shared/api";
import type { PendingItem } from "@convex/domains/pendings/contract";
import { resolveRuleValue } from "@convex/domains/league/contract";

import { resolvePendingsForLeague } from "@/lib/pendings/pendings-view";

import { buildChallengeTabCounts } from "./challenge-tab-counts";
import {
  buildLeagueDetailsAccess,
  buildLeagueDetailsCanOpenLeagueMenu,
  buildLeagueDetailsCanRequestJoin,
  buildLeagueDetailsCanResumeCheckout,
  buildLeagueDetailsMenuActionCounts,
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
  | "rules"
  | "schedule";

export type LeaguePendingsStatus = "error" | "idle" | "loading" | "ready";

export type LeagueDetailsChallengeCreateTarget = {
  membershipId: string;
  name: string;
};

type LeagueDetailsBucket = ReturnType<typeof createLeagueDetailsBucket>;

const leagueDetailsBuckets = new Map<string, LeagueDetailsBucket>();

function createLeagueDetailsBucket(leagueId: string) {
  const bucket$ = observable({
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
        bucket$.viewer.membershipId.set(
          input.league.viewerMembershipId ?? null
        );
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
            isLeagueOrganizer: input.league.isLeagueOrganizer === true,
            viewerMembershipStatus: input.league.viewerMembershipStatus,
          })
        );
        bucket$.identity.bootstrapStatus.set("ready");
      },
      hydratePendings: (input: {
        items: PendingItem[];
        status: LeaguePendingsStatus;
      }) => {
        bucket$.data.pendings.set(input.items);
        bucket$.identity.pendingsStatus.set(input.status);
      },
      reset: () => {
        bucket$.data.assign({
          challenges: [],
          league: null,
          membershipOverview: null,
          occupiedSlots: [],
          pendings: [],
        });
        bucket$.identity.activeRoute.set("overview");
        bucket$.identity.bootstrapStatus.set("idle");
        bucket$.identity.challengesLoading.set(false);
        bucket$.identity.membershipOverviewLoading.set(false);
        bucket$.identity.pendingsStatus.set("idle");
        bucket$.identity.resetVersion.set(
          bucket$.identity.resetVersion.get() + 1
        );
        bucket$.ui.challengeCreateTarget.set(null);
        bucket$.viewer.assign({
          actorId: null,
          actorKind: null,
          canJoinLeagues: false,
          membershipId: null,
          membershipStatus: null,
          role: "guest",
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
      setChallengesLoading: (isLoading: boolean) => {
        bucket$.identity.challengesLoading.set(isLoading);
      },
      setMembershipOverviewLoading: (isLoading: boolean) => {
        bucket$.identity.membershipOverviewLoading.set(isLoading);
      },
      setViewerMembership: (input: {
        membershipId: null | string;
        status: LeagueOverview["viewerMembershipStatus"];
      }) => {
        const nextStatus = input.status ?? null;
        const nextMembershipId = input.membershipId ?? null;

        bucket$.viewer.membershipId.set(nextMembershipId);
        bucket$.viewer.membershipStatus.set(nextStatus);

        const league = bucket$.data.league.get();

        if (league) {
          bucket$.data.league.set({
            ...league,
            viewerMembershipId: nextMembershipId,
            viewerMembershipStatus: nextStatus,
          });
        }

        if (bucket$.viewer.role.get() !== "organizer") {
          bucket$.viewer.role.set(
            buildLeagueDetailsRole({
              canUseOrganizerCapabilities: false,
              isLeagueOrganizer: false,
              viewerMembershipStatus: nextStatus,
            })
          );
        }
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

        if (bucket$.viewer.role.get() !== "organizer") {
          bucket$.viewer.role.set(
            buildLeagueDetailsRole({
              canUseOrganizerCapabilities: false,
              isLeagueOrganizer: false,
              viewerMembershipStatus: nextStatus,
            })
          );
        }
      },
    },
    data: {
      challenges: [] as ChallengeItem[],
      league: null as LeagueOverview | null,
      membershipOverview: null as MembershipOverview | null,
      occupiedSlots: [] as OccupiedChallengeSlot[],
      /** Itens de pendings.list, escopo player. */
      pendings: [] as PendingItem[],
    },
    derived: {
      access: () => {
        const league = bucket$.data.league.get();
        const scheduleVisibility =
          league?.ruleConfig.scheduleVisibility ?? "public";
        return buildLeagueDetailsAccess({
          role: bucket$.viewer.role.get(),
          scheduleVisibility,
        });
      },
      canManageLeague: () => bucket$.viewer.role.get() === "organizer",
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
      canResumeCheckout: () =>
        buildLeagueDetailsCanResumeCheckout({
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
          isLeagueOrganizer: bucket$.derived.canManageLeague.get(),
        }),
      menuActionCounts: () =>
        buildLeagueDetailsMenuActionCounts({
          access: bucket$.derived.access.get(),
          challengeActionCount: buildChallengeTabCounts({
            canManage: bucket$.derived.canManageLeague.get(),
            challenges: bucket$.data.challenges.get(),
            viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
          }).main,
          requestActionCount: buildLeagueDetailsRequestItems(
            bucket$.data.membershipOverview.get()
          ).length,
        }),
      /** Itens do escopo player recortados para ESTA liga, na ordem do servidor. */
      pendings: () =>
        resolvePendingsForLeague({
          items: bucket$.data.pendings.get(),
          leagueId: bucket$.identity.leagueId.get(),
          membershipId: bucket$.viewer.membershipId.get(),
        }),
      rankingItems: () => {
        const membershipOverview = bucket$.data.membershipOverview.get();
        const league = bucket$.data.league.get();

        if (!(membershipOverview && league)) {
          return [];
        }

        return buildLeagueDetailsRankingItems({
          maxChallengeDistance: resolveRuleValue(
            league.ruleConfig.maxChallengeDistance,
            Number.POSITIVE_INFINITY
          ),
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
      showJoinFooter: () =>
        buildLeagueDetailsShowJoinFooter({
          canJoinLeagues: bucket$.viewer.canJoinLeagues.get(),
          role: bucket$.viewer.role.get(),
          viewerMembershipStatus: bucket$.viewer.membershipStatus.get(),
        }),
      viewerMembershipId: () => {
        const items = bucket$.derived.rankingItems.get();
        return items.find((item) => item.isViewerItem)?.id ?? null;
      },
      viewerPosition: () =>
        resolveLeagueDetailsViewerPosition({
          rankingItems: bucket$.derived.rankingItems.get(),
          viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
        }),
    },
    identity: {
      activeRoute: "overview" as LeagueDetailsRoute,
      bootstrapStatus: "idle" as "bootstrapping" | "error" | "idle" | "ready",
      challengesLoading: false,
      leagueId,
      membershipOverviewLoading: false,
      pendingsStatus: "idle" as LeaguePendingsStatus,
      resetVersion: 0,
    },
    ui: {
      challengeCreateTarget: null as LeagueDetailsChallengeCreateTarget | null,
    },
    viewer: {
      actorId: null as null | string,
      actorKind: null as null | ViewerActor["kind"],
      canJoinLeagues: false,
      membershipId: null as null | string,
      membershipStatus: null as LeagueOverview["viewerMembershipStatus"],
      role: "guest" as LeagueDetailsRole,
      viewerPlayerProfileId: null as null | string,
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
