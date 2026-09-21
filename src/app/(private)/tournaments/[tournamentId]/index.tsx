import type { TournamentPlayerCard } from "@convex/domains/tournament/contract";
import type { ApiOutputs } from "@convex/shared/api";
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
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, Dialog, Menu, Surface, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { usePageContext } from "@/components/core/page/context";
import { Text } from "@/components/core/text";
import { GuestOverview } from "@/components/pages/tournaments/guest-overview";
import { OrganizerOverview } from "@/components/pages/tournaments/organizer-overview";
import { PlayerOverview } from "@/components/pages/tournaments/player-overview";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatLeagueMeta } from "@/lib/leagues/presentation";
import {
  buildRegistrationWindowState,
  buildStartWarnings,
  buildTournamentActiveEntriesCountByCategory,
  buildTournamentCategoryVacancy,
  buildTournamentJoinOptions,
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
          : "Convite recusado, as vagas voltaram para a categoria.",
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

  // Inscrição pelo rodapé (JoinFooter): mesma sequência do extinto
  // TournamentJoinSheet — create → (awaiting_payment) charge → checkout.
  const createEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.create.mutate,
    mutationKey: crpc.tournament.entries.create.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível entrar no torneio. Tente novamente."
        ),
        id: "tournament-join-error",
        label: "Falha na inscrição",
        variant: "danger",
      });
    },
    onSuccess: async (entry, variables) => {
      if (entry.status === "awaiting_payment") {
        // A navegação pro checkout é o onSuccess do createCharge.
        await createCharge.mutateAsync({
          sourceId: entry.id,
          sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
        });
        return;
      }

      toast.show({
        description:
          entry.status === "pending_partner"
            ? variables.partnerUsername
              ? `Convite enviado para @${variables.partnerUsername}. Ele precisa aceitar para fechar a dupla.`
              : "Convite enviado. Ele precisa aceitar para fechar a dupla."
            : entry.status === "pending_approval"
              ? "Sua inscrição aguarda aprovação da organização."
              : "Você está inscrito no torneio!",
        id: "tournament-join-success",
        label: "Inscrição enviada",
        variant: "success",
      });
    },
  });

  // Busca viva do parceiro de duplas: debounce 500ms +
  // players.searchByUsername — contrato r18-A devolve LISTA alfabética
  // (≤10, [] = ninguém) por prefixo; r25 resolve o gênero no servidor a
  // partir da categoria (o cliente nunca manda gender); r26 alimenta a
  // categoria com a seleção em tempo real do painel (onCategoryChange).
  const [partnerSearch, setPartnerSearch] = useState("");
  const [debouncedPartnerSearch, setDebouncedPartnerSearch] = useState("");
  // Categoria escolhida no painel do JoinFooter, em tempo real (r26): alimenta
  // a busca de parceiro. Estado da TELA; o painel continua dono da seleção.
  const [selectedCategoryId, setSelectedCategoryId] = useState<null | string>(
    null
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedPartnerSearch(partnerSearch.trim().toLowerCase()),
      500
    );

    return () => clearTimeout(timer);
  }, [partnerSearch]);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
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
            ineligibleReason: category.viewerIneligibleReason,
            isFull: vacancy.isFull,
            isIneligible: category.viewerEligible === false,
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

  // r26: a busca de parceiro usa a CATEGORIA SELECIONADA no painel do
  // JoinFooter (onCategoryChange); sem categoria — ou numa singles — a busca
  // segue desabilitada. O servidor resolve o gênero pela categoria (contrato
  // r25); o cliente nunca manda gender.
  const selectedJoinCategory = joinableCategories.find(
    (category) => category.id === selectedCategoryId
  );

  const partnerQuery = useQuery({
    ...crpc.tournament.players.searchByUsername.staticQueryOptions({
      categoryId: selectedCategoryId ?? "",
      username: debouncedPartnerSearch,
    }),
    enabled:
      selectedJoinCategory?.modality === "doubles" &&
      debouncedPartnerSearch.length >= 3 &&
      debouncedPartnerSearch.length <= 30,
    staleTime: 15_000,
  });

  // r30: busca de parceiro EM ANDAMENTO — janela do debounce (o termo cru já
  // mudou e o debounced ainda não acompanhou) OU fetch da query (`isFetching`
  // cobre o primeiro disparo e o refetch). O rodapé troca o Empty pelo
  // LoadingState com isso; "Nenhum jogador encontrado." fica pra resolvida.
  const isPartnerSearchPending =
    partnerQuery.isFetching ||
    debouncedPartnerSearch !== partnerSearch.trim().toLowerCase();

  const partnerCards = (
    Array.isArray(partnerQuery.data) ? partnerQuery.data : []
  ) as TournamentPlayerCard[];
  const partnerOptions: JoinFooterPartnerOption[] = partnerCards.map(
    (card) => ({
      avatarUrl: card.avatarUrl,
      fullName: card.fullName ?? card.nickname ?? `@${card.username ?? ""}`,
      username: card.username ?? "",
    })
  );

  // Rodapé de inscrição (JoinFooter): categorias com labels prontos e o
  // CTA do painel no vocabulário do extinto sheet ("Inscrever e pagar" com
  // taxa, "Confirmar inscrição" grátis; categoria mista = neutro).
  // r27 (contrato de discovery): a elegibilidade do ator desce como veio —
  // `viewerEligible === false` vira linha DESABILITADA com o motivo do
  // servidor (`viewerIneligibleReason`); nenhuma regra de gênero é
  // recalculada aqui e nenhuma categoria é escondida.
  const joinFooterCategories: JoinFooterCategory[] = joinableCategories.map(
    (category) => ({
      displayName: category.displayName,
      id: category.id,
      ineligibleReason: category.ineligibleReason,
      isFull: category.isFull,
      isIneligible: category.isIneligible,
      modality: category.modality,
      priceLabel:
        category.entryFeeCents > 0
          ? formatCurrencyCents(category.entryFeeCents)
          : "Grátis",
      vacancyLabel: category.vacancyLabel,
    })
  );
  const joinConfirmLabel = joinableCategories.every(
    (category) => category.entryFeeCents === 0
  )
    ? "Confirmar inscrição"
    : joinableCategories.every((category) => category.entryFeeCents > 0)
      ? "Inscrever e pagar"
      : "Inscrever-se";
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
                <OrganizerOverview
                  onPendingActionPerformed={invalidateTournamentContext}
                  tournamentId={tournamentId}
                />
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
                  onPendingActionPerformed={invalidateTournamentContext}
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

      {/* Rodapé fixo de inscrição = JoinFooter (molde unificado liga+torneio,
          IBX-0074): respeita prazo e estados — só existe com a janela aberta
          e categoria com vaga; o painel expande com seletor de categoria e
          parceiro de duplas (busca viva); a confirmação é o wiring da página
          (create → charge → checkout). */}
      {!showStatusState &&
      role !== "organizer" &&
      registrationState?.open &&
      joinableCategories.length > 0 ? (
        <JoinFooter
          actionLabel={
            hasActiveEntry ? "Inscrever em outra categoria" : "Inscrever-se"
          }
          categories={joinFooterCategories}
          confirmLabel={
            createEntry.isPending ? "Enviando..." : joinConfirmLabel
          }
          description="Selecione a sua categoria"
          footerClassName="pb-floating-tab-bar-4"
          isActionPending={createEntry.isPending}
          isPartnerSearchPending={isPartnerSearchPending}
          onAction={(selection) => {
            if (!selection.categoryId) {
              return;
            }
            createEntry.mutate({
              categoryId: selection.categoryId,
              ...(selection.partnerUsername
                ? { partnerUsername: selection.partnerUsername }
                : {}),
            });
          }}
          onCategoryChange={setSelectedCategoryId}
          onSearchPartner={setPartnerSearch}
          partnerOptions={partnerOptions}
          price={
            minFeeCents > 0
              ? {
                  amount: formatCurrencyCents(minFeeCents),
                  prefix: "a partir de",
                  suffix: "/jogador",
                }
              : { amount: "Grátis" }
          }
          title="Inscreva-se"
        />
      ) : null}

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
