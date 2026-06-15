# League Details Route Store Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the league details flow so `/leagues/[leagueId]` becomes overview-only, `ranking/challenges/requests/rules` become dedicated routes, and the feature shares one `Legend-State` v3 store under `src/lib` instead of passing business state through fragmented props.

**Architecture:** Keep React Query as the source of truth for query and mutation data, and add one singleton `leagueDetailsStore$` with per-`leagueId` buckets for shared feature state, route access, derived labels, rules view models, and cross-route interactions like “challenge this player from ranking and open the create dialog in challenges”. Move dense route/view-model logic into pure `src/lib/leagues/*` helpers, keep route files responsible for query orchestration and access control, and keep page components focused on rendering and local interaction state only.

**Tech Stack:** Expo Router, React Native, HeroUI Native, HeroUI Native Pro, TanStack Query, Convex CRPC API types, `@legendapp/state@3.0.0-beta.47`, Bun test, Ultracite.

---

## File Structure

- Modify: `package.json`
  - Add `@legendapp/state@3.0.0-beta.47`.
- Modify: `bun.lock`
  - Capture the resolved Legend-State dependency.
- Create: `src/lib/leagues/league-details-derived.ts`
  - Pure helpers for role resolution, route access, ranking/request mapping, rules view models, and ranking challengeability.
- Create: `src/lib/leagues/league-details-derived.test.ts`
  - Bun tests for the pure helpers above.
- Create: `src/lib/leagues/league-details-store.ts`
  - One singleton `leagueDetailsStore$` with per-`leagueId` buckets and bootstrap/hydration actions.
- Create: `src/lib/leagues/league-details-store.test.ts`
  - Bun tests for bucket isolation, hydration, and shared cross-route state.
- Create: `src/lib/leagues/challenge-route-view.ts`
  - Pure helpers for challenge tabs, filtered lists, and empty-state selection.
- Create: `src/lib/leagues/challenge-route-view.test.ts`
  - Bun tests for the challenge route view helpers.
- Modify: `src/lib/leagues/challenge-feedback.ts`
  - Keep challenge toast copy in `src/lib` instead of importing route-local helpers from `index.tsx`.
- Create: `src/components/pages/leagues/league-details-links.tsx`
  - Overview-only navigation cards/rows to `ranking`, `challenges`, `requests`, and `rules`.
- Create: `src/components/pages/leagues/league-rules-view.tsx`
  - Read-only rules screen used only by league details routes.
- Modify: `src/components/pages/leagues/preview.tsx`
  - Keep it focused on overview presentation and consume pre-derived rules/summary data where needed.
- Modify: `src/components/pages/leagues/ranking.tsx`
  - Remove challengeability derivation from the component and accept precomputed view-model items.
- Modify: `src/components/pages/leagues/challenges.tsx`
  - Replace route-view derivation with pure helper outputs and keep only screen-local interaction state.
- Modify: `src/components/pages/leagues/membership-requests.tsx`
  - Keep it UI-only and consume request items already prepared by the route/store.
- Create: `src/app/(private)/leagues/[leagueId]/_layout.tsx`
  - Feature layout, route registration, overview bootstrap, and store hydration.
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`
  - Overview route only; remove tab navigation and operational screen rendering.
- Create: `src/app/(private)/leagues/[leagueId]/ranking.tsx`
  - Ranking route with member/owner guard and ranking-specific hydration.
- Create: `src/app/(private)/leagues/[leagueId]/challenges.tsx`
  - Challenges route with member/owner guard and challenge-specific hydration.
- Create: `src/app/(private)/leagues/[leagueId]/requests.tsx`
  - Owner-only requests route with membership hydration.
- Create: `src/app/(private)/leagues/[leagueId]/rules.tsx`
  - Read-only rules route.

## Task 1: Install Legend-State V3 And Carve Out Tested Pure Detail Helpers

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/lib/leagues/league-details-derived.ts`
- Create: `src/lib/leagues/league-details-derived.test.ts`

- [ ] **Step 1: Add the requested Legend-State v3 package**

Run: `bun add @legendapp/state@3.0.0-beta.47`  
Expected: Bun updates `package.json` and `bun.lock` with the new dependency.

- [ ] **Step 2: Write the failing pure-helper tests first**

Create `src/lib/leagues/league-details-derived.test.ts` with the role, access, ranking, request, and rules-view expectations that will anchor the refactor.

```ts
import { describe, expect, it } from "bun:test";

import {
  buildLeagueDetailsAccess,
  buildLeagueDetailsRankingItems,
  buildLeagueDetailsRequestItems,
  buildLeagueDetailsRole,
  buildLeagueRulesView,
  resolveLeagueDetailsViewerPosition,
} from "./league-details-derived";

describe("buildLeagueDetailsRole", () => {
  it("resolves owner before active membership when the viewer can manage the league", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: true,
        isManagerOwner: true,
        viewerMembershipStatus: "active",
      })
    ).toBe("owner");
  });

  it("resolves participant for an active member who cannot manage the league", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: false,
        isManagerOwner: false,
        viewerMembershipStatus: "active",
      })
    ).toBe("participant");
  });

  it("falls back to visitor when the viewer is not an active member", () => {
    expect(
      buildLeagueDetailsRole({
        canUseOrganizerCapabilities: false,
        isManagerOwner: false,
        viewerMembershipStatus: "pending",
      })
    ).toBe("visitor");
  });
});

describe("buildLeagueDetailsAccess", () => {
  it("opens all operational routes for owner", () => {
    expect(buildLeagueDetailsAccess("owner")).toEqual({
      canOpenChallenges: true,
      canOpenRanking: true,
      canOpenRequests: true,
      canOpenRules: true,
    });
  });

  it("keeps requests closed for participants", () => {
    expect(buildLeagueDetailsAccess("participant")).toEqual({
      canOpenChallenges: true,
      canOpenRanking: true,
      canOpenRequests: false,
      canOpenRules: true,
    });
  });

  it("keeps ranking and challenges closed for visitors", () => {
    expect(buildLeagueDetailsAccess("visitor")).toEqual({
      canOpenChallenges: false,
      canOpenRanking: false,
      canOpenRequests: false,
      canOpenRules: true,
    });
  });
});

describe("buildLeagueDetailsRankingItems", () => {
  it("marks only reachable higher positions as challengeable for the viewer", () => {
    const items = buildLeagueDetailsRankingItems({
      maxChallengeDistance: 2,
      ranking: [
        {
          id: "membership-1",
          player: { avatarUrl: null, fullName: "Alice", nickname: "ali" },
          playerProfileId: "player-1",
          rankingPosition: 1,
        },
        {
          id: "membership-2",
          player: { avatarUrl: null, fullName: "Bob", nickname: "bob" },
          playerProfileId: "player-2",
          rankingPosition: 2,
        },
        {
          id: "membership-3",
          player: { avatarUrl: null, fullName: "Carol", nickname: "car" },
          playerProfileId: "viewer",
          rankingPosition: 3,
        },
      ],
      role: "participant",
      viewerPlayerProfileId: "viewer",
    });

    expect(items.map((item) => [item.id, item.isChallengeable])).toEqual([
      ["membership-1", true],
      ["membership-2", true],
      ["membership-3", false],
    ]);
  });
});

describe("buildLeagueDetailsRequestItems", () => {
  it("maps pending requests into a UI-only list shape", () => {
    expect(
      buildLeagueDetailsRequestItems({
        pendingRequests: [
          {
            id: "membership-pending",
            player: {
              avatarUrl: "https://cdn.example/avatar.png",
              fullName: "Debora",
              nickname: "deb",
            },
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

describe("resolveLeagueDetailsViewerPosition", () => {
  it("returns the viewer ranking position when present", () => {
    expect(
      resolveLeagueDetailsViewerPosition({
        rankingItems: [
          { id: "a", playerProfileId: "other", position: 1 },
          { id: "b", playerProfileId: "viewer", position: 2 },
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
      matchConfig: {
        bestOfSets: 3,
        defaultDurationMinutes: 90,
        finalSetGamesPerSet: 6,
        finalSetMode: "same_as_previous",
        finalSetSuperTieBreakPoints: 10,
        gamesPerSet: 6,
        hasTieBreak: true,
        scoringMode: "advantage",
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
    });

    expect(view.validation.result).toBe("Automática");
    expect(view.validation.challenge).toBe("Manual");
    expect(view.challenge.maxDistance).toContain("3");
    expect(view.inactivity).toContain("21 dias");
  });
});
```

