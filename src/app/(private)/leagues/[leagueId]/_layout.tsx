import {
  Home01Icon,
  RankingIcon,
  Target02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useGlobalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";

import {
  FloatingTabBar,
  type FloatingTabBarItem,
} from "@/components/navigation/floating-tab-bar";
import { useCRPC } from "@/lib/convex/crpc";
import { shouldFetchLeagueDetailsMembershipOverview } from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildLeagueNavigationTabItems,
  type LeagueNavigationTabValue,
} from "@/lib/leagues/league-navigation-tabs";

const LEAGUE_TAB_ICONS = {
  challenges: Target02Icon,
  overview: Home01Icon,
  ranking: RankingIcon,
  requests: UserMultipleIcon,
} satisfies Record<LeagueNavigationTabValue, FloatingTabBarItem["icon"]>;

const LEAGUE_TAB_ROUTE_NAMES = {
  challenges: "challenges",
  overview: "index",
  ranking: "ranking",
  requests: "requests",
} satisfies Record<LeagueNavigationTabValue, string>;

const LEAGUE_DETAIL_SCREEN_NAMES = [
  "index",
  "ranking",
  "challenges",
  "requests",
  "rules",
  "schedule",
] as const;

export default function LeagueDetailsLayout() {
  const { leagueId: rawLeagueId } = useGlobalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <LeagueDetailsTabs />;
  }

  return <LeagueDetailsLayoutContent leagueId={leagueId} />;
}

function LeagueDetailsLayoutContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const resetVersion = useValue(bucket$.identity.resetVersion);

  const viewerQuery = useQuery(crpc.viewer.context.get.queryOptions());
  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId,
    }),
  });
  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: shouldFetchLeagueDetailsMembershipOverview(access),
  });
  const challengesQuery = useQuery({
    ...crpc.league.challenges.listForLeague.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
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
    if (membershipOverviewQuery.data) {
      bucket$.actions.hydrateMembershipOverview(membershipOverviewQuery.data);
    }
  }, [bucket$, membershipOverviewQuery.data]);

  useEffect(() => {
    if (challengesQuery.data) {
      bucket$.actions.hydrateChallenges(challengesQuery.data);
    }
  }, [bucket$, challengesQuery.data]);

  useEffect(() => {
    if (!(leagueQuery.isError || viewerQuery.isError)) {
      return;
    }

    bucket$.actions.setBootstrapStatus("error");
  }, [bucket$, leagueQuery.isError, viewerQuery.isError]);

  return <LeagueDetailsTabs leagueId={leagueId} />;
}

function LeagueDetailsTabs(props: { leagueId?: string }) {
  const backgroundColor = useThemeColor("background");

  if (props.leagueId) {
    return (
      <LeagueDetailsTabsWithFloatingTabBar
        backgroundColor={backgroundColor}
        leagueId={props.leagueId}
      />
    );
  }

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}
      tabBar={() => null}
    >
      {LEAGUE_DETAIL_SCREEN_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

function LeagueDetailsTabsWithFloatingTabBar(props: {
  backgroundColor: string;
  leagueId: string;
}) {
  const bucket$ = getLeagueDetailsBucket$(props.leagueId);
  const access = useValue(bucket$.derived.access);
  const menuActionCounts = useValue(bucket$.derived.menuActionCounts);
  const tabItems = buildLeagueNavigationTabItems({
    access,
    challengeActionCount: menuActionCounts.challenges,
    requestActionCount: menuActionCounts.requests,
  });
  const items = tabItems.map((item) => ({
    ...item,
    icon: LEAGUE_TAB_ICONS[item.value],
  }));

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor: props.backgroundColor },
      }}
      tabBar={(tabBarProps) => (
        <FloatingTabBar
          {...tabBarProps}
          getNavigationParams={(input) => ({
            ...input.routeParams,
            leagueId: props.leagueId,
          })}
          items={items}
          resolveValueFromRouteName={resolveLeagueTabValueFromRouteName}
          routeNames={LEAGUE_TAB_ROUTE_NAMES}
        />
      )}
    >
      {LEAGUE_DETAIL_SCREEN_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

function resolveLeagueTabValueFromRouteName(
  routeName: string
): LeagueNavigationTabValue | null {
  switch (routeName) {
    case "challenges":
      return "challenges";
    case "index":
      return "overview";
    case "ranking":
      return "ranking";
    case "requests":
      return "requests";
    default:
      return null;
  }
}
