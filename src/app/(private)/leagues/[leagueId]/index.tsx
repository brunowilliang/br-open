import type { ApiOutputs } from "@convex/shared/api";
import {
  BookOpenCheckIcon,
  Calendar03Icon,
  Edit02Icon,
  Location06Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, Menu } from "heroui-native";
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { usePageContext } from "@/components/core/NewPage/context";
import { Text } from "@/components/core/text";
import { GuestOverview } from "@/components/pages/leagues/guest-overview";
import { LeagueJoinFooter } from "@/components/pages/leagues/league-join-footer";
import { OrganizerOverview } from "@/components/pages/leagues/organizer-overview";
import { PlayerOverview } from "@/components/pages/leagues/player-overview";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { formatLeagueMeta } from "@/lib/leagues/presentation";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

/**
 * Stretch banner. Reads the page scroll offset (a SharedValue
 * updated on the UI thread by PageKeyboardAwareScrollView) and reacts without
 * touching the JS thread.
 *
 * - Normal scroll up (scrollY >= 0): no transform applied — the banner
 *   scrolls away with the content, driven by the scrollview itself.
 * - Pull down at top / overscroll (scrollY < 0): scales up to 2x and
 *   translates up → "stretch to zoom" refresh effect.
 */
function LeagueBanner(props: { league: LeagueOverview }) {
  const { league } = props;
  const context = usePageContext();
  const bannerHeight = useSharedValue(0);
  const [overlayHeight, setOverlayHeight] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    bannerHeight.value = event.nativeEvent.layout.height;
  };

  const handleOverlayLayout = (event: LayoutChangeEvent) => {
    setOverlayHeight(event.nativeEvent.layout.height);
  };

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    const height = bannerHeight.value;

    if (height === 0) {
      return {};
    }

    const scrollY = context.scrollY.value;

    // Natural scroll: return identity so the banner follows the scrollview's
    // own movement. Any positive translateY here would push it back down and
    // let the content scroll over it.
    if (scrollY >= 0) {
      return {};
    }

    return {
      transform: [
        {
          translateY: interpolate(
            scrollY,
            [-height, 0],
            [-height / 2, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            scrollY,
            [-height, 0],
            [2, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <>
      <Animated.View
        className="h-90"
        onLayout={handleLayout}
        style={bannerAnimatedStyle}
      >
        <Image
          className="absolute h-full w-full"
          contentFit="cover"
          fallback="blue"
          source={league.coverUrl ?? undefined}
          transition={250}
        />
        <View className="absolute h-full w-full bg-linear-to-t from-0 from-background" />
      </Animated.View>

      <View
        className="flex-row items-center gap-2 px-4"
        onLayout={handleOverlayLayout}
        style={{ marginTop: -overlayHeight }}
      >
        <Image
          className="size-28 rounded-3xl border-2 border-white/80 bg-surface"
          fallback="green"
          source={league.avatarUrl ?? undefined}
        />
        <View className="flex-1 gap-1.5">
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>Liga</Chip.Label>
          </Chip>
          <Text numberOfLines={2} variant="title">
            {league.name}
          </Text>
          <Chip color="accent" size="sm" variant="soft">
            <HugeIcons className="size-3 text-accent" icon={Location06Icon} />
            <Chip.Label>
              {formatLeagueMeta(league.city, league.state)}
            </Chip.Label>
          </Chip>
        </View>
      </View>
    </>
  );
}

export default function LeagueOverviewRoute() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManageLeague = useValue(bucket$.derived.canManageLeague);
  const league = useValue(bucket$.data.league);
  const role = useValue(bucket$.viewer.role);

  const isError = bootstrapStatus === "error";
  const isLoading = !league;
  const showStatusState = isError || isLoading;
  const canOpenLeagueMenu =
    access.canOpenRules || access.canOpenSchedule || canManageLeague;

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton variant="secondary" />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right>
          {league && canOpenLeagueMenu ? (
            <Menu>
              <Menu.Trigger asChild>
                <Button isIconOnly size="sm" variant="secondary">
                  <HugeIcons icon={MoreVerticalIcon} />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Overlay className="bg-backdrop" />
                <Menu.Content presentation="popover" width={240}>
                  {access.canOpenRules ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/rules",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Regras</Menu.ItemTitle>
                      <HugeIcons icon={BookOpenCheckIcon} />
                    </Menu.Item>
                  ) : null}
                  {access.canOpenSchedule ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/schedule",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Agenda</Menu.ItemTitle>
                      <HugeIcons icon={Calendar03Icon} />
                    </Menu.Item>
                  ) : null}
                  {canManageLeague ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId, mode: "edit" },
                          pathname: "/settings/leagues/[mode]",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Editar</Menu.ItemTitle>
                      <HugeIcons icon={Edit02Icon} />
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu>
          ) : null}
        </Page.Header.Right>
      </Page.Header>
      <Page.ScrollView
        contentContainerClassName={cn(
          "grow",
          showStatusState && "centered gap-4 px-4"
        )}
      >
        {isError && <ErrorState message="Não foi possível carregar a liga." />}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && league && (
          <>
            <LeagueBanner league={league} />
            <View className="gap-4 px-4 pt-4 pb-floating-tab-bar-4">
              {role === "organizer" && <OrganizerOverview />}
              {role === "player" && <PlayerOverview league={league} />}
              {role === "guest" && <GuestOverview league={league} />}
            </View>
          </>
        )}
      </Page.ScrollView>

      {role === "guest" && league && <LeagueJoinFooter leagueId={leagueId} />}
    </Page>
  );
}