- [ ] **Step 3: Run the pure-helper tests to confirm the red phase**

Run: `bun test src/lib/leagues/league-details-derived.test.ts`  
Expected: FAIL with missing `league-details-derived` exports.

- [ ] **Step 4: Implement the pure helper module**

Create `src/lib/leagues/league-details-derived.ts` and move the reusable role, access, mapping, and rules formatting logic there instead of leaving it inside route/components.

```ts
import type { ApiOutputs } from "@convex/shared/api";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];

export type LeagueDetailsRole = "visitor" | "participant" | "owner";

export function buildLeagueDetailsRole(input: {
  canUseOrganizerCapabilities: boolean;
  isManagerOwner: boolean;
  viewerMembershipStatus: string | null | undefined;
}): LeagueDetailsRole {
  if (input.isManagerOwner && input.canUseOrganizerCapabilities) {
    return "owner";
  }

  if (input.viewerMembershipStatus === "active") {
    return "participant";
  }

  return "visitor";
}

export function buildLeagueDetailsAccess(role: LeagueDetailsRole) {
  return {
    canOpenChallenges: role === "participant" || role === "owner",
    canOpenRanking: role === "participant" || role === "owner",
    canOpenRequests: role === "owner",
    canOpenRules: true,
  };
}

export function buildLeagueDetailsRequestItems(
  membershipOverview: Pick<MembershipOverview, "pendingRequests"> | null | undefined
) {
  return (
    membershipOverview?.pendingRequests.map((item) => ({
      avatarUrl: item.player.avatarUrl,
      id: item.id,
      name: item.player.fullName,
      nickname: item.player.nickname,
    })) ?? []
  );
}

export function buildLeagueDetailsRankingItems(input: {
  maxChallengeDistance: number;
  ranking: MembershipOverview["ranking"];
  role: LeagueDetailsRole;
  viewerPlayerProfileId: null | string;
}) {
  const items = input.ranking.map((item, index) => ({
    avatarUrl: item.player.avatarUrl,
    id: item.id,
    isViewerItem: item.playerProfileId === input.viewerPlayerProfileId,
    name: item.player.fullName,
    nickname: item.player.nickname,
    playerProfileId: item.playerProfileId,
    position: item.rankingPosition ?? index + 1,
  }));

  const viewerPosition = resolveLeagueDetailsViewerPosition({
    rankingItems: items,
    viewerPlayerProfileId: input.viewerPlayerProfileId,
  });

  return items.map((item) => ({
    ...item,
    isChallengeable:
      input.role === "participant" &&
      typeof viewerPosition === "number" &&
      item.playerProfileId !== input.viewerPlayerProfileId &&
      item.position < viewerPosition &&
      viewerPosition - item.position <= input.maxChallengeDistance,
  }));
}

export function resolveLeagueDetailsViewerPosition(input: {
  rankingItems: Array<{ playerProfileId?: string; position: number }>;
  viewerPlayerProfileId: null | string;
}) {
  return (
    input.rankingItems.find(
      (item) => item.playerProfileId === input.viewerPlayerProfileId
    )?.position ?? null
  );
}

export function buildLeagueRulesView(ruleConfig: LeagueOverview["ruleConfig"]) {
  return {
    challenge: {
      maxDistance: `${ruleConfig.maxChallengeDistance} posições acima`,
      monthlyLimit: `${ruleConfig.maxChallengesPerMonth} por mês`,
      simultaneousLimit: `${ruleConfig.maxActiveChallengesPerPlayer} ativos`,
      responseDeadline: `${ruleConfig.responseDeadlineHours} horas`,
    },
    inactivity: ruleConfig.hasInactivityPenalty
      ? `Após ${ruleConfig.inactivityPenaltyDays} dias sem jogar, a penalidade é aplicada.`
      : "Sem penalidade automática por inatividade.",
    validation: {
      challenge:
        ruleConfig.challengeValidationMode === "manual"
          ? "Manual"
          : "Automática",
      result:
        ruleConfig.resultValidationMode === "manual"
          ? "Manual"
          : "Automática",
    },
  };
}
```

- [ ] **Step 5: Run the new tests and repo-level typing**

Run: `bun test src/lib/leagues/league-details-derived.test.ts`  
Expected: PASS

Run: `bun run typecheck`  
Expected: no TypeScript errors.

## Task 2: Build The Singleton Feature Store And Shared Layout Bootstrap

**Files:**
- Create: `src/lib/leagues/league-details-store.ts`
- Create: `src/lib/leagues/league-details-store.test.ts`
- Create: `src/app/(private)/leagues/[leagueId]/_layout.tsx`

- [ ] **Step 1: Write failing store tests for bucket isolation and cross-route state**

Create `src/lib/leagues/league-details-store.test.ts`.

```ts
import { beforeEach, describe, expect, it } from "bun:test";

import {
  getLeagueDetailsBucket$,
  leagueDetailsStore$,
  resetLeagueDetailsStore,
} from "./league-details-store";

describe("leagueDetailsStore$", () => {
  beforeEach(() => {
    resetLeagueDetailsStore();
  });

  it("keeps one isolated bucket per leagueId", () => {
    const alpha$ = getLeagueDetailsBucket$("league-alpha");
    const beta$ = getLeagueDetailsBucket$("league-beta");

    alpha$.identity.activeRoute.set("ranking");
    beta$.identity.activeRoute.set("overview");

    expect(alpha$.identity.leagueId.get()).toBe("league-alpha");
    expect(beta$.identity.leagueId.get()).toBe("league-beta");
    expect(leagueDetailsStore$.buckets.leagueAlpha?.get()).toBeUndefined();
  });

  it("hydrates viewer role and route access from overview data", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.hydrateOverview({
      canUseOrganizerCapabilities: true,
      league: {
        id: "league-1",
        isManagerOwner: true,
        viewerMembershipStatus: "active",
      },
      viewerActor: {
        id: "org-1",
        kind: "organization",
      },
    });

    expect(bucket$.viewer.role.get()).toBe("owner");
    expect(bucket$.derived.canOpenRequests.get()).toBe(true);
  });

  it("preserves a challenge create target across route changes inside the same bucket", () => {
    const bucket$ = getLeagueDetailsBucket$("league-1");

    bucket$.actions.setChallengeCreateTarget({
      membershipId: "membership-2",
      name: "Bob",
    });
    bucket$.actions.setActiveRoute("challenges");

    expect(bucket$.ui.challengeCreateTarget.get()).toEqual({
      membershipId: "membership-2",
      name: "Bob",
    });
    expect(bucket$.identity.activeRoute.get()).toBe("challenges");
  });
});
```

