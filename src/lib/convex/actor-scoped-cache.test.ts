import type { ApiOutputs } from "@convex/shared/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "bun:test";

import {
  applyViewerContextToClientState,
  clearActorScopedClientState,
  isActorScopedQueryKey,
} from "./actor-scoped-cache";
import {
  getLeagueDetailsBucket$,
  resetLeagueDetailsStore,
} from "@/lib/leagues/league-details-store";

type ViewerContext = ApiOutputs["viewer"]["context"]["get"];

function makeViewerContext(): ViewerContext {
  return {
    activeActor: {
      displayName: "Organizacao Bruno",
      id: "org-1",
      kind: "organization",
      role: "owner",
    },
    availableActors: [
      {
        displayName: "Bruno",
        id: "player-1",
        kind: "player",
      },
      {
        displayName: "Organizacao Bruno",
        id: "org-1",
        kind: "organization",
        role: "owner",
      },
    ],
    capabilities: {
      canBrowseLeagues: true,
      canCreateLeague: true,
      canJoinLeagues: false,
      canManageLeagues: true,
    },
  };
}

describe("actor-scoped cache", () => {
  it("identifies cRPC queries that depend on the active actor", () => {
    expect(
      isActorScopedQueryKey([
        "convexQuery",
        "league/discovery:getById",
        { leagueId: "league-1" },
      ])
    ).toBe(true);
    expect(isActorScopedQueryKey(["convexQuery", "viewer/context:get"])).toBe(
      false
    );
    expect(
      isActorScopedQueryKey([
        "other",
        "league/discovery:getById",
        { leagueId: "league-1" },
      ])
    ).toBe(false);
  });

  it("clears stale league query data and league buckets", () => {
    const queryClient = new QueryClient();
    const leagueDetailKey = [
      "convexQuery",
      "league/discovery:getById",
      { leagueId: "league-1" },
    ] as const;
    const viewerContextKey = ["convexQuery", "viewer/context:get"] as const;
    const leagueBucketId = "actor-cache-league";
    const bucket$ = getLeagueDetailsBucket$(leagueBucketId);

    bucket$.actions.setActiveRoute("rules");
    queryClient.setQueryData(leagueDetailKey, { isLeagueOrganizer: false });
    queryClient.setQueryData<ViewerContext>(
      viewerContextKey,
      makeViewerContext()
    );

    clearActorScopedClientState(queryClient);

    expect(queryClient.getQueryData(leagueDetailKey)).toBeUndefined();
    expect(queryClient.getQueryData<ViewerContext>(viewerContextKey)).toEqual(
      makeViewerContext()
    );
    expect(
      String(getLeagueDetailsBucket$(leagueBucketId).identity.activeRoute)
    ).toBe("overview");

    resetLeagueDetailsStore();
  });

  it("applies the fresh viewer context before clearing actor-scoped data", () => {
    const queryClient = new QueryClient();
    const viewerContext = makeViewerContext();
    const viewerContextKey = ["convexQuery", "viewer/context:get"] as const;

    queryClient.setQueryData(viewerContextKey, {
      activeActor: {
        displayName: "Bruno",
        id: "player-1",
        kind: "player",
      },
    });

    applyViewerContextToClientState({
      queryClient,
      viewerContext,
      viewerContextFilter: { queryKey: viewerContextKey },
    });

    expect(queryClient.getQueryData<ViewerContext>(viewerContextKey)).toEqual(
      viewerContext
    );
  });
});
