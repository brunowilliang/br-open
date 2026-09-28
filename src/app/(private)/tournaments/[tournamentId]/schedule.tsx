import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Button, Dialog, Menu, Tabs, useToast } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  CalendarBlock01Icon,
  Cancel01Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { AgreementMatchCard } from "@/components/pages/tournaments/agreement-match-card";
import {
  buildOrganizerMatchActionRequest,
  useOrganizerActions,
  useTournamentContextInvalidation,
} from "@/components/pages/tournaments/organizer-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  buildScheduleWindowTabs,
  SCHEDULE_PERIOD_META,
  SCHEDULE_WINDOW_OPTIONS,
  type ScheduleDateTab,
  type SchedulePeriodKey,
  type ScheduleWindowDays,
} from "@/lib/scheduling/schedule-view";
import {
  buildScheduledMatchItems,
  type ScheduledMatchItem,
} from "@/lib/tournaments/schedule-items";
import {
  bindOrganizerMatchMenu,
  buildOrganizerMatchMenu,
  type OrganizerMatchMenuEntry,
} from "@/lib/tournaments/organizer-match-menu";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import { WidgetAlert } from "@/components/ui/widget-alert";
import {
  buildUnavailabilityChipLabel,
  selectVisibleUnavailabilityBlocks,
} from "@/lib/tournaments/unavailability-derived";
import type { TournamentUnavailabilityView } from "@convex/domains/tournament/contract";
import {
  brazilDayKey,
  resolveTournamentWindow,
} from "@convex/domains/tournament/window-rules";

const PERIOD_ORDER: SchedulePeriodKey[] = ["morning", "afternoon", "evening"];