- [ ] **Step 2: Run the store tests to confirm the red phase**

Run: `bun test src/lib/leagues/league-details-store.test.ts`  
Expected: FAIL because the store does not exist yet.

- [ ] **Step 3: Implement the singleton store with per-league buckets**

Create `src/lib/leagues/league-details-store.ts`.

```ts
import { observable } from "@legendapp/state";

import {
  buildLeagueDetailsAccess,
  buildLeagueDetailsRankingItems,
  buildLeagueDetailsRequestItems,
  buildLeagueDetailsRole,
  buildLeagueRulesView,
  resolveLeagueDetailsViewerPosition,
  type LeagueDetailsRole,
} from "./league-details-derived";
import { buildChallengeTabCounts } from "./challenge-tab-counts";
import { getMembershipActionLabel } from "./presentation";

export type LeagueDetailsRoute =
  | "overview"
  | "ranking"
  | "challenges"
  | "requests"
  | "rules";

type LeagueDetailsBucket = ReturnType<typeof createLeagueDetailsBucket>;

function createLeagueDetailsBucket(leagueId: string) {
  const bucket$ = observable({
    identity: {
      activeRoute: "overview" as LeagueDetailsRoute,
      bootstrapStatus: "idle" as "idle" | "bootstrapping" | "ready" | "error",
      leagueId,
    },
    viewer: {
      actorId: null as null | string,
      actorKind: null as "organization" | "player" | null,
      membershipStatus: null as null | string,
      role: "visitor" as LeagueDetailsRole,
      viewerPlayerProfileId: null as null | string,
    },
    data: {
      challenges: [] as Array<any>,
      league: null as any,
      membershipOverview: null as any,
      occupiedSlots: [] as Array<any>,
    },
    ui: {
      challengeCreateTarget: null as
        | null
        | {
            membershipId: string;
            name: string;
          },
    },
    derived: {
      access: () => buildLeagueDetailsAccess(bucket$.viewer.role.get()),
      challengeCounts: () =>
        buildChallengeTabCounts({
          canManage: bucket$.viewer.role.get() === "owner",
          challenges: bucket$.data.challenges.get(),
          viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
        }),
      joinActionLabel: () =>
        getMembershipActionLabel(bucket$.viewer.membershipStatus.get(), {
          isManagerOwner: bucket$.viewer.role.get() === "owner",
        }),
      rankingItems: () => {
        const membershipOverview = bucket$.data.membershipOverview.get();
        const league = bucket$.data.league.get();

        return membershipOverview
          ? buildLeagueDetailsRankingItems({
              maxChallengeDistance: league?.ruleConfig.maxChallengeDistance ?? 0,
              ranking: membershipOverview.ranking,
              role: bucket$.viewer.role.get(),
              viewerPlayerProfileId: bucket$.viewer.viewerPlayerProfileId.get(),
            })
          : [];
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
      hydrateChallenges: (input: Array<any>) => {
        bucket$.data.challenges.set(input);
      },
      hydrateMembershipOverview: (input: any) => {
        bucket$.data.membershipOverview.set(input);
      },
      hydrateOccupiedSlots: (input: Array<any>) => {
        bucket$.data.occupiedSlots.set(input);
      },
      hydrateOverview: (input: {
        canUseOrganizerCapabilities: boolean;
        league: any;
        viewerActor: null | { id: string; kind: "organization" | "player" };
        viewerPlayerProfileId?: null | string;
      }) => {
        bucket$.data.league.set(input.league);
        bucket$.viewer.actorId.set(input.viewerActor?.id ?? null);
        bucket$.viewer.actorKind.set(input.viewerActor?.kind ?? null);
        bucket$.viewer.membershipStatus.set(
          input.league.viewerMembershipStatus ?? null
        );
        bucket$.viewer.viewerPlayerProfileId.set(
          input.viewerPlayerProfileId ?? null
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
      reset: () => {
        bucket$.data.assign({
          challenges: [],
          league: null,
          membershipOverview: null,
          occupiedSlots: [],
        });
        bucket$.ui.challengeCreateTarget.set(null);
        bucket$.identity.activeRoute.set("overview");
        bucket$.identity.bootstrapStatus.set("idle");
      },
      setActiveRoute: (route: LeagueDetailsRoute) => {
        bucket$.identity.activeRoute.set(route);
      },
      setChallengeCreateTarget: (target: LeagueDetailsBucket["ui"]["challengeCreateTarget"]) => {
        bucket$.ui.challengeCreateTarget.set(target);
      },
    },
  });

  return bucket$;
}

export const leagueDetailsStore$ = observable({
  buckets: {} as Record<string, ReturnType<typeof createLeagueDetailsBucket>>,
});

export function getLeagueDetailsBucket$(leagueId: string) {
  const existing = leagueDetailsStore$.buckets[leagueId].get();
  if (existing) {
    return existing;
  }

  const bucket$ = createLeagueDetailsBucket(leagueId);
  leagueDetailsStore$.buckets[leagueId].set(bucket$);
  return bucket$;
}

export function resetLeagueDetailsStore() {
  leagueDetailsStore$.buckets.set({});
}
```

- [ ] **Step 4: Create the feature layout that bootstraps overview state once**

Create `src/app/(private)/leagues/[leagueId]/_layout.tsx`.

```tsx
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueDetailsLayout() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const crpc = useCRPC();

  const viewerQuery = useQuery(crpc.viewer.context.get.queryOptions());
  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(leagueId),
  });

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const bucket$ = getLeagueDetailsBucket$(leagueId);
    bucket$.actions.bootstrap();
  }, [leagueId]);

  useEffect(() => {
    if (!(leagueId && leagueQuery.data && viewerQuery.data)) {
      return;
    }

    const bucket$ = getLeagueDetailsBucket$(leagueId);
    bucket$.actions.hydrateOverview({
      canUseOrganizerCapabilities:
        viewerQuery.data.capabilities?.canManageLeagues === true,
      league: leagueQuery.data,
      viewerActor: viewerQuery.data.activeActor
        ? {
            id: viewerQuery.data.activeActor.id,
            kind: viewerQuery.data.activeActor.kind,
          }
        : null,
      viewerPlayerProfileId:
        viewerQuery.data.activeActor?.kind === "player"
          ? viewerQuery.data.activeActor.id
          : null,
    });
  }, [leagueId, leagueQuery.data, viewerQuery.data]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ranking" />
      <Stack.Screen name="challenges" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="rules" />
    </Stack>
  );
}
```

- [ ] **Step 5: Run the store tests and typecheck after the feature shell exists**

Run: `bun test src/lib/leagues/league-details-store.test.ts`  
Expected: PASS

Run: `bun run typecheck`  
Expected: no TypeScript errors.

## Task 3: Turn The Existing Index Route Into Overview-Only Navigation

