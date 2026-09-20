import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, Tabs, useToast } from "heroui-native";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  formatEntrySideLabel,
  getEntryStatusChip,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

export default function TournamentEntriesRoute() {
  const { initialTab, tournamentId } = useLocalSearchParams<{
    initialTab?: string;
    tournamentId: string;
  }>();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const access = useValue(bucket$.derived.access);
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
          : "Convite recusado.",
        id: "respond-partner-success",
        label: variables.accept ? "Convite aceito" : "Convite recusado",
        variant: "success",
      });
    },
  });

  const isOrganizer = access?.canManage ?? false;

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
  // PLN-0007 (decisão 1): pendências são superfície do ORGANIZADOR — o
  // jogador nunca vê pendência (nem a própria: convite/pagamento ficam na
  // overview, com ação, na página única).
  const [activeTab, setActiveTab] = useState<"confirmed" | "pending">(
    isOrganizer && initialTab === "pending" ? "pending" : "confirmed"
  );
  const visibleEntries =
    activeTab === "pending" && isOrganizer ? pendingEntries : confirmedEntries;

  function renderEntry(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);

    if (!entry) {
      return null;
    }

    const chip = getEntryStatusChip(entry.status);
    const category = categoriesById[entry.categoryId];
    const isInviteForViewer =
      !isOrganizer &&
      entry.status === "pending_partner" &&
      viewerProfileId !== null &&
      entry.playerBId === viewerProfileId;
    const isInviteFromViewer =
      !isOrganizer &&
      entry.status === "pending_partner" &&
      viewerProfileId !== null &&
      entry.playerAId === viewerProfileId;
    const canApprove = isOrganizer && entry.status === "pending_approval";
    const isActionPending =
      approveEntry.isPending ||
      rejectEntry.isPending ||
      respondPartnerInvite.isPending;
    const inviteNote = isInviteForViewer
      ? entry.playerA?.username
        ? `@${entry.playerA.username} convidou você para esta dupla.`
        : "Você foi convidado para esta dupla."
      : isInviteFromViewer
        ? entry.playerB?.username
          ? `Aguardando @${entry.playerB.username} aceitar o convite.`
          : "Aguardando o parceiro aceitar o convite."
        : null;

    return (
      <Card className="p-3" key={entry.id}>
        <View className="flex-row items-center gap-3">
          {entry.playerB ? (
            <View className="relative h-13 w-12">
              <Image
                className="absolute top-0 left-0 size-8.5 rounded-full border border-separator"
                fallback="green"
                source={entry.playerA?.avatarUrl ?? undefined}
              />
              <Image
                className="absolute right-0 bottom-0 size-8.5 rounded-full border border-separator"
                fallback="blue"
                source={entry.playerB.avatarUrl ?? undefined}
              />
            </View>
          ) : (
            <Image
              className="size-10 rounded-full"
              fallback="blue"
              source={entry.playerA?.avatarUrl ?? undefined}
            />
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text numberOfLines={1} weight="semibold">
              {formatEntrySideLabel(entry)}
            </Text>
            <Text color="muted" numberOfLines={1} variant="description">
              {category?.displayName ?? ""}
            </Text>
            {inviteNote ? (
              <Text color="muted" numberOfLines={1} variant="description">
                {inviteNote}
              </Text>
            ) : null}
          </View>
          {canApprove ? (
            <View className="flex-row gap-1">
              <Button
                isDisabled={isActionPending}
                isIconOnly
                onPress={() => {
                  rejectEntry.mutate({ entryId: entry.id });
                }}
                size="sm"
                variant="outline"
              >
                <HugeIcons icon={Cancel01Icon} />
              </Button>
              <Button
                isDisabled={isActionPending}
                isIconOnly
                onPress={() => {
                  approveEntry.mutate({ entryId: entry.id });
                }}
                size="sm"
              >
                <HugeIcons
                  className="text-accent-foreground"
                  icon={Tick02Icon}
                />
              </Button>
            </View>
          ) : isInviteForViewer ? (
            <View className="flex-row gap-1">
              <Button
                isDisabled={isActionPending}
                isIconOnly
                onPress={() => {
                  respondPartnerInvite.mutate({
                    accept: false,
                    entryId: entry.id,
                  });
                }}
                size="sm"
                variant="outline"
              >
                <HugeIcons icon={Cancel01Icon} />
              </Button>
              <Button
                isDisabled={isActionPending}
                isIconOnly
                onPress={() => {
                  respondPartnerInvite.mutate({
                    accept: true,
                    entryId: entry.id,
                  });
                }}
                size="sm"
              >
                <HugeIcons
                  className="text-accent-foreground"
                  icon={Tick02Icon}
                />
              </Button>
            </View>
          ) : (
            <Chip color={chip.color} size="sm" variant="soft">
              {chip.label}
            </Chip>
          )}
        </View>
      </Card>
    );
  }

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
          {isOrganizer ? (
            <Tabs
              onValueChange={(value) => {
                setActiveTab(value as typeof activeTab);
              }}
              value={activeTab}
            >
              <Tabs.List>
                <Tabs.ScrollView>
                  <Tabs.Indicator />
                  <Tabs.Trigger value="confirmed">
                    <Tabs.Label>Confirmados</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="pending">
                    <Tabs.Label>Pendências</Tabs.Label>
                  </Tabs.Trigger>
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
              description={
                isOrganizer
                  ? "Quando alguém se inscrever, ela aparecerá aqui."
                  : "Convites e pagamentos pendentes aparecem aqui."
              }
              title="Nenhuma pendência"
            />
          ) : (
            <EmptyState
              description={
                isOrganizer
                  ? "As inscrições confirmadas aparecem aqui."
                  : "Suas inscrições confirmadas aparecem aqui."
              }
              title="Nenhuma inscrição confirmada"
            />
          )}
        </Page.ScrollView>
      ) : (
        <Page.ScrollView
          contentContainerClassName="grow gap-2 px-4 pb-floating-tab-bar-offset-4"
          showsVerticalScrollIndicator={false}
        >
          {visibleEntries.map((entry) => renderEntry(entry.id))}
        </Page.ScrollView>
      )}
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
