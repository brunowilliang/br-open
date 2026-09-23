import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "@convex/domains/payment/contract";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Dialog, Tabs, useToast } from "heroui-native";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryCard } from "@/components/ui/entry-card";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  buildTournamentEntriesTabItems,
  canCancelTournamentEntry,
  formatEntryPlayerNames,
  resolveTournamentEntriesTab,
  type TournamentEntriesTab,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

type EntryRowActionsProps = {
  categoryName: string;
  entry: TournamentEntryWithPlayers;
  isActionPending: boolean;
  isOrganizer: boolean;
  onApprove: (entryId: string) => void;
  onCancelPress: (target: { categoryName: string; entryId: string }) => void;
  onPay: (entryId: string) => void;
  onReject: (entryId: string) => void;
  onRespondInvite: (input: { accept: boolean; entryId: string }) => void;
  payIsPending: boolean;
  segment: TournamentEntriesTab;
  tournamentStatus: null | string;
  viewerProfileId: null | string;
};

/** Ações da linha por SEGMENTO: o card de inscrição é UM só
 * (`ui/entry-card.tsx`) e o que muda por aba é este recorte, que sai por early
 * return — nunca um `actions` montado por branch. */
function EntryRowActions(props: EntryRowActionsProps) {
  const { entry } = props;
  const isResponder =
    !props.isOrganizer &&
    entry.status === "pending_partner" &&
    props.viewerProfileId !== null &&
    entry.playerBId === props.viewerProfileId;

  if (props.segment === "mine") {
    const canCancel = props.tournamentStatus
      ? canCancelTournamentEntry({
          entryStatus: entry.status,
          tournamentStatus: props.tournamentStatus,
        })
      : false;
    const canPay =
      entry.status === "awaiting_payment" &&
      props.viewerProfileId !== null &&
      entry.playerAId === props.viewerProfileId;

    return (
      <View className="flex-row items-center gap-1">
        {canCancel ? (
          <Button
            isIconOnly
            onPress={() => {
              props.onCancelPress({
                categoryName: props.categoryName,
                entryId: entry.id,
              });
            }}
            size="sm"
            variant="danger-soft"
          >
            <HugeIcons className="text-danger" icon={Cancel01Icon} />
          </Button>
        ) : null}
        {isResponder ? (
          <>
            <Button
              isDisabled={props.isActionPending}
              isIconOnly
              onPress={() => {
                props.onRespondInvite({ accept: false, entryId: entry.id });
              }}
              size="sm"
              variant="outline"
            >
              <HugeIcons icon={Cancel01Icon} />
            </Button>
            <Button
              isDisabled={props.isActionPending}
              isIconOnly
              onPress={() => {
                props.onRespondInvite({ accept: true, entryId: entry.id });
              }}
              size="sm"
            >
              <HugeIcons className="text-accent-foreground" icon={Tick02Icon} />
            </Button>
          </>
        ) : null}
        {canPay ? (
          <Button
            isDisabled={props.payIsPending}
            onPress={() => {
              props.onPay(entry.id);
            }}
            size="sm"
          >
            <Button.Label>Pagar</Button.Label>
          </Button>
        ) : null}
      </View>
    );
  }

  if (props.isOrganizer && entry.status === "pending_approval") {
    return (
      <View className="flex-row gap-1">
        <Button
          isDisabled={props.isActionPending}
          isIconOnly
          onPress={() => {
            props.onReject(entry.id);
          }}
          size="sm"
          variant="outline"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
        <Button
          isDisabled={props.isActionPending}
          isIconOnly
          onPress={() => {
            props.onApprove(entry.id);
          }}
          size="sm"
        >
          <HugeIcons className="text-accent-foreground" icon={Tick02Icon} />
        </Button>
      </View>
    );
  }

  if (isResponder) {
    return (
      <View className="flex-row gap-1">
        <Button
          isDisabled={props.isActionPending}
          isIconOnly
          onPress={() => {
            props.onRespondInvite({ accept: false, entryId: entry.id });
          }}
          size="sm"
          variant="outline"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
        <Button
          isDisabled={props.isActionPending}
          isIconOnly
          onPress={() => {
            props.onRespondInvite({ accept: true, entryId: entry.id });
          }}
          size="sm"
        >
          <HugeIcons className="text-accent-foreground" icon={Tick02Icon} />
        </Button>
      </View>
    );
  }

  return null;
}

