import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Button, Select } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ScheduleCard } from "@/components/pages/leagues/schedule-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { SelectOptionItem } from "@/components/ui/select-option-item";
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    bucket$.actions.setActiveRoute("schedule");
  }, [bucket$]);

  const today = useMemo(() => new Date(), []);
  const dateTabs = useMemo(
    () => buildScheduleDateTabs({ today, windowDays }),
    [today, windowDays]
  );

  // Sempre começa em "Hoje". selectedDate só é null antes do primeiro render
  // das tabs; quando elas existem, cai para a primeira (Hoje).
  const activeDate = selectedDate ?? dateTabs[0]?.matchDate ?? null;

  const challenges = scheduleQuery.data ?? [];
  const dayView = useMemo(
    () =>
      activeDate
        ? buildScheduleDayView({ challenges, matchDate: activeDate })
        : null,
    [activeDate, challenges]
  );

  const isError = bootstrapStatus === "error" || scheduleQuery.isError;
  const isLoading =
    bootstrapStatus !== "ready" || !league || scheduleQuery.isPending;
  const showStatusState = isError || isLoading;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Agenda</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName={cn(
          "gap-3 px-4 pb-safe-offset-4",
          showStatusState && "centered"
        )}
      >
        {isError && (
          <ErrorState message="Não foi possível carregar a agenda." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && (
          <>
            <View className="flex-row items-center gap-2">
              <ScrollView
                contentContainerClassName="gap-2"
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {dateTabs.map((tab) => (
                  <Button
                    key={tab.matchDate}
                    onPress={() => {
                      setSelectedDate(tab.matchDate);
                    }}
                    size="sm"
                    variant={
                      activeDate === tab.matchDate ? "primary" : "secondary"
                    }
                  >
                    <Button.Label>{tab.label}</Button.Label>
                  </Button>
                ))}
              </ScrollView>
              <Select
                onValueChange={(nextValue) => {
                  if (nextValue && !Array.isArray(nextValue)) {
                    setWindowDays(
                      Number(nextValue.value) as ScheduleWindowDays
                    );
                    setSelectedDate(null);
                  }
                }}
                selectionMode="single"
                value={(() => {
                  const option = SCHEDULE_WINDOW_OPTIONS.find(
                    (item) => item.value === windowDays
                  );
                  return option
                    ? { label: option.label, value: String(option.value) }
                    : undefined;
                })()}
              >
                <Select.Trigger>
                  <Select.Value numberOfLines={1} placeholder="Janela" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover" width="trigger">
                    {SCHEDULE_WINDOW_OPTIONS.map((option) => (
                      <SelectOptionItem
                        key={option.value}
                        label={option.label}
                        value={String(option.value)}
                      />
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            {dayView &&
            PERIOD_ORDER.every((period) => dayView[period].length === 0) ? (
              <EmptyState
                description="Veja os jogos nos outros dias da agenda."
                title="Nenhum jogo neste dia"
              />
            ) : (
              dayView &&
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
            )}
          </>
        )}
      </Page.ScrollView>
    </Page>
  );
}