**Files:**
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`
- Create: `src/components/pages/leagues/league-details-links.tsx`
- Modify: `src/components/pages/leagues/preview.tsx`

- [ ] **Step 1: Create the overview navigation component instead of tabs**

Create `src/components/pages/leagues/league-details-links.tsx`.

```tsx
import { Link, type Href } from "expo-router";
import { Card } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";

export type LeagueDetailsLinkItem = {
  description: string;
  href: Href;
  isVisible: boolean;
  label: string;
};

export function LeagueDetailsLinks(props: {
  items: LeagueDetailsLinkItem[];
}) {
  return (
    <View className="gap-3">
      {props.items
        .filter((item) => item.isVisible)
        .map((item) => (
          <Link asChild href={item.href} key={item.label}>
            <Card className="gap-1 p-4" variant="tertiary">
              <Text weight="semibold">{item.label}</Text>
              <Text color="muted" variant="description">
                {item.description}
              </Text>
            </Card>
          </Link>
        ))}
    </View>
  );
}
```

- [ ] **Step 2: Replace tab state in `index.tsx` with overview-only logic**

Delete the tab-specific route code from `src/app/(private)/leagues/[leagueId]/index.tsx`:

- `LEAGUE_TAB_VALUES`
- `LeagueTabValue`
- `normalizeLeagueTabParam`
- `activeTab`
- `Tabs`
- inline `Tabs.Content` blocks for ranking, challenges, and requests

Replace it with a route that only fetches overview data, keeps the join CTA, and renders links to subroutes.

```tsx
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useValue } from "@legendapp/state/react";
import { ScrollView, View } from "react-native";

import { LeaguePreview } from "@/components/pages/leagues/preview";
import {
  LeagueDetailsLinks,
  type LeagueDetailsLinkItem,
} from "@/components/pages/leagues/league-details-links";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueOverviewRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const crpc = useCRPC();
  const { toast } = useToast();

  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(leagueId),
  });

  if (!leagueId) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="grow px-4 py-6">
        <ErrorState message="Liga inválida." />
      </ScrollView>
    );
  }

  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const joinActionLabel = useValue(bucket$.derived.joinActionLabel);

  const linkItems: LeagueDetailsLinkItem[] = [
    {
      description: "Veja a classificação atual da liga.",
      href: { params: { leagueId }, pathname: "/leagues/[leagueId]/ranking" },
      isVisible: access.canOpenRanking,
      label: "Ranking",
    },
    {
      description: "Acompanhe os desafios e resultados.",
      href: {
        params: { leagueId },
        pathname: "/leagues/[leagueId]/challenges",
      },
      isVisible: access.canOpenChallenges,
      label: "Desafios",
    },
    {
      description: "Revise as solicitações pendentes da liga.",
      href: {
        params: { leagueId },
        pathname: "/leagues/[leagueId]/requests",
      },
      isVisible: access.canOpenRequests,
      label: "Solicitações",
    },
    {
      description: "Entenda todas as regras e validações da liga.",
      href: { params: { leagueId }, pathname: "/leagues/[leagueId]/rules" },
      isVisible: access.canOpenRules,
      label: "Regras",
    },
  ];

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>{leagueQuery.data?.name ?? "Liga"}</Page.Header.Title>
        </Page.Header.Center>
      </Page.Header>
      <Page.ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
      >
        <LeaguePreview league={leagueQuery.data!} />
        <LeagueDetailsLinks items={linkItems} />
        <Button onPress={() => toast.show({ label: joinActionLabel })}>
          <Button.Label>{joinActionLabel}</Button.Label>
        </Button>
      </Page.ScrollView>
    </Page>
  );
}
```

- [ ] **Step 3: Keep `preview.tsx` focused on presentation**

Strip out any route/tab knowledge from `src/components/pages/leagues/preview.tsx`. If a rule formatter is now needed by both preview and the rules route, import it from `league-details-derived.ts` instead of keeping duplicate formatting logic in the component.

```tsx
import { buildLeagueRulesView } from "@/lib/leagues/league-details-derived";

export function LeaguePreview(props: { league: LeaguePreviewLeague }) {
  const rulesView = buildLeagueRulesView(props.league.ruleConfig);

  return (
    <View className="gap-4">
      {/* existing hero/stat blocks stay here */}
      <Card className="gap-1 p-4" variant="tertiary">
        <Text weight="semibold">Validação</Text>
        <Text color="muted" variant="description">
          Desafio: {rulesView.validation.challenge} · Resultado:{" "}
          {rulesView.validation.result}
        </Text>
      </Card>
    </View>
  );
}
```

- [ ] **Step 4: Run repo typing and static checks after the tab removal**

Run: `bun run typecheck`  
Expected: no TypeScript errors.

Run: `bun run check`  
Expected: no Ultracite violations.

## Task 4: Extract Ranking Into Its Own Route And Make The Component Purely Visual

**Files:**
- Create: `src/app/(private)/leagues/[leagueId]/ranking.tsx`
- Modify: `src/components/pages/leagues/ranking.tsx`
- Modify: `src/lib/leagues/league-details-store.ts`

- [ ] **Step 1: Extend the shared store for cross-route “challenge this player” state**

Add a shared create-target action so tapping `Desafiar` on the ranking screen can open the proposal dialog on the challenges route.

```ts
ui: {
  challengeCreateTarget: null as
    | null
    | {
        membershipId: string;
        name: string;
      },
},
actions: {
  clearChallengeCreateTarget: () => {
    bucket$.ui.challengeCreateTarget.set(null);
  },
  setChallengeCreateTarget: (target) => {
    bucket$.ui.challengeCreateTarget.set(target);
  },
},
```

- [ ] **Step 2: Simplify the ranking component props so it stops deriving business rules**

Update `src/components/pages/leagues/ranking.tsx` so it receives prepared item flags instead of raw access inputs.

```ts
export type RankingItemView = {
  avatarUrl?: string | null;
  id: string;
  isChallengeable: boolean;
  isViewerItem: boolean;
  name: string;
  nickname: string;
  playerProfileId?: string;
  position: number;
};

