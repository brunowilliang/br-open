import type {
  QueryClient,
  QueryFilters,
  QueryKey,
} from "@tanstack/react-query";

import type { ApiOutputs } from "@convex/shared/api";

type ViewerContext = ApiOutputs["viewer"]["context"]["get"];

const ACTOR_SCOPED_QUERY_NAMES: Record<string, true> = {
  "notification/feed:list": true,
  "notification/settings:status": true,
};

export function isActorScopedQueryKey(queryKey: QueryKey) {
  return (
    queryKey[0] === "convexQuery" &&
    typeof queryKey[1] === "string" &&
    Object.hasOwn(ACTOR_SCOPED_QUERY_NAMES, queryKey[1])
  );
}

export function clearActorScopedClientState(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => isActorScopedQueryKey(query.queryKey),
  });
}

export function applyViewerContextToClientState(input: {
  queryClient: QueryClient;
  viewerContext: ViewerContext;
  viewerContextFilter: QueryFilters;
}) {
  input.queryClient.setQueriesData(
    input.viewerContextFilter,
    input.viewerContext
  );
  clearActorScopedClientState(input.queryClient);
}
