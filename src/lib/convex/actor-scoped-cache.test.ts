import type { ApiOutputs } from "@convex/shared/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "bun:test";

import {
  applyViewerContextToClientState,
  clearActorScopedClientState,
  isActorScopedQueryKey,
} from "./actor-scoped-cache";

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
      canManageOrganization: true,
    },
  };
}

describe("actor-scoped cache", () => {
  it("identifies cRPC queries that depend on the active actor", () => {
    expect(
      isActorScopedQueryKey([
        "convexQuery",
        "notification/feed:list",
        { limit: 20 },
      ])
    ).toBe(true);
    expect(isActorScopedQueryKey(["convexQuery", "viewer/context:get"])).toBe(
      false
    );
    expect(
      isActorScopedQueryKey(["other", "notification/feed:list", { limit: 20 }])
    ).toBe(false);
  });

  it("clears stale actor-scoped query data", () => {
    const queryClient = new QueryClient();
    const actorScopedKey = [
      "convexQuery",
      "notification/feed:list",
      { limit: 20 },
    ] as const;
    const viewerContextKey = ["convexQuery", "viewer/context:get"] as const;

    queryClient.setQueryData(actorScopedKey, { items: [] });
    queryClient.setQueryData<ViewerContext>(
      viewerContextKey,
      makeViewerContext()
    );

    clearActorScopedClientState(queryClient);

    expect(queryClient.getQueryData(actorScopedKey)).toBeUndefined();
    expect(queryClient.getQueryData<ViewerContext>(viewerContextKey)).toEqual(
      makeViewerContext()
    );
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