type RankingProps = {
  canManage?: boolean;
  error?: unknown;
  isDisabled?: boolean;
  isLoading?: boolean;
  items: RankingItemView[];
  onChange?: (items: RankingItemView[]) => void;
  onChallengePress?: (item: RankingItemView) => void;
  onRemove?: (membershipId: string) => Promise<void>;
};
```

Delete the local `isViewerChallengeable` and `isViewerOwnItem` helpers and use `item.isChallengeable` / `item.isViewerItem` directly inside render branches.

- [ ] **Step 3: Create the dedicated ranking route**

Create `src/app/(private)/leagues/[leagueId]/ranking.tsx`.

```tsx
import { useQuery } from "@tanstack/react-query";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { Ranking } from "@/components/pages/leagues/ranking";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueRankingRoute() {
  const router = useRouter();
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const crpc = useCRPC();

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const canManageLeague = useValue(bucket$.viewer.role) === "owner";

  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: access.canOpenRanking,
  });

  useEffect(() => {
    bucket$.actions.setActiveRoute("ranking");
  }, [bucket$]);

  useEffect(() => {
    if (membershipOverviewQuery.data) {
      bucket$.actions.hydrateMembershipOverview(membershipOverviewQuery.data);
    }
  }, [bucket$, membershipOverviewQuery.data]);

  useEffect(() => {
    if (!access.canOpenRanking) {
      router.replace({ params: { leagueId }, pathname: "/leagues/[leagueId]" });
    }
  }, [access.canOpenRanking, leagueId, router]);

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Ranking</Page.Header.Title>
        </Page.Header.Center>
      </Page.Header>
      <Page.View className="flex-1 px-4 pb-safe-offset-4">
        {membershipOverviewQuery.isPending ? (
          <LoadingState />
        ) : (
          <Ranking
            canManage={canManageLeague}
            error={membershipOverviewQuery.error}
            isLoading={membershipOverviewQuery.isPending}
            items={rankingItems}
            onChallengePress={(item) => {
              bucket$.actions.setChallengeCreateTarget({
                membershipId: item.id,
                name: item.name,
              });
              router.push({
                params: { leagueId },
                pathname: "/leagues/[leagueId]/challenges",
              });
            }}
          />
        )}
      </Page.View>
    </Page>
  );
}
```

- [ ] **Step 4: Run the existing pure tests plus typecheck after the ranking split**

Run: `bun test src/lib/leagues/league-details-derived.test.ts src/lib/leagues/league-details-store.test.ts`  
Expected: PASS

Run: `bun run typecheck`  
Expected: no TypeScript errors.

## Task 5: Extract Challenge Route View Logic And Move Challenges To Its Own Route

**Files:**
- Create: `src/lib/leagues/challenge-route-view.ts`
- Create: `src/lib/leagues/challenge-route-view.test.ts`
- Create: `src/app/(private)/leagues/[leagueId]/challenges.tsx`
- Modify: `src/components/pages/leagues/challenges.tsx`

- [ ] **Step 1: Write failing tests for challenge tab/filter view logic**

Create `src/lib/leagues/challenge-route-view.test.ts`.

```ts
import { describe, expect, it } from "bun:test";

import {
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "./challenge-route-view";

const sampleChallenges = [
  {
    challenged: { membershipId: "challenged-a", playerProfileId: "viewer" },
    challenger: { membershipId: "challenger-a", playerProfileId: "other-a" },
    id: "challenge-a",
    status: "pending_opponent_response",
  },
  {
    challenged: { membershipId: "challenged-b", playerProfileId: "other-b" },
    challenger: { membershipId: "challenger-b", playerProfileId: "viewer" },
    id: "challenge-b",
    status: "confirmed",
  },
  {
    challenged: { membershipId: "challenged-c", playerProfileId: "other-c" },
    challenger: { membershipId: "challenger-c", playerProfileId: "other-d" },
    id: "challenge-c",
    status: "pending_admin_result_validation",
  },
] as const;

describe("buildChallengeRouteInitialTab", () => {
  it("starts owners on the pending tab only when a pending bucket exists", () => {
    expect(buildChallengeRouteInitialTab({ canManage: true, pendingCount: 1 })).toBe("pending");
    expect(buildChallengeRouteInitialTab({ canManage: true, pendingCount: 0 })).toBe("active");
  });

  it("starts participants on the active tab", () => {
    expect(buildChallengeRouteInitialTab({ canManage: false, pendingCount: 0 })).toBe("active");
  });
});

describe("buildChallengeRouteVisibleChallenges", () => {
  it("shows only admin-pending challenges on the pending tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "pending",
      canManage: true,
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-c"]);
  });

  it("shows only viewer incoming challenges on the incoming tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "incoming",
      canManage: false,
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-a"]);
  });
});

describe("buildChallengeRouteEmptyState", () => {
  it("uses the owner-specific empty state when there are no challenges", () => {
    expect(
      buildChallengeRouteEmptyState({
        canManage: true,
        hasAnyChallenges: false,
      })
    ).toEqual({
      description: "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui.",
      title: "Nenhum desafio encontrado",
    });
  });
});
```

- [ ] **Step 2: Run the challenge route-view tests to confirm the red phase**

Run: `bun test src/lib/leagues/challenge-route-view.test.ts`  
Expected: FAIL with missing helper exports.

- [ ] **Step 3: Implement the pure challenge route-view helpers**

Create `src/lib/leagues/challenge-route-view.ts`.

```ts
const CLOSED_CHALLENGE_STATUSES = new Set([
  "finished",
  "declined",
  "cancelled",
  "invalidated",
]);

export function buildChallengeRouteInitialTab(input: {
  canManage: boolean;
  pendingCount: number;
}) {
  if (input.canManage) {
    return input.pendingCount > 0 ? "pending" : "active";
  }

  return "active";
}

