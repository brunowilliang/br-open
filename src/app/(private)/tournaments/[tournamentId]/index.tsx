import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar03Icon,
  Cancel01Icon,
  ClipboardIcon,
  Edit02Icon,
  Location06Icon,
  MoreVerticalIcon,
  PlayIcon,
  UserMultipleIcon,
  VolleyballIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Dialog,
  Menu,
  Surface,
  useToast,
} from "heroui-native";
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
import { GuestOverview } from "@/components/pages/tournaments/guest-overview";
import { OrganizerOverview } from "@/components/pages/tournaments/organizer-overview";
import { PlayerOverview } from "@/components/pages/tournaments/player-overview";
import { TournamentJoinSheet } from "@/components/pages/tournaments/tournament-join-sheet";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatLeagueMeta } from "@/lib/leagues/presentation";
import {
  buildRegistrationWindowState,
  buildStartWarnings,
  buildTournamentActiveEntriesCountByCategory,
  buildTournamentCategoryVacancy,
  buildTournamentJoinOptions,
  formatEntryFeeLabel,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

const SOURCE_TYPE_TOURNAMENT_ENTRY = "tournament_entry";

export default function TournamentOverviewRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const access = useValue(bucket$.derived.access);
  const role = useValue(bucket$.derived.role);
  const tournament = useValue(bucket$.data.tournament);
  const entries = useValue(bucket$.data.entries);
  const matches = useValue(bucket$.data.matches);

  async function invalidateTournamentContext() {
    await queryClient.invalidateQueries(
      crpc.tournament.discovery.getById.queryFilter({ tournamentId })
    );
  }

  const respondPartnerInvite = useMutation({
    mutationFn: crpcClient.tournament.entries.respondPartnerInvite.mutate,
    mutationKey: crpc.tournament.entries.respondPartnerInvite.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível responder ao convite. Tente novamente."
        ),
        id: "respond-partner-error",
        label: "Falha ao responder convite",
        variant: "danger",
      });
    },
    onSuccess: async (_entry, variables) => {
      await invalidateTournamentContext();
      toast.show({
        description: variables.accept
          ? "Convite aceito, a dupla está fechada."
          : "Convite recusado.",
        id: "respond-partner-success",
        label: variables.accept ? "Convite aceito" : "Convite recusado",
        variant: "success",
      });
    },
  });

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível gerar o PIX. Tente novamente."
        ),
        id: "tournament-charge-error",
        label: "Falha ao gerar PIX",
        variant: "danger",
      });
    },
    onSuccess: (result) => {
      router.navigate({
        params: { chargeId: result.chargeId },
        pathname: "/checkout/[chargeId]",
      });
    },
  });

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
  const [cancelEntryTarget, setCancelEntryTarget] = useState<null | {
    categoryName: string;
    entryId: string;
  }>(null);

  const publishTournament = useMutation({
    mutationFn: crpcClient.tournament.management.publish.mutate,
    mutationKey: crpc.tournament.management.publish.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível publicar o torneio. Tente novamente."
        ),
        id: "publish-tournament-error",
        label: "Falha ao publicar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "O torneio está aberto para inscrições.",
        id: "publish-tournament-success",
        label: "Torneio publicado",
        variant: "success",
      });
    },
  });

  const cancelTournament = useMutation({
    mutationFn: crpcClient.tournament.lifecycle.cancel.mutate,
    mutationKey: crpc.tournament.lifecycle.cancel.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar o torneio. Tente novamente."
        ),
        id: "cancel-tournament-error",
        label: "Falha ao cancelar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setIsCancelDialogOpen(false);
      toast.show({
        description:
          "Torneio cancelado. Inscrições pagas serão estornadas automaticamente.",
        id: "cancel-tournament-success",
        label: "Torneio cancelado",
        variant: "success",
      });
    },
  });

  const cancelEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.cancel.mutate,
    mutationKey: crpc.tournament.entries.cancel.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar a inscrição. Tente novamente."
        ),
        id: "cancel-entry-error",
        label: "Falha ao cancelar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setCancelEntryTarget(null);
      toast.show({
        description:
          "Inscrição cancelada. Se já estava paga, o estorno integral é automático.",
        id: "cancel-entry-success",
        label: "Inscrição cancelada",
        variant: "success",
      });
    },
  });

  const startTournament = useMutation({
    mutationFn: crpcClient.tournament.bracket.start.mutate,
    mutationKey: crpc.tournament.bracket.start.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível iniciar o torneio. Tente novamente."
        ),
        id: "start-tournament-error",
        label: "Falha ao iniciar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setIsStartDialogOpen(false);
      toast.show({
        description: "A chave está pública e o torneio em andamento.",
        id: "start-tournament-success",
        label: "Torneio iniciado",
        variant: "success",
      });
    },
  });

  const isError = bootstrapStatus === "error";
  const isLoading = bootstrapStatus !== "ready" || !tournament;
  const showStatusState = isError || isLoading;
  const isOrganizer = access?.canManage ?? false;
  const categories = tournament?.categories ?? [];
  const joinOptions = buildTournamentJoinOptions({
    categoryIds: categories.map((category) => category.id),
    entries,
    viewerEntryIds: tournament?.viewerEntryIds ?? [],
  });
  const activeEntriesCountByCategory =
    buildTournamentActiveEntriesCountByCategory(entries);
  // Categorias escolhíveis com vaga montada (molde do extinto rodapé-form):
  // alimenta o bloco de inscrição e o sheet de categoria.
  const joinableCategories = tournament
    ? categories
        .filter((category) =>
          joinOptions.joinableCategoryIds.includes(category.id)
        )
        .map((category) => {
          const vacancy = buildTournamentCategoryVacancy({
            activeEntriesCount: activeEntriesCountByCategory[category.id] ?? 0,
            maxEntries: category.maxEntries,
          });

          return {
            displayName: category.displayName,
            entryFeeCents: category.entryFeeCents,
            id: category.id,
            isFull: vacancy.isFull,
            modality: category.modality,
            vacancyLabel: vacancy.label,
          };
        })
    : [];
  const registrationState = tournament
    ? buildRegistrationWindowState({
        nowMs: Date.now(),
        registrationDeadlineMs: tournament.registrationDeadlineAt,
        status: tournament.status,
      })
    : null;
  const minFeeCents =
    joinableCategories.length > 0
      ? Math.min(
          ...joinableCategories.map((category) => category.entryFeeCents)
        )
      : 0;
  const hasActiveEntry =
    role === "player" && (tournament?.viewerEntryIds.length ?? 0) > 0;
  // Avisos do diálogo de Iniciar (só o organizador, em `drawn`): convites
  // sem resposta e vagas em aberto que recusam o início no servidor.
  const startWarnings =
    tournament && access?.canManage && tournament.status === "drawn"
      ? buildStartWarnings({ entries, matches })
      : [];

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton variant="secondary" />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right>
          {tournament && isOrganizer ? (
            <Menu>
              <Menu.Trigger asChild>
                <Button isIconOnly size="sm" variant="secondary">
                  <HugeIcons icon={MoreVerticalIcon} />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Overlay className="bg-backdrop" />
                <Menu.Content presentation="popover" width={240}>
                  <Menu.Item
                    onPress={() => {
                      router.navigate({
                        params: { mode: "edit", tournamentId },
                        pathname: "/settings/tournaments/[mode]",
                      });
                    }}
                  >
                    <Menu.ItemTitle>Editar</Menu.ItemTitle>
                    <HugeIcons icon={Edit02Icon} />
                  </Menu.Item>
                  {access?.canOpenBracket ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { tournamentId },
                          pathname: "/tournaments/[tournamentId]/bracket",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Chave</Menu.ItemTitle>
                      <HugeIcons icon={VolleyballIcon} />
                    </Menu.Item>
                  ) : null}
                  {access?.canOpenSchedule ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { tournamentId },
                          pathname: "/tournaments/[tournamentId]/schedule",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Agenda</Menu.ItemTitle>
                      <HugeIcons icon={Calendar03Icon} />
                    </Menu.Item>
                  ) : null}
                  {isOrganizer ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { initialTab: "pending", tournamentId },
                          pathname: "/tournaments/[tournamentId]/entries",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Inscrições</Menu.ItemTitle>
                      <HugeIcons icon={UserMultipleIcon} />
                    </Menu.Item>
                  ) : null}
                  <Menu.Item
                    onPress={() => {
                      router.navigate({
                        params: { tournamentId },
                        pathname: "/tournaments/[tournamentId]/rules",
                      });
                    }}
                  >
                    <Menu.ItemTitle>Regras</Menu.ItemTitle>
                    <HugeIcons icon={ClipboardIcon} />
                  </Menu.Item>
                  {tournament.status === "draft" ? (
                    <Menu.Item
                      onPress={() => {
                        publishTournament.mutate({ tournamentId });
                      }}
                    >
                      <Menu.ItemTitle>Publicar</Menu.ItemTitle>
                      <HugeIcons icon={PlayIcon} />
                    </Menu.Item>
                  ) : null}
                  {tournament.status === "drawn" ? (
                    <Menu.Item
                      onPress={() => {
                        setIsStartDialogOpen(true);
                      }}
                    >
                      <Menu.ItemTitle>Iniciar torneio</Menu.ItemTitle>
                      <HugeIcons icon={PlayIcon} />
                    </Menu.Item>
                  ) : null}
                  {tournament.status !== "draft" &&
                  tournament.status !== "finished" &&
                  tournament.status !== "cancelled" ? (
                    <Menu.Item
                      onPress={() => {
                        setIsCancelDialogOpen(true);
                      }}
                      variant="danger"
                    >
                      <Menu.ItemTitle>Cancelar torneio</Menu.ItemTitle>
                      <HugeIcons className="text-danger" icon={Cancel01Icon} />
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
        {isError && (
          <ErrorState message="Não foi possível carregar o torneio." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!showStatusState && tournament && (
          <>
            <TournamentBanner tournament={tournament} />
            <View className="gap-4 px-4 pt-4 pb-floating-tab-bar-4">
              {role === "organizer" && (
                <OrganizerOverview tournamentId={tournamentId} />
              )}
              {role === "player" && (
                <PlayerOverview
                  onCancelEntry={(categoryName, entryId) => {
                    setCancelEntryTarget({ categoryName, entryId });
                  }}
                  onPayEntry={(entryId) => {
                    createCharge.mutate({
                      sourceId: entryId,
                      sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
                    });
                  }}
                  onRespondInvite={(accept, entryId) => {
                    respondPartnerInvite.mutate({ accept, entryId });
                  }}
                  tournament={tournament}
                />
              )}
              {role === "guest" && <GuestOverview tournament={tournament} />}
            </View>
          </>
        )}
      </Page.ScrollView>

      {/* Rodapé fixo de inscrição (molde league-join-footer): respeita prazo
          e estados abertas/encerradas — só existe com a janela aberta e
          categoria com vaga; a escolha acontece no BottomSheet existente. */}
      {!showStatusState &&
      role !== "organizer" &&
      registrationState?.open &&
      joinableCategories.length > 0 ? (
        <Page.Footer className="flex-col px-8 pb-safe-offset-3">
          <Card
            className="centered flex-1 flex-row justify-between"
            variant="tertiary"
          >
            <View className="min-w-0 flex-1 pr-2">
              <Text weight="medium">Inscreva-se</Text>
              <View className="flex-row items-baseline gap-1">
                <Text size="xl" weight="medium">
                  {minFeeCents > 0
                    ? `a partir de ${formatEntryFeeLabel(minFeeCents)}`
                    : "Grátis"}
                </Text>
                {minFeeCents > 0 ? (
                  <Text color="muted" size="sm" weight="medium">
                    por jogador
                  </Text>
                ) : null}
              </View>
            </View>
            <Button onPress={() => setIsJoinSheetOpen(true)} size="sm">
              <Button.Label>
                {hasActiveEntry
                  ? "Inscrever-se em outra categoria"
                  : "Inscrever-se"}
              </Button.Label>
            </Button>
          </Card>
        </Page.Footer>
      ) : null}
      <TournamentJoinSheet
        categories={joinableCategories}
        isOpen={isJoinSheetOpen}
        onOpenChange={setIsJoinSheetOpen}
        tournamentId={tournamentId}
      />

      <Dialog isOpen={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Cancelar torneio</Dialog.Title>
            <Text color="muted" variant="description">
              Todas as inscrições serão canceladas. Inscrições pagas serão
              estornadas automaticamente pelo valor integral.
            </Text>
            <View className="flex-row gap-2 self-end">
              <Button
                onPress={() => {
                  setIsCancelDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={cancelTournament.isPending}
                onPress={() => {
                  cancelTournament.mutate({ tournamentId });
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Cancelar torneio</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog
        isOpen={cancelEntryTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelEntryTarget(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Cancelar inscrição</Dialog.Title>
            <Text color="muted" variant="description">
              {`Sua inscrição em ${cancelEntryTarget?.categoryName ?? ""} será cancelada. Em duplas, a saída vale para os dois jogadores. Inscrição paga recebe estorno integral.`}
            </Text>
            <View className="flex-row gap-2 self-end">
              <Button
                onPress={() => {
                  setCancelEntryTarget(null);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={cancelEntry.isPending}
                onPress={() => {
                  if (cancelEntryTarget) {
                    cancelEntry.mutate({
                      entryId: cancelEntryTarget.entryId,
                    });
                  }
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Cancelar inscrição</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog isOpen={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Iniciar torneio?</Dialog.Title>
            <Text color="muted" variant="description">
              A chave será publicada e não poderá mais ser alterada. O torneio
              começa.
            </Text>
            {startWarnings.map((warning) => (
              <Surface className="bg-warning-soft px-4 py-2" key={warning}>
                <Text color="warning" variant="description">
                  {warning}
                </Text>
              </Surface>
            ))}
            <View className="flex-row gap-2 self-end">
              <Button
                onPress={() => {
                  setIsStartDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                isDisabled={startTournament.isPending}
                onPress={() => {
                  startTournament.mutate({ tournamentId });
                }}
                size="sm"
              >
                <Button.Label>Iniciar torneio</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}

/**
 * Stretch banner (molde LeagueBanner, leagues/[leagueId]/index.tsx). Reage ao
 * offset de scroll da página (SharedValue da UI thread) com o efeito
 * "stretch to zoom" no overscroll.
 */
function TournamentBanner(props: {
  tournament: ApiOutputs["tournament"]["discovery"]["getById"];
}) {
  const { tournament } = props;
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
          source={tournament.coverUrl ?? undefined}
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
          source={tournament.avatarUrl ?? undefined}
        />
        <View className="flex-1 gap-1.5">
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>Torneio</Chip.Label>
          </Chip>
          <Text numberOfLines={2} variant="title">
            {tournament.name}
          </Text>
          <Chip color="accent" size="sm" variant="soft">
            <HugeIcons className="size-3 text-accent" icon={Location06Icon} />
            <Chip.Label>
              {formatLeagueMeta(tournament.city, tournament.state)}
            </Chip.Label>
          </Chip>
        </View>
      </View>
    </>
  );
}
