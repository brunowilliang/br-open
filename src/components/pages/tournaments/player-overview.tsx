import type { ApiOutputs } from "@convex/shared/api";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { Button, Card, Chip } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { WidgetAlert } from "@/components/ui/widget-alert";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";
import {
  canCancelTournamentEntry,
  formatEntrySideLabel,
  getEntryStatusChip,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

type PlayerOverviewProps = {
  onCancelEntry: (categoryName: string, entryId: string) => void;
  onPayEntry: (entryId: string) => void;
  onRespondInvite: (accept: boolean, entryId: string) => void;
  tournament: TournamentOverview;
};

/**
 * Casa do torneio para o jogador (plano de conteúdo IBX-0071): alertas de
 * pendência das PROPRIAS inscrições (pagamento, convite), o bloco "Suas
 * inscrições" com ações e o próximo jogo do viewer como linha de texto
 * simples. Derivado do que a página já carrega — nenhuma query nova.
 */
export function PlayerOverview(props: PlayerOverviewProps) {
  const { tournament } = props;
  const bucket$ = getTournamentDetailsBucket$(tournament.id);
  const entries = useValue(bucket$.data.entries);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const viewerProfileId = useValue(bucket$.viewer.playerProfileId);

  const myEntries = entries.filter((entry) =>
    tournament.viewerEntryIds.includes(entry.id)
  );

  const awaitingPaymentCount = myEntries.filter(
    (entry) =>
      entry.status === "awaiting_payment" &&
      viewerProfileId !== null &&
      entry.playerAId === viewerProfileId
  ).length;
  const pendingInvite = myEntries.some(
    (entry) =>
      entry.status === "pending_partner" &&
      viewerProfileId !== null &&
      entry.playerBId === viewerProfileId
  );

  const matchesWithSides = useMemo(
    () => buildMatchSides({ entriesById, matches }),
    [entriesById, matches]
  );
  const viewerEntryIds = new Set(tournament.viewerEntryIds);
  const nextMatch = matchesWithSides
    .filter(
      (match) =>
        match.status === "scheduled" &&
        match.matchDate !== null &&
        match.startMinute !== null &&
        ((match.entryAId !== null && viewerEntryIds.has(match.entryAId)) ||
          (match.entryBId !== null && viewerEntryIds.has(match.entryBId)))
    )
    .sort(
      (a, b) =>
        (a.matchDate ?? "").localeCompare(b.matchDate ?? "") ||
        (a.startMinute ?? 0) - (b.startMinute ?? 0)
    )[0];
  const nextOpponent = nextMatch
    ? nextMatch.entryAId !== null && viewerEntryIds.has(nextMatch.entryAId)
      ? nextMatch.entryB
      : nextMatch.entryA
    : null;

  if (myEntries.length === 0 && !nextMatch) {
    return null;
  }

  return (
    <View className="gap-2">
      {awaitingPaymentCount > 0 ? (
        <WidgetAlert
          status="warning"
          title={`${awaitingPaymentCount} ${
            awaitingPaymentCount === 1
              ? "inscrição aguardando pagamento"
              : "inscrições aguardando pagamento"
          }`}
        />
      ) : null}

      {pendingInvite ? (
        <WidgetAlert
          status="accent"
          title="Convite de dupla aguardando sua resposta"
        />
      ) : null}

      {myEntries.length > 0 ? (
        <>
          <Text color="muted" variant="description" weight="medium">
            Suas inscrições
          </Text>
          {myEntries.map((entry) => {
            const category = tournament.categories.find(
              (candidate) => candidate.id === entry.categoryId
            );
            const chip = getEntryStatusChip(entry.status);
            const isViewerPartner =
              viewerProfileId !== null && entry.playerBId === viewerProfileId;
            const canRespondInvite =
              entry.status === "pending_partner" && isViewerPartner;
            const canPay =
              entry.status === "awaiting_payment" &&
              viewerProfileId !== null &&
              entry.playerAId === viewerProfileId;
            const canCancel = canCancelTournamentEntry({
              entryStatus: entry.status,
              tournamentStatus: tournament.status,
            });

            return (
              <Card className="p-3" key={entry.id}>
                <View className="flex-row items-center gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <Text numberOfLines={1} weight="semibold">
                      {category?.displayName ?? ""}
                    </Text>
                    <Chip
                      className="self-start"
                      color={chip.color}
                      size="sm"
                      variant="soft"
                    >
                      {chip.label}
                    </Chip>
                  </View>

                  <View className="flex-row items-center gap-1">
                    {canCancel ? (
                      <Button
                        isIconOnly
                        onPress={() => {
                          props.onCancelEntry(
                            category?.displayName ?? "",
                            entry.id
                          );
                        }}
                        size="sm"
                        variant="danger-soft"
                      >
                        <HugeIcons
                          className="text-danger"
                          icon={Cancel01Icon}
                        />
                      </Button>
                    ) : null}

                    {canRespondInvite ? (
                      <>
                        <Button
                          isIconOnly
                          onPress={() => {
                            props.onRespondInvite(false, entry.id);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <HugeIcons icon={Cancel01Icon} />
                        </Button>
                        <Button
                          isIconOnly
                          onPress={() => {
                            props.onRespondInvite(true, entry.id);
                          }}
                          size="sm"
                        >
                          <HugeIcons
                            className="text-accent-foreground"
                            icon={Tick02Icon}
                          />
                        </Button>
                      </>
                    ) : null}

                    {canPay ? (
                      <Button
                        onPress={() => {
                          props.onPayEntry(entry.id);
                        }}
                        size="sm"
                      >
                        <Button.Label>Pagar</Button.Label>
                      </Button>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {nextMatch &&
      nextMatch.matchDate !== null &&
      nextMatch.startMinute !== null &&
      nextOpponent ? (
        <View className="gap-1">
          <Text color="muted" variant="description" weight="medium">
            Próximo jogo
          </Text>
          <View className="flex-row items-center gap-3 bg-surface-secondary p-3">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} weight="medium">
                {`${formatMatchMonthDay(nextMatch.matchDate)} · ${formatMinuteToHHMM(nextMatch.startMinute)}`}
              </Text>
              <Text color="muted" numberOfLines={1} variant="description">
                {`Contra ${formatEntrySideLabel(nextOpponent)}`}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