export function buildChallengeRouteVisibleChallenges(input: {
  activeTab: string;
  canManage: boolean;
  challenges: Array<any>;
  viewerPlayerProfileId: null | string;
}) {
  if (input.canManage) {
    switch (input.activeTab) {
      case "pending":
        return input.challenges.filter((challenge) =>
          [
            "pending_admin_challenge_validation",
            "pending_admin_result_validation",
            "pending_admin_decision",
          ].includes(challenge.status)
        );
      case "active":
        return input.challenges.filter(
          (challenge) => !CLOSED_CHALLENGE_STATUSES.has(challenge.status)
        );
      case "corrections":
        return input.challenges.filter(
          (challenge) => challenge.status === "pending_result_correction"
        );
      default:
        return input.challenges.filter((challenge) =>
          CLOSED_CHALLENGE_STATUSES.has(challenge.status)
        );
    }
  }

  switch (input.activeTab) {
    case "incoming":
      return input.challenges.filter(
        (challenge) =>
          challenge.challenged.playerProfileId === input.viewerPlayerProfileId
      );
    case "outgoing":
      return input.challenges.filter(
        (challenge) =>
          challenge.challenger.playerProfileId === input.viewerPlayerProfileId
      );
    case "history":
      return input.challenges.filter((challenge) =>
        CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter(
        (challenge) => !CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
  }
}

export function buildChallengeRouteEmptyState(input: {
  canManage: boolean;
  hasAnyChallenges: boolean;
}) {
  if (!input.hasAnyChallenges) {
    return {
      description: input.canManage
        ? "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui."
        : "Quando você abrir ou receber desafios, eles aparecerão aqui.",
      title: "Nenhum desafio encontrado",
    };
  }

  return {
    description: "Nenhum desafio corresponde ao filtro selecionado.",
    title: "Nada por aqui",
  };
}
```

- [ ] **Step 4: Move admin challenge toast helpers into `src/lib/leagues/challenge-feedback.ts`**

Extend `src/lib/leagues/challenge-feedback.ts` so the route no longer owns these message builders.

```ts
export function getAdminManageChallengeSuccessToast(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
}) {
  switch (input.action) {
    case "cancel":
      return {
        description: "A ação administrativa foi aplicada com sucesso.",
        id: "admin-manage-challenge-cancel-success",
        label: "Desafio cancelado",
        variant: "success" as const,
      };
    case "invalidate":
      return {
        description: "A ação administrativa foi aplicada com sucesso.",
        id: "admin-manage-challenge-invalidate-success",
        label: "Desafio invalidado",
        variant: "success" as const,
      };
    case "reopen_challenge":
      return {
        description: "O desafio foi reaberto com sucesso.",
        id: "admin-manage-challenge-reopen-challenge-success",
        label: "Desafio reaberto",
        variant: "success" as const,
      };
    default:
      return {
        description: "O resultado foi reaberto com sucesso.",
        id: "admin-manage-challenge-reopen-result-success",
        label: "Resultado reaberto",
        variant: "success" as const,
      };
  }
}

export function getAdminManageChallengeErrorToast(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  message?: string;
}) {
  switch (input.action) {
    case "cancel":
      return {
        description:
          input.message || "Não foi possível cancelar o desafio pelo admin.",
        id: "admin-manage-challenge-cancel-error",
        label: "Erro ao cancelar desafio",
        variant: "danger" as const,
      };
    case "invalidate":
      return {
        description:
          input.message || "Não foi possível invalidar o desafio pelo admin.",
        id: "admin-manage-challenge-invalidate-error",
        label: "Erro ao invalidar desafio",
        variant: "danger" as const,
      };
    case "reopen_challenge":
      return {
        description: input.message || "Não foi possível reabrir o desafio.",
        id: "admin-manage-challenge-reopen-challenge-error",
        label: "Erro ao reabrir desafio",
        variant: "danger" as const,
      };
    default:
      return {
        description: input.message || "Não foi possível reabrir o resultado.",
        id: "admin-manage-challenge-reopen-result-error",
        label: "Erro ao reabrir resultado",
        variant: "danger" as const,
      };
  }
}
```

- [ ] **Step 5: Wire the dedicated challenges route and consume the shared create target**

Create `src/app/(private)/leagues/[leagueId]/challenges.tsx`.

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { useToast } from "heroui-native";
import { useQueryClient } from "@tanstack/react-query";

import { Challenges } from "@/components/pages/leagues/challenges";
import { ErrorState } from "@/components/ui/error-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  getAdminManageChallengeErrorToast,
  getAdminManageChallengeSuccessToast,
  getCreateChallengeErrorToast,
} from "@/lib/leagues/challenge-feedback";

export default function LeagueChallengesRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const crpc = useCRPC();

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const createTarget = useValue(bucket$.ui.challengeCreateTarget);
  const league = useValue(bucket$.data.league);
  const viewerPlayerProfileId = useValue(bucket$.viewer.viewerPlayerProfileId);
  const canManageLeague = useValue(bucket$.viewer.role) === "owner";

  const challengesQuery = useQuery({
    ...crpc.league.challenges.listForLeague.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
  });
  const occupiedSlotsQuery = useQuery({
    ...crpc.league.challenges.listOccupiedSlots.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
  });

  async function invalidateChallengeContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listForLeague.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
    ]);
  }

  const createChallenge = useMutation(
    crpc.league.challenges.create.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        bucket$.actions.clearChallengeCreateTarget();
        toast.show({
          description: "Desafio enviado com sucesso.",
          id: "create-challenge-success",
          label: "Desafio criado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show(
          getCreateChallengeErrorToast(
            getToastErrorMessage(error, "Não foi possível criar o desafio.")
          )
        );
      },
    })
  );

  const acceptChallengeProposal = useMutation(
    crpc.league.challenges.acceptProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Proposta aceita com sucesso.",
          id: "accept-challenge-proposal-success",
          label: "Desafio aceito",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível aceitar a proposta."
          ),
          id: "accept-challenge-proposal-error",
          label: "Erro ao aceitar desafio",
          variant: "danger",
        });
      },
    })
  );

  const declineChallengeProposal = useMutation(
    crpc.league.challenges.declineProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Proposta recusada com sucesso.",
          id: "decline-challenge-proposal-success",
          label: "Desafio recusado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível recusar a proposta."
          ),
          id: "decline-challenge-proposal-error",
          label: "Erro ao recusar desafio",
          variant: "danger",
        });
      },
    })
  );

  const counterProposeChallenge = useMutation(
    crpc.league.challenges.counterPropose.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Contraproposta enviada com sucesso.",
          id: "counter-propose-challenge-success",
          label: "Contraproposta enviada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível reenviar a proposta."
          ),
          id: "counter-propose-challenge-error",
          label: "Erro ao reenviar proposta",
          variant: "danger",
        });
      },
    })
  );

  const cancelChallenge = useMutation(
    crpc.league.challenges.cancel.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Desafio cancelado com sucesso.",
          id: "cancel-challenge-success",
          label: "Desafio cancelado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível cancelar o desafio."
          ),
          id: "cancel-challenge-error",
          label: "Erro ao cancelar desafio",
          variant: "danger",
        });
      },
    })
  );

  const requestChallengeCancellation = useMutation(
    crpc.league.challenges.requestCancellation.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Solicitação de cancelamento enviada com sucesso.",
          id: "request-challenge-cancellation-success",
          label: "Cancelamento solicitado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar o cancelamento da partida."
          ),
          id: "request-challenge-cancellation-error",
          label: "Erro ao solicitar cancelamento",
          variant: "danger",
        });
      },
    })
  );

  const respondChallengeCancellation = useMutation(
    crpc.league.challenges.respondCancellationRequest.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateChallengeContext();
        toast.show({
          description:
            variables.action === "accept"
              ? "Cancelamento aceito com sucesso."
              : "Cancelamento recusado com sucesso.",
          id:
            variables.action === "accept"
              ? "accept-challenge-cancellation-success"
              : "reject-challenge-cancellation-success",
          label:
            variables.action === "accept"
              ? "Cancelamento aceito"
              : "Cancelamento recusado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível responder à solicitação de cancelamento."
          ),
          id: "respond-challenge-cancellation-error",
          label: "Erro ao responder cancelamento",
          variant: "danger",
        });
      },
    })
  );

  const submitChallengeResult = useMutation(
    crpc.league.challenges.submitResult.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Placar enviado com sucesso.",
          id: "submit-challenge-result-success",
          label: "Placar enviado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o placar."
          ),
          id: "submit-challenge-result-error",
          label: "Erro ao enviar placar",
          variant: "danger",
        });
      },
    })
  );

  const confirmChallengeResult = useMutation(
    crpc.league.challenges.confirmResult.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Placar confirmado com sucesso.",
          id: "confirm-challenge-result-success",
          label: "Placar confirmado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível confirmar o placar."
          ),
          id: "confirm-challenge-result-error",
          label: "Erro ao confirmar placar",
          variant: "danger",
        });
      },
    })
  );

  const reviewChallenge = useMutation(
    crpc.league.challenges.reviewChallenge.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Validação do desafio atualizada com sucesso.",
          id: "review-challenge-success",
          label: "Desafio validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o desafio."
          ),
          id: "review-challenge-error",
          label: "Erro ao validar desafio",
          variant: "danger",
        });
      },
    })
  );

  const reviewChallengeResult = useMutation(
    crpc.league.challenges.reviewResult.mutationOptions({
      onSuccess: async () => {
        await invalidateChallengeContext();
        toast.show({
          description: "Validação do resultado atualizada com sucesso.",
          id: "review-challenge-result-success",
          label: "Resultado validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o resultado."
          ),
          id: "review-challenge-result-error",
          label: "Erro ao validar resultado",
          variant: "danger",
        });
      },
    })
  );

  const adminManageChallenge = useMutation(
    crpc.league.challenges.adminManage.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateChallengeContext();
        toast.show(getAdminManageChallengeSuccessToast(variables));
      },
      onError: (error, variables) => {
        toast.show(
          getAdminManageChallengeErrorToast({
            action: variables.action,
            message: getToastErrorMessage(
              error,
              "Não foi possível aplicar a ação."
            ),
          })
        );
      },
    })
  );

  useEffect(() => {
    bucket$.actions.setActiveRoute("challenges");
  }, [bucket$]);

  useEffect(() => {
    if (challengesQuery.data) {
      bucket$.actions.hydrateChallenges(challengesQuery.data);
    }
  }, [bucket$, challengesQuery.data]);

  useEffect(() => {
    if (occupiedSlotsQuery.data) {
      bucket$.actions.hydrateOccupiedSlots(occupiedSlotsQuery.data);
    }
  }, [bucket$, occupiedSlotsQuery.data]);

  useEffect(() => {
    if (!access.canOpenChallenges) {
      router.replace({ params: { leagueId }, pathname: "/leagues/[leagueId]" });
    }
  }, [access.canOpenChallenges, leagueId, router]);

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Desafios</Page.Header.Title>
        </Page.Header.Center>
      </Page.Header>
      <Page.View className="flex-1 px-4">
        <Challenges
          canManage={canManageLeague}
          challengeValidationMode={league?.ruleConfig.challengeValidationMode}
          challenges={challengesQuery.data ?? []}
          courts={league?.courts ?? []}
          createTarget={createTarget}
          defaultDurationMinutes={league?.ruleConfig.matchConfig.defaultDurationMinutes ?? 0}
          error={challengesQuery.error ?? occupiedSlotsQuery.error}
          isLoading={challengesQuery.isPending || occupiedSlotsQuery.isPending}
          occupiedSlots={occupiedSlotsQuery.data ?? []}
          onCloseCreateTarget={() => bucket$.actions.clearChallengeCreateTarget()}
          resultValidationMode={league?.ruleConfig.resultValidationMode}
          viewerPlayerProfileId={viewerPlayerProfileId}
          onAccept={(challengeId) => {
            acceptChallengeProposal.mutate({ challengeId, leagueId });
          }}
          onAdminManage={(input) =>
            adminManageChallenge.mutateAsync({ ...input, leagueId })
          }
          onCancel={(challengeId) => {
            cancelChallenge.mutate({ challengeId, leagueId });
          }}
          onConfirmResult={(challengeId) => {
            confirmChallengeResult.mutate({ challengeId, leagueId });
          }}
          onCounterPropose={(input) =>
            counterProposeChallenge.mutateAsync({ ...input, leagueId })
          }
          onCreate={(input) =>
            createChallenge.mutateAsync({ ...input, leagueId })
          }
          onDecline={(challengeId) => {
            declineChallengeProposal.mutate({ challengeId, leagueId });
          }}
          onRequestCancellation={(challengeId) => {
            requestChallengeCancellation.mutate({ challengeId, leagueId });
          }}
          onRespondCancellation={(input) => {
            respondChallengeCancellation.mutate({ ...input, leagueId });
          }}
          onReviewChallenge={(input) => {
            reviewChallenge.mutate({ ...input, leagueId });
          }}
          onReviewResult={(input) => {
            reviewChallengeResult.mutate({ ...input, leagueId });
          }}
          onSubmitResult={(input) =>
            submitChallengeResult.mutateAsync({ ...input, leagueId })
          }
        />
      </Page.View>
    </Page>
  );
}
```

