import { useValue } from "@legendapp/state/react";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Button, Menu, Tabs } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ScheduleCard } from "@/components/ui/schedule-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  SCHEDULE_PERIOD_META,
  SCHEDULE_WINDOW_OPTIONS,
  type SchedulePeriodKey,
  type ScheduleWindowDays,
} from "@/lib/leagues/schedule-view";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { formatEntrySideLabel } from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

const PERIOD_ORDER: SchedulePeriodKey[] = ["morning", "afternoon", "evening"];

type ScheduledMatchItem = {
  courtName: string;
  id: string;
  matchDate: string;
  sideAAvatarUrl: null | string;
  sideAFullName: string;
  sideBAvatarUrl: null | string;
  sideBFullName: string;
  startMinute: number;
};

export default function TournamentScheduleRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const tournament = useValue(bucket$.data.tournament);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);

  useEffect(() => {
    bucket$.actions.setActiveRoute("schedule");
  }, [bucket$]);

  const [windowDays, setWindowDays] = useState<ScheduleWindowDays>(7);

  const today = useMemo(() => new Date(), []);
  const dateTabs = useMemo(
    () => buildScheduleDateTabs({ today, windowDays }),
    [today, windowDays]
  );

  // Sempre começa em "Hoje" (primeira tab).
  const [activeDate, setActiveDate] = useState<string>(
    () => dateTabs[0]?.matchDate ?? ""
  );

  // Quando a janela muda, as tabs mudam; volta para "Hoje" de forma síncrona
  // antes de re-renderizar os novos Triggers (mesma proteção da agenda da
  // liga, molde schedule.tsx:52-60).
  useEffect(() => {
    if (dateTabs.length > 0) {
      setActiveDate(dateTabs[0].matchDate);
    }
  }, [dateTabs]);

  const scheduledItems = useMemo<ScheduledMatchItem[]>(() => {
    const withSides = buildMatchSides({ entriesById, matches });

    return withSides
      .filter(
        (match) =>
          match.matchDate !== null &&
          match.startMinute !== null &&
          match.courtId !== null
      )
      .map((match) => ({
        courtName:
          tournament?.courts.find((court) => court.id === match.courtId)
            ?.name ?? "",
        id: match.id,
        matchDate: match.matchDate ?? "",
        sideAAvatarUrl: match.entryA?.playerA?.avatarUrl ?? null,
        sideAFullName: formatEntrySideLabel(match.entryA),
        sideBAvatarUrl: match.entryB?.playerA?.avatarUrl ?? null,
        sideBFullName: formatEntrySideLabel(match.entryB),
        startMinute: match.startMinute ?? 0,
      }));
  }, [entriesById, matches, tournament?.courts]);

  const dayView = useMemo(
    () =>
      buildScheduleDayView({
        challenges: scheduledItems,
        matchDate: activeDate,
      }),
    [activeDate, scheduledItems]
  );

  const isError = bootstrapStatus === "error";
  const isLoading = bootstrapStatus !== "ready";
  const showStatusState = isError || isLoading;

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row items-center">
            <Page.Header.Left />
            <Page.Header.Center>
              <Page.Header.Title>Agenda</Page.Header.Title>
            </Page.Header.Center>
            <Page.Header.Right>
              <Menu>
                <Menu.Trigger asChild>
                  <Button className="w-20" size="sm" variant="tertiary">
                    <Button.Label>
                      {SCHEDULE_WINDOW_OPTIONS.find(
                        (item) => item.value === windowDays
                      )?.label ?? "7 dias"}
                    </Button.Label>
                  </Button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Overlay className="bg-backdrop" />
                  <Menu.Content presentation="popover" width={240}>
                    {SCHEDULE_WINDOW_OPTIONS.map((option) => (
                      <Menu.Item
                        key={option.value}
                        onPress={() => {
                          setWindowDays(option.value);
                        }}
                      >
                        <Menu.ItemTitle>{option.label}</Menu.ItemTitle>
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Portal>
              </Menu>
            </Page.Header.Right>
          </View>
          <Tabs
            onValueChange={(value) => {
              setActiveDate(value);
            }}
            value={activeDate}
          >
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                {dateTabs.map((tab) => (
                  <Tabs.Trigger key={tab.matchDate} value={tab.matchDate}>
                    <Tabs.Label>{tab.label}</Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.ScrollView>
            </Tabs.List>
          </Tabs>
        </View>
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName={cn(
          "grow gap-3 px-4 pb-floating-tab-bar-offset-4",
          showStatusState && "centered"
        )}
        showsVerticalScrollIndicator={false}
      >
        {isError && (
          <ErrorState message="Não foi possível carregar a agenda." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!showStatusState &&
          (PERIOD_ORDER.every((period) => dayView[period].length === 0) ? (
            <EmptyState
              description="Veja os jogos nos outros dias da agenda."
              title="Nenhum jogo neste dia"
            />
          ) : (
            PERIOD_ORDER.map((period) => {
              const items = dayView[period];
              if (items.length === 0) {
                return null;
              }
              return (
                <View className="gap-2" key={period}>
                  <Text color="muted" variant="description" weight="medium">
                    {SCHEDULE_PERIOD_META[period].label}
                  </Text>
                  <View className="gap-2">
                    {items.map((item) => (
                      <ScheduleCard
                        challengedAvatarUrl={item.sideBAvatarUrl}
                        challengedFullName={item.sideBFullName}
                        challengerAvatarUrl={item.sideAAvatarUrl}
                        challengerFullName={item.sideAFullName}
                        courtName={item.courtName}
                        key={item.id}
                        startMinute={item.startMinute}
                      />
                    ))}
                  </View>
                </View>
              );
            })
          ))}
      </Page.ScrollView>
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