/** Nota do pé do card quando a inscrição é um CONVITE: quem convidou, ou quem
 * já foi convidado (string pura, sem JSX). */
function resolveInviteNote(input: {
  entry: TournamentEntryWithPlayers;
  isOrganizer: boolean;
  viewerProfileId: null | string;
}): null | string {
  const { entry, viewerProfileId } = input;

  if (input.isOrganizer || entry.status !== "pending_partner") {
    return null;
  }

  if (viewerProfileId !== null && entry.playerBId === viewerProfileId) {
    return entry.playerA?.username
      ? `@${entry.playerA.username} convidou você para esta dupla.`
      : "Você foi convidado para esta dupla.";
  }

  if (viewerProfileId !== null && entry.playerAId === viewerProfileId) {
    return entry.playerB?.username
      ? `Aguardando @${entry.playerB.username} aceitar o convite.`
      : "Aguardando o parceiro aceitar o convite.";
  }

  return null;
}

export default function TournamentEntriesRoute() {
  const { initialTab, tournamentId } = useLocalSearchParams<{
    initialTab?: string;
    tournamentId: string;
  }>();
  const router = useRouter();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const role = useValue(bucket$.derived.role);
  const tournament = useValue(bucket$.data.tournament);
  const entries = useValue(bucket$.data.entries);
  const categoriesById = useValue(bucket$.derived.categoriesById);
  const viewerProfileId = useValue(bucket$.viewer.playerProfileId);

  async function invalidateTournamentContext() {
    await queryClient.invalidateQueries(
      crpc.tournament.entries.listForTournament.queryFilter({ tournamentId })
    );
    await queryClient.invalidateQueries(
      crpc.tournament.discovery.getById.queryFilter({ tournamentId })
    );
  }

  const approveEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.approve.mutate,
    mutationKey: crpc.tournament.entries.approve.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível aprovar a inscrição. Tente novamente."
        ),
        id: "approve-entry-error",
        label: "Falha ao aprovar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "Inscrição aprovada.",
        id: "approve-entry-success",
        label: "Inscrição aprovada",
        variant: "success",
      });
    },
  });

  const rejectEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.reject.mutate,
    mutationKey: crpc.tournament.entries.reject.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar a inscrição. Tente novamente."
        ),
        id: "reject-entry-error",
        label: "Falha ao recusar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "Inscrição recusada.",
        id: "reject-entry-success",
        label: "Inscrição recusada",
        variant: "success",
      });
    },
  });

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

  const [cancelEntryTarget, setCancelEntryTarget] = useState<null | {
    categoryName: string;
    entryId: string;
  }>(null);

  // O CANCELAR INSCRIÇÃO vive só nesta tela: mutation e dialog de confirmação.
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

  // "Pagar": createCharge e a navegação pro checkout — mesmo fluxo do JoinFooter.
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

  // O papel resolvido manda na tela: `access`/`role` só existem depois que a
  // descoberta hidrata — montar a barra de segmentos antes disso pintaria as
  // abas de jogador para o gestor.
  const isOrganizer = role === "organizer";
  // Pendência de qualquer ação da linha: os botões do card compartilham o gate.
  const isActionPending =
    approveEntry.isPending ||
    rejectEntry.isPending ||
    respondPartnerInvite.isPending;
  const entriesTabItems = buildTournamentEntriesTabItems({ role });

  const pendingEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status === "awaiting_payment" ||
          entry.status === "pending_approval" ||
          entry.status === "pending_partner"
      ),
    [entries]
  );
  const confirmedEntries = useMemo(
    () => entries.filter((entry) => entry.status === "active"),
    [entries]
  );
  // Inscrições do VIEWER: o servidor só devolve `viewerEntryIds` para o ator
  // de jogador (vazio para organização e guest).
  const myEntries = useMemo(
    () =>
      entries.filter(
        (entry) => tournament?.viewerEntryIds.includes(entry.id) ?? false
      ),
    [entries, tournament]
  );
  // Pendências são superfície do ORGANIZADOR. A aba é DERIVADA: o
  // `initialTab=pending` só vale com o papel resolvido (entrada fria tem `role`
  // null); `userTab` é só a escolha MANUAL, descartada se a aba não existir.
  const [userTab, setUserTab] = useState<null | TournamentEntriesTab>(null);
  const activeTab = resolveTournamentEntriesTab({
    initialTab,
    role,
    userTab,
  });
  const visibleEntries =
    activeTab === "pending"
      ? pendingEntries
      : activeTab === "mine"
        ? myEntries
        : confirmedEntries;

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row">
            <Page.Header.Left />
            <Page.Header.Center>
              <Page.Header.Title>Inscrições</Page.Header.Title>
            </Page.Header.Center>
            <Page.Header.Right />
          </View>
          {/* Barra só com 2+ itens: o guest não tem "Minhas" (sem
              inscrição viva) e na entrada fria o papel ainda é null. */}
          {entriesTabItems.length > 1 ? (
            <Tabs
              onValueChange={(value) => {
                setUserTab(value as TournamentEntriesTab);
              }}
              value={activeTab}
            >
              <Tabs.List>
                <Tabs.ScrollView>
                  <Tabs.Indicator />
                  {entriesTabItems.map((item) => (
                    <Tabs.Trigger key={item.value} value={item.value}>
                      <Tabs.Label>{item.label}</Tabs.Label>
                    </Tabs.Trigger>
                  ))}
                </Tabs.ScrollView>
              </Tabs.List>
            </Tabs>
          ) : null}
        </View>
      </Page.Header>

      {bootstrapStatus === "error" ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <ErrorState message="Não foi possível carregar as inscrições." />
        </Page.ScrollView>
      ) : bootstrapStatus !== "ready" || !tournament ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <LoadingState />
        </Page.ScrollView>
      ) : visibleEntries.length === 0 ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          {activeTab === "pending" ? (
            <EmptyState
              description="Quando alguém se inscrever, ela aparecerá aqui."
              title="Nenhuma pendência"
            />
          ) : activeTab === "mine" ? (
            <EmptyState
              description="Suas inscrições neste torneio aparecem aqui."
              title="Nenhuma inscrição"
            />
          ) : (
            <EmptyState
              description="As inscrições confirmadas aparecem aqui."
              title="Nenhuma inscrição confirmada"
            />
          )}
        </Page.ScrollView>
      ) : (
        <Page.ScrollView
          contentContainerClassName="grow gap-2 px-4 pb-floating-tab-bar-offset-4"
          showsVerticalScrollIndicator={false}
        >
          {visibleEntries.map((entry) => {
            const category = categoriesById[entry.categoryId];
            const names = formatEntryPlayerNames(entry);

            return (
              <EntryCard
                categoryLabel={category?.displayName ?? null}
                entryStatus={entry.status}
                key={entry.id}
                noteLabel={resolveInviteNote({
                  entry,
                  isOrganizer,
                  viewerProfileId,
                })}
                partnerAvatarUrl={entry.playerB?.avatarUrl ?? null}
                partnerName={names[1] ?? null}
                playerAvatarUrl={entry.playerA?.avatarUrl ?? null}
                playerName={names[0] ?? ""}
              >
                <EntryRowActions
                  categoryName={category?.displayName ?? ""}
                  entry={entry}
                  isActionPending={isActionPending}
                  isOrganizer={isOrganizer}
                  onApprove={(entryId) => {
                    approveEntry.mutate({ entryId });
                  }}
                  onCancelPress={setCancelEntryTarget}
                  onPay={(entryId) => {
                    createCharge.mutate({
                      sourceId: entryId,
                      sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
                    });
                  }}
                  onReject={(entryId) => {
                    rejectEntry.mutate({ entryId });
                  }}
                  onRespondInvite={(input) => {
                    respondPartnerInvite.mutate(input);
                  }}
                  payIsPending={createCharge.isPending}
                  segment={activeTab}
                  tournamentStatus={tournament?.status ?? null}
                  viewerProfileId={viewerProfileId}
                />
              </EntryCard>
            );
          })}
        </Page.ScrollView>
      )}
      <Page.Footer className="pb-floating-tab-bar-4" />

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
    </Page>
  );
}