Then modify `src/components/pages/leagues/challenges.tsx` so the tab counts, initial tab, filtered challenge lists, and empty-state copy use the pure helpers from `challenge-route-view.ts` instead of keeping that derivation inline.

```tsx
import {
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "@/lib/leagues/challenge-route-view";

const tabCounts = useMemo(
  () =>
    buildChallengeTabCounts({
      canManage,
      challenges,
      viewerPlayerProfileId,
    }),
  [canManage, challenges, viewerPlayerProfileId]
);

const [activeTab, setActiveTab] = useState(
  buildChallengeRouteInitialTab({
    canManage: Boolean(canManage),
    pendingCount: tabCounts.pending,
  })
);

const visibleChallenges = useMemo(
  () =>
    buildChallengeRouteVisibleChallenges({
      activeTab,
      canManage: Boolean(canManage),
      challenges,
      viewerPlayerProfileId,
    }),
  [activeTab, canManage, challenges, viewerPlayerProfileId]
);

const emptyState = buildChallengeRouteEmptyState({
  canManage: Boolean(canManage),
  hasAnyChallenges: challenges.length > 0,
});
```

- [ ] **Step 6: Run the challenge view tests and repo typing**

Run: `bun test src/lib/leagues/challenge-route-view.test.ts src/lib/leagues/challenge-tab-counts.test.ts`  
Expected: PASS

Run: `bun run typecheck`  
Expected: no TypeScript errors.

## Task 6: Add The Requests And Rules Routes And Keep Both UI-Only

**Files:**
- Create: `src/app/(private)/leagues/[leagueId]/requests.tsx`
- Create: `src/app/(private)/leagues/[leagueId]/rules.tsx`
- Create: `src/components/pages/leagues/league-rules-view.tsx`
- Modify: `src/components/pages/leagues/membership-requests.tsx`

- [ ] **Step 1: Create the owner-only requests route**

Create `src/app/(private)/leagues/[leagueId]/requests.tsx`.

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect } from "react";

import { MembershipRequests } from "@/components/pages/leagues/membership-requests";
import { ErrorState } from "@/components/ui/error-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueRequestsRoute() {
  const router = useRouter();
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const crpc = useCRPC();

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const requestItems = useValue(bucket$.derived.requestItems);

  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: access.canOpenRequests,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function invalidateMembershipContext() {
    await queryClient.invalidateQueries(
      crpc.league.membership.getOverview.queryFilter({ leagueId })
    );
  }

  const approveMembership = useMutation(
    crpc.league.membership.approve.mutationOptions({
      onSuccess: async () => {
        await invalidateMembershipContext();
        toast.show({
          description: "Participante aprovado com sucesso.",
          id: "approve-membership-success",
          label: "Solicitação aprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível aprovar a solicitação."
          ),
          id: "approve-membership-error",
          label: "Erro ao aprovar solicitação",
          variant: "danger",
        });
      },
    })
  );

  const rejectMembership = useMutation(
    crpc.league.membership.reject.mutationOptions({
      onSuccess: async () => {
        await invalidateMembershipContext();
        toast.show({
          description: "Solicitação reprovada com sucesso.",
          id: "reject-membership-success",
          label: "Solicitação reprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível reprovar a solicitação."
          ),
          id: "reject-membership-error",
          label: "Erro ao reprovar solicitação",
          variant: "danger",
        });
      },
    })
  );

  useEffect(() => {
    bucket$.actions.setActiveRoute("requests");
  }, [bucket$]);

  useEffect(() => {
    if (membershipOverviewQuery.data) {
      bucket$.actions.hydrateMembershipOverview(membershipOverviewQuery.data);
    }
  }, [bucket$, membershipOverviewQuery.data]);

  useEffect(() => {
    if (!access.canOpenRequests) {
      router.replace({ params: { leagueId }, pathname: "/leagues/[leagueId]" });
    }
  }, [access.canOpenRequests, leagueId, router]);

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Solicitações</Page.Header.Title>
        </Page.Header.Center>
      </Page.Header>
      <Page.ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
      >
        <MembershipRequests
          error={membershipOverviewQuery.error}
          isLoading={membershipOverviewQuery.isPending}
          items={requestItems}
          onApprove={(membershipId) => {
            approveMembership.mutate({ leagueId, membershipId });
          }}
          onReject={(membershipId) => {
            rejectMembership.mutate({ leagueId, membershipId });
          }}
        />
      </Page.ScrollView>
    </Page>
  );
}
```

- [ ] **Step 2: Create the dedicated read-only rules UI**

Create `src/components/pages/leagues/league-rules-view.tsx`.

```tsx
import { Card } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";

