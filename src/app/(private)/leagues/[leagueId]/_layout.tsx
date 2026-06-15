import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { Stack, useGlobalSearchParams } from "expo-router";
import { useEffect } from "react";

import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueDetailsLayout() {
  const { leagueId: rawLeagueId } = useGlobalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <LeagueDetailsStack />;
  }

  return <LeagueDetailsLayoutContent leagueId={leagueId} />;
}

function LeagueDetailsLayoutContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const resetVersion = useValue(bucket$.identity.resetVersion);

  const viewerQuery = useQuery(crpc.viewer.context.get.queryOptions());
  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId,
    }),
  });

  useEffect(() => {
    bucket$.actions.reset();
    bucket$.actions.bootstrap();
  }, [bucket$]);

  useEffect(() => {
    if (resetVersion === 0 || !(leagueQuery.data && viewerQuery.data)) {
      return;
    }

    bucket$.actions.hydrateOverview({
      canJoinLeagues: viewerQuery.data.capabilities?.canJoinLeagues === true,
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
  }, [bucket$, leagueQuery.data, resetVersion, viewerQuery.data]);

  useEffect(() => {
    if (!(leagueQuery.isError || viewerQuery.isError)) {
      return;
    }

    bucket$.actions.setBootstrapStatus("error");
  }, [bucket$, leagueQuery.isError, viewerQuery.isError]);

  return <LeagueDetailsStack />;
}

function LeagueDetailsStack() {
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
