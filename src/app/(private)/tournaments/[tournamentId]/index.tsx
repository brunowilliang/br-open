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
} from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Chip,
  Description,
  Dialog,
  Menu,
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
import { TournamentJoinFooter } from "@/components/pages/tournaments/tournament-join-footer";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatLeagueMeta } from "@/lib/leagues/presentation";
import { formatEntryFeeLabel } from "@/lib/tournaments/tournament-details-derived";
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
              <View className="gap-2">
                <View className="flex-row flex-wrap gap-2">
                  {categories.map((category) => (
                    <Chip key={category.id} size="sm" variant="soft">
                      {`${category.displayName} · ${
                        category.entryFeeCents > 0
                          ? formatEntryFeeLabel(category.entryFeeCents)
                          : "Grátis"
                      }`}
                    </Chip>
                  ))}
                </View>
                <Text className="text-muted" size="sm">
                  {`Início ${formatDate(tournament.startDate)} · inscrições até ${formatDate(tournament.registrationDeadlineAt)} · ${formatCount(tournament.activeEntryCount)}`}
                </Text>
              </View>

              {role === "organizer" && (
                <OrganizerOverview tournamentId={tournamentId} />
              )}
              {role === "player" && (
                <PlayerOverview
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

      {role === "guest" &&
      tournament &&
      tournament.status === "published" &&
      categories.length > 0 ? (
        <TournamentJoinFooter
          categories={categories.map((category) => ({
            displayName: category.displayName,
            entryFeeCents: category.entryFeeCents,
            id: category.id,
            maxEntries: category.maxEntries,
            modality: category.modality,
          }))}
          tournamentId={tournamentId}
        />
      ) : null}

      <Dialog isOpen={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Cancelar torneio</Dialog.Title>
            <Description>
              Todas as inscrições serão canceladas. Inscrições pagas serão
              estornadas automaticamente pelo valor integral.
            </Description>
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

      <Dialog isOpen={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Iniciar torneio?</Dialog.Title>
            <Description>
              A chave será publicada e não poderá mais ser alterada. O torneio
              começa.
            </Description>
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

function formatDate(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

function formatCount(count: number) {
  return count === 1
    ? "1 inscrição confirmada"
    : `${count} inscrições confirmadas`;
}