type LeagueRulesViewModel = {
  challenge: {
    maxDistance: string;
    monthlyLimit: string;
    simultaneousLimit: string;
    responseDeadline: string;
  };
  inactivity: string;
  validation: {
    challenge: string;
    result: string;
  };
};

export function LeagueRulesView(props: { rules: LeagueRulesViewModel }) {
  return (
    <View className="gap-4">
      <Card className="gap-2 p-4" variant="tertiary">
        <Text weight="semibold">Desafios</Text>
        <Text color="muted" variant="description">
          Distância: {props.rules.challenge.maxDistance}
        </Text>
        <Text color="muted" variant="description">
          Limite mensal: {props.rules.challenge.monthlyLimit}
        </Text>
        <Text color="muted" variant="description">
          Limite simultâneo: {props.rules.challenge.simultaneousLimit}
        </Text>
        <Text color="muted" variant="description">
          Prazo de resposta: {props.rules.challenge.responseDeadline}
        </Text>
      </Card>

      <Card className="gap-2 p-4" variant="tertiary">
        <Text weight="semibold">Validações</Text>
        <Text color="muted" variant="description">
          Desafio: {props.rules.validation.challenge}
        </Text>
        <Text color="muted" variant="description">
          Resultado: {props.rules.validation.result}
        </Text>
      </Card>

      <Card className="gap-2 p-4" variant="tertiary">
        <Text weight="semibold">Inatividade</Text>
        <Text color="muted" variant="description">
          {props.rules.inactivity}
        </Text>
      </Card>
    </View>
  );
}
```

- [ ] **Step 3: Create the dedicated rules route**

Create `src/app/(private)/leagues/[leagueId]/rules.tsx`.

```tsx
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { LeagueRulesView } from "@/components/pages/leagues/league-rules-view";
import { ErrorState } from "@/components/ui/error-state";
import { Page } from "@/components/ui/page";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueRulesRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const rulesView = useValue(bucket$.derived.rulesView);

  useEffect(() => {
    bucket$.actions.setActiveRoute("rules");
  }, [bucket$]);

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Regras</Page.Header.Title>
        </Page.Header.Center>
      </Page.Header>
      <Page.ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
      >
        {rulesView ? (
          <LeagueRulesView rules={rulesView} />
        ) : (
          <ErrorState message="Não foi possível carregar as regras da liga." />
        )}
      </Page.ScrollView>
    </Page>
  );
}
```

- [ ] **Step 4: Keep `membership-requests.tsx` UI-only**

Trim `src/components/pages/leagues/membership-requests.tsx` so it remains a list renderer plus callbacks. Do not let it re-derive owner-only access or store state.

```tsx
export const MembershipRequests = (props: MembershipRequestsProps) => {
  const { error, isLoading, isPending, items, onApprove, onReject } = props;

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        message="Não foi possível carregar as solicitações."
      />
    );
  }

  return (
    <ListGroup>
      {items.map((item) => (
        <ListGroup.Item disabled key={item.id}>
          <ListGroup.ItemPrefix>
            <Image
              className="size-10 rounded-full"
              fallback="blue"
              source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
            />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle numberOfLines={1}>
              {item.name}
            </ListGroup.ItemTitle>
            <ListGroup.ItemDescription numberOfLines={1}>
              {item.nickname}
            </ListGroup.ItemDescription>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix className="flex-row gap-1">
            <Button
              isDisabled={isPending}
              isIconOnly
              onPress={() => onReject(item.id)}
              size="sm"
              variant="outline"
            >
              <HugeIcons icon={Cancel01Icon} />
            </Button>
            <Button
              isDisabled={isPending}
              isIconOnly
              onPress={() => onApprove(item.id)}
              size="sm"
            >
              <HugeIcons
                className="text-accent-foreground"
                icon={Tick02Icon}
              />
            </Button>
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};
```

- [ ] **Step 5: Run typecheck and static checks after the new routes exist**

Run: `bun run typecheck`  
Expected: no TypeScript errors.

Run: `bun run check`  
Expected: no Ultracite violations.

## Task 7: Remove Dead Tab Logic, Finish Mutation Wiring, And Run Full Verification

**Files:**
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/ranking.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/challenges.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/requests.tsx`
- Modify: `src/lib/leagues/league-details-store.ts`
- Modify: `src/lib/leagues/league-details-derived.ts`
- Modify: `src/components/pages/leagues/preview.tsx`
- Modify: `src/components/pages/leagues/ranking.tsx`
- Modify: `src/components/pages/leagues/challenges.tsx`

- [ ] **Step 1: Remove dead helpers and the old tab-query-param flow completely**

Delete any leftover `tab` parsing or `Tabs`-only operational routing from the old index route. The final league details navigation must be path-based only.

```ts
// Remove all of this from index.tsx
const LEAGUE_TAB_VALUES = ["details", "ranking", "challenges", "requests"] as const;

function normalizeLeagueTabParam(
  value?: string | string[]
): LeagueTabValue | null {
  // delete this entire helper
}
```

- [ ] **Step 2: Replace the no-op callbacks in the new routes with the existing real mutations**

Wire the real mutation blocks already present in the old `index.tsx` into the dedicated routes instead of keeping placeholders.

```tsx
const createChallenge = useMutation(
  crpc.league.challenges.create.mutationOptions({
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(
          crpc.league.challenges.listForLeague.queryFilter({ leagueId })
        ),
        queryClient.invalidateQueries(
          crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
        ),
      ]);
      bucket$.actions.clearChallengeCreateTarget();
    },
  })
);

<Challenges
  onCreate={(input) =>
    createChallenge.mutateAsync({
      ...input,
      leagueId,
    })
  }
  onCloseCreateTarget={() => bucket$.actions.clearChallengeCreateTarget()}
/>
```

Do the same route-by-route for:

- `requestJoin`
- `approveMembership`
- `rejectMembership`
- `reorderRanking`
- challenge accept/decline/cancel/counterproposal/result/admin actions

- [ ] **Step 3: Run the focused test suite for all new pure helpers and stores**

Run: `bun test src/lib/leagues/league-details-derived.test.ts src/lib/leagues/league-details-store.test.ts src/lib/leagues/challenge-route-view.test.ts src/lib/leagues/challenge-tab-counts.test.ts`  
Expected: PASS

- [ ] **Step 4: Run repository verification**

Run: `bun run typecheck`  
Expected: no TypeScript errors.

Run: `bun run check`  
Expected: no Ultracite violations.

Run: `git diff --check`  
Expected: no whitespace or patch-format issues.

- [ ] **Step 5: Do one manual navigation pass in the app**

Run: `bun run dev:client`  
Expected: Expo dev server starts and prints the dev-client URL.

Then verify in the running app:

- `/leagues/[leagueId]` shows only overview content plus route links
- ranking opens on its own screen
- challenges opens on its own screen
- tapping `Desafiar` from ranking opens the challenges screen with the create dialog target preselected
- requests is visible only for owner
- rules is accessible and shows the full read-only rules breakdown