export default function TournamentScheduleRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const { run } = useOrganizerActions();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const tournament = useValue(bucket$.data.tournament);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const access = useValue(bucket$.derived.access);
  const tournamentPendings = useValue(bucket$.derived.pendings);
  const shouldFetchMatches = useValue(bucket$.derived.shouldFetchMatches);

  useEffect(() => {
    bucket$.actions.setActiveRoute("schedule");
  }, [bucket$]);

  const isOrganizer = access?.canManage ?? false;
  // Encerrado ou cancelado não aceita mais ação de partida no servidor: o card
  // nasce sem menu, como no nó da chave.
  const tournamentStatus = tournament?.status ?? "";
  const isTournamentClosed =
    tournamentStatus === "finished" || tournamentStatus === "cancelled";
  // A pendência de CONCLUIR é a que arma o item da final no menu.
  const isConclusionPending = tournamentPendings.some(
    (item) => item.kind === "organization_tournament_awaiting_conclusion"
  );

  // Torneio SEM fim mantém o seletor de 7/15 dias e as tabs a partir de hoje.
  const [legacyWindowDays, setLegacyWindowDays] =
    useState<ScheduleWindowDays>(7);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [blockToReopen, setBlockToReopen] =
    useState<null | TournamentUnavailabilityView>(null);

  const today = useMemo(() => new Date(), []);
  const scheduleWindow = useMemo(
    () =>
      tournament
        ? resolveTournamentWindow({
            endDateMs: tournament.endDate,
            startDateMs: tournament.startDate,
          })
        : null,
    [tournament]
  );

  const scheduledItems = useMemo<ScheduledMatchItem[]>(
    () =>
      buildScheduledMatchItems({
        courts: tournament?.courts ?? [],
        entriesById,
        matches,
      }),
    [entriesById, matches, tournament?.courts]
  );

  const dateTabs = useMemo<ScheduleDateTab[]>(() => {
    if (scheduleWindow?.endDayKey) {
      return buildScheduleWindowTabs({
        endDayKey: scheduleWindow.endDayKey,
        // Dia com jogo fora da janela (torneio que ganhou Fim depois) continua
        // visível: nenhum confronto pode sumir da agenda.
        extraDayKeys: scheduledItems.map((item) => item.matchDate),
        startDayKey: scheduleWindow.startDayKey,
        todayDayKey: brazilDayKey(Date.now()),
      });
    }

    return buildScheduleDateTabs({ today, windowDays: legacyWindowDays });
  }, [legacyWindowDays, scheduleWindow, scheduledItems, today]);

  const [activeDate, setActiveDate] = useState<string>(
    () => dateTabs[0]?.matchDate ?? ""
  );
  // O Tabs controlado nunca pode receber um value fora dos triggers: um dia que
  // saiu da lista cai no primeiro ANTES do render, não depois pelo efeito.
  const activeTabValue = dateTabs.some((tab) => tab.matchDate === activeDate)
    ? activeDate
    : (dateTabs[0]?.matchDate ?? "");

  useEffect(() => {
    if (activeTabValue !== activeDate) {
      setActiveDate(activeTabValue);
    }
  }, [activeDate, activeTabValue]);

  const dayView = useMemo(
    () =>
      buildScheduleDayView({
        challenges: scheduledItems,
        matchDate: activeTabValue,
      }),
    [activeTabValue, scheduledItems]
  );

  // A seleção vive no DIA aberto: trocar de dia (ou o confronto sair da agenda,
  // ex.: cancelado) desarma o modo seleção — nunca cancelar jogo que não está
  // mais à vista.
  useEffect(() => {
    setSelectedMatchIds((current) => {
      const next = current.filter((id) =>
        scheduledItems.some(
          (item) => item.id === id && item.matchDate === activeTabValue
        )
      );

      return next.length === current.length ? current : next;
    });
  }, [activeTabValue, scheduledItems]);

  const unavailabilityQuery = useQuery({
    ...crpc.tournament.unavailability.list.staticQueryOptions({ tournamentId }),
    // Mesmo gate da leitura das partidas: prévia privada não pede a agenda.
    enabled: shouldFetchMatches,
  });
  const activeDayBlocks = useMemo(
    () =>
      selectVisibleUnavailabilityBlocks(
        (unavailabilityQuery.data ?? []).filter(
          (block) => block.date === activeTabValue
        )
      ),
    [activeTabValue, unavailabilityQuery.data]
  );

  const reopenPeriod = useMutation({
    mutationFn: crpcClient.tournament.unavailability.remove.mutate,
    mutationKey: crpc.tournament.unavailability.remove.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível reabrir a agenda. Tente novamente."
        ),
        id: "tournament-reopen-error",
        label: "Falha ao reabrir",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setBlockToReopen(null);
      toast.show({
        description: "O período voltou a aceitar agendamento.",
        id: "tournament-reopen-success",
        label: "Agenda reaberta",
        variant: "success",
      });
    },
  });

  const isSelecting = selectedMatchIds.length > 0;

  // UMA fonte do menu do organizador (o mesmo builder do chaveamento): o card
  // desenha o que o papel decide, nunca a tela.
  const organizerMenus = useMemo(() => {
    if (!isOrganizer) {
      return {} as Record<string, OrganizerMatchMenuEntry[]>;
    }

    return Object.fromEntries(
      scheduledItems.map((item) => [
        item.id,
        buildOrganizerMatchMenu({
          canReserveSlot: item.canReserveSlot,
          isConclusionPending,
          isFinal: item.isFinal,
          isTournamentClosed,
          matchDate: item.matchDate,
          matchStatus: item.matchStatus,
          sidesDefined: item.entryAId !== null && item.entryBId !== null,
        }),
      ])
    );
  }, [isConclusionPending, isOrganizer, isTournamentClosed, scheduledItems]);

  function toggleSelection(matchId: string) {
    setSelectedMatchIds((current) =>
      current.includes(matchId)
        ? current.filter((id) => id !== matchId)
        : [...current, matchId]
    );
  }

  // Só confronto com o "Cancelar jogo" no menu entra na seleção: o decidido não
  // tem o que tirar.
  function canCancelMatch(item: ScheduledMatchItem) {
    return (organizerMenus[item.id] ?? []).some(
      (entry) => entry.kind === "cancel_matches"
    );
  }

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
              <View className="flex-row items-center gap-1">
                {scheduleWindow?.endDayKey ? null : (
                  <Menu>
                    <Menu.Trigger asChild>
                      <Button className="w-20" size="sm" variant="tertiary">
                        <Button.Label>
                          {SCHEDULE_WINDOW_OPTIONS.find(
                            (item) => item.value === legacyWindowDays
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
                              setLegacyWindowDays(option.value);
                            }}
                          >
                            <Menu.ItemTitle>{option.label}</Menu.ItemTitle>
                          </Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu>
                )}
                {isOrganizer && !isTournamentClosed ? (
                  <Menu>
                    <Menu.Trigger asChild>
                      <Button isIconOnly size="sm" variant="tertiary">
                        <HugeIcons
                          className="size-4.5"
                          icon={MoreVerticalIcon}
                        />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Overlay className="bg-backdrop" />
                      <Menu.Content presentation="popover" width={240}>
                        <Menu.Item
                          onPress={() => {
                            run({
                              action: "block_court",
                              initialDate: activeTabValue,
                            });
                          }}
                        >
                          <Menu.ItemTitle>Fechar quadra</Menu.ItemTitle>
                          <HugeIcons
                            className="size-4.5"
                            icon={CalendarBlock01Icon}
                          />
                        </Menu.Item>
                        {/* O MESMO cancelamento em lote do topo: aqui ele vive
                              habilitado só com jogo marcado. */}
                        <Menu.Item
                          isDisabled={selectedMatchIds.length === 0}
                          onPress={() => {
                            run({
                              action: "cancel_matches",
                              matchIds: selectedMatchIds,
                            });
                          }}
                        >
                          <Menu.ItemTitle
                            className={
                              selectedMatchIds.length === 0
                                ? undefined
                                : "text-danger"
                            }
                          >
                            Cancelar jogos
                          </Menu.ItemTitle>
                          <HugeIcons
                            className={
                              selectedMatchIds.length === 0
                                ? "size-4.5"
                                : "size-4.5 text-danger"
                            }
                            icon={Cancel01Icon}
                          />
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu>
                ) : null}
              </View>
            </Page.Header.Right>
          </View>
          <Tabs
            onValueChange={(value) => {
              setActiveDate(value);
            }}
            value={activeTabValue}
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
        {showStatusState ? null : (
          // Toque em área vazia desarma a seleção; o ⋮ (fora daqui) não limpa.
          <Pressable
            className="grow gap-3"
            disabled={!isSelecting}
            onPress={() => {
              setSelectedMatchIds([]);
            }}
          >
            {activeDayBlocks.length > 0 ? (
              <View className="gap-2">
                {activeDayBlocks.map((block) => {
                  const label = buildUnavailabilityChipLabel(block);

                  return (
                    <WidgetAlert
                      action={
                        isOrganizer
                          ? {
                              isDisabled: reopenPeriod.isPending,
                              label: "Reabrir",
                              onPress: () => {
                                setBlockToReopen(block);
                              },
                            }
                          : undefined
                      }
                      description={label}
                      key={block.id}
                      status="warning"
                      title="Período fechado"
                    />
                  );
                })}
              </View>
            ) : null}
            {PERIOD_ORDER.every((period) => dayView[period].length === 0) ? (
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
                      {items.map((item) => {
                        const menuEntries = organizerMenus[item.id] ?? [];
                        const canCancel = canCancelMatch(item);

                        return (
                          <AgreementMatchCard
                            challengedAvatarUrl={item.sideBAvatarUrl}
                            challengedName={item.sideBName}
                            challengedPartnerAvatarUrl={
                              item.sideBPartnerAvatarUrl
                            }
                            challengedPartnerName={item.sideBPartnerName}
                            challengerAvatarUrl={item.sideAAvatarUrl}
                            challengerName={item.sideAName}
                            challengerPartnerAvatarUrl={
                              item.sideAPartnerAvatarUrl
                            }
                            challengerPartnerName={item.sideAPartnerName}
                            courtName={item.courtName}
                            isSelected={selectedMatchIds.includes(item.id)}
                            key={item.id}
                            matchDate={item.matchDate}
                            matchId={item.id}
                            matchStatus={item.matchStatus}
                            menu={bindOrganizerMatchMenu({
                              entries: menuEntries,
                              onAction: (kind) => {
                                run(
                                  buildOrganizerMatchActionRequest({
                                    kind,
                                    matchId: item.id,
                                  })
                                );
                              },
                            })}
                            onCardLongPress={
                              canCancel
                                ? () => {
                                    setSelectedMatchIds([item.id]);
                                  }
                                : undefined
                            }
                            onCardPress={
                              isSelecting && canCancel
                                ? () => {
                                    toggleSelection(item.id);
                                  }
                                : undefined
                            }
                            scoreSets={item.scoreSets}
                            sideOrder="match"
                            stageLabel={item.stageLabel}
                            startMinute={item.startMinute}
                            tournamentId={tournamentId}
                            walkoverWinner={item.walkoverWinner}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </Pressable>
        )}
      </Page.ScrollView>
      <Dialog
        isOpen={blockToReopen !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setBlockToReopen(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Reabrir a agenda</Dialog.Title>
            <Text color="muted" variant="description">
              {blockToReopen
                ? `O período volta a aceitar agendamento: ${buildUnavailabilityChipLabel(blockToReopen)}.`
                : ""}
            </Text>
            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={reopenPeriod.isPending}
                onPress={() => {
                  setBlockToReopen(null);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={reopenPeriod.isPending}
                onPress={() => {
                  if (blockToReopen) {
                    reopenPeriod.mutate({
                      unavailabilityId: blockToReopen.id,
                    });
                  }
                }}
                size="sm"
              >
                <Button.Label>Reabrir</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
