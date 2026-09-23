import { useValue } from "@legendapp/state/react";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Button, Menu, Tabs } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { MatchCard } from "@/components/ui/match-card";
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
import {
  buildScheduledMatchItems,
  type ScheduledMatchItem,
} from "@/lib/tournaments/schedule-items";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

const PERIOD_ORDER: SchedulePeriodKey[] = ["morning", "afternoon", "evening"];

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

  const [activeDate, setActiveDate] = useState<string>(
    () => dateTabs[0]?.matchDate ?? ""
  );

  // A janela muda → tabs mudam: volta para "Hoje" de forma síncrona antes dos
  // Triggers novos — senão o Tabs controlado recebe uma lista de triggers com
  // um value possivelmente inconsistente (leagues/[leagueId]/schedule.tsx).
  useEffect(() => {
    if (dateTabs.length > 0) {
      setActiveDate(dateTabs[0].matchDate);
    }
  }, [dateTabs]);

  const scheduledItems = useMemo<ScheduledMatchItem[]>(
    () =>
      buildScheduledMatchItems({
        courts: tournament?.courts ?? [],
        entriesById,
        matches,
      }),
    [entriesById, matches, tournament?.courts]
  );

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
                      <MatchCard
                        challengedAvatarUrl={item.sideBAvatarUrl}
                        challengedName={item.sideBName}
                        challengedPartnerAvatarUrl={item.sideBPartnerAvatarUrl}
                        challengedPartnerName={item.sideBPartnerName}
                        challengerAvatarUrl={item.sideAAvatarUrl}
                        challengerName={item.sideAName}
                        challengerPartnerAvatarUrl={item.sideAPartnerAvatarUrl}
                        challengerPartnerName={item.sideAPartnerName}
                        courtName={item.courtName}
                        key={item.id}
                        matchDate={item.matchDate}
                        matchStatus={item.matchStatus}
                        scoreSets={item.scoreSets}
                        stageLabel={item.stageLabel}
                        startMinute={item.startMinute}
                        walkoverWinner={item.walkoverWinner}
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
