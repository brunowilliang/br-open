import type {
  QueryClient,
  QueryFilters,
  QueryKey,
} from "@tanstack/react-query";

import type { ApiOutputs } from "@convex/shared/api";
import { resetLeagueDetailsStore } from "@/lib/leagues/league-details-store";

type ViewerContext = ApiOutputs["viewer"]["context"]["get"];

const ACTOR_SCOPED_QUERY_NAMES = new Set([
  "league/challenges:listForLeague",
  "league/challenges:listOccupiedSlots",
  "league/discovery:getById",
  "league/discovery:listAvailable",
  "league/discovery:listParticipating",
  "league/management:getById",
  "league/management:listMine",
  "league/membership:getOverview",
  "notification/feed:list",
  "notification/settings:status",
]);

export function isActorScopedQueryKey(queryKey: QueryKey) {
  return (
    queryKey[0] === "convexQuery" &&
    typeof queryKey[1] === "string" &&
    ACTOR_SCOPED_QUERY_NAMES.has(queryKey[1])
  );
}

export function clearActorScopedClientState(queryClient: QueryClient) {
  resetLeagueDetailsStore();

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
