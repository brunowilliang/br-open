import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Button, Menu, Tabs } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ScheduleCard } from "@/components/pages/leagues/schedule-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  SCHEDULE_PERIOD_META,
  SCHEDULE_WINDOW_OPTIONS,
  type SchedulePeriodKey,
  type ScheduleWindowDays,
} from "@/lib/leagues/schedule-view";

const PERIOD_ORDER: SchedulePeriodKey[] = ["morning", "afternoon", "evening"];

export default function LeagueScheduleRoute() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const league = useValue(bucket$.data.league);

  const scheduleQuery = useQuery({
    ...crpc.league.challenges.listScheduled.queryOptions({ leagueId }),
  });

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
  // antes de re-renderizar os novos Triggers, evitando que o Tabs controlado
  // receba uma lista de triggers diferente com um value possivelmente
  // inconsistente entre renders.
  useEffect(() => {
    if (dateTabs.length > 0) {
      setActiveDate(dateTabs[0].matchDate);
    }
  }, [dateTabs]);

  useEffect(() => {
    bucket$.actions.setActiveRoute("schedule");
  }, [bucket$]);

  const challenges = scheduleQuery.data ?? [];
  const dayView = useMemo(
    () => buildScheduleDayView({ challenges, matchDate: activeDate }),
    [activeDate, challenges]
  );

  const isError = bootstrapStatus === "error" || scheduleQuery.isError;
  const isLoading =
    bootstrapStatus !== "ready" || !league || scheduleQuery.isPending;
  const showStatusState = isError || isLoading;

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row items-center">
            <Page.Header.Left>
              <Page.Header.BackButton />
            </Page.Header.Left>
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
                  <Menu.Content presentation="popover">
                    {SCHEDULE_WINDOW_OPTIONS.map((option) => (
                      <Menu.Item
                        key={option.value}
                        onPress={() => {
                          setWindowDays(option.value);
                        }}
                      >
                        <Menu.ItemTitle className="flex-none">
                          {option.label}
                        </Menu.ItemTitle>
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
        {!(isError || isLoading) &&
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
                        challengedAvatarUrl={item.challenged.avatarUrl}
                        challengedFullName={item.challenged.fullName}
                        challengerAvatarUrl={item.challenger.avatarUrl}
                        challengerFullName={item.challenger.fullName}
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
