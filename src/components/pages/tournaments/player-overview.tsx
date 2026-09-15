import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { Button, Chip } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import { getEntryStatusChip } from "@/lib/tournaments/tournament-details-derived";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

type PlayerOverviewProps = {
  onPayEntry: (entryId: string) => void;
  onRespondInvite: (accept: boolean, entryId: string) => void;
  tournament: TournamentOverview;
};

/** Visão do jogador na overview do torneio (molde league PlayerOverview). */
export function PlayerOverview(props: PlayerOverviewProps) {
  const { tournament } = props;
  const bucket$ = getTournamentDetailsBucket$(tournament.id);
  const entries = useValue(bucket$.data.entries);
  const viewerProfileId = useValue(bucket$.viewer.playerProfileId);

  const myEntries = entries.filter((entry) =>
    tournament.viewerEntryIds.includes(entry.id)
  );

  if (myEntries.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      <Text weight="semibold">Suas inscrições</Text>
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

        return (
          <View className="gap-2" key={entry.id}>
            <View className="flex-row items-center justify-between gap-2">
              <Text>{category?.displayName ?? ""}</Text>
              <Chip color={chip.color} size="sm" variant="soft">
                {chip.label}
              </Chip>
            </View>

            {canRespondInvite ? (
              <View className="flex-row gap-2">
                <Button
                  onPress={() => {
                    props.onRespondInvite(true, entry.id);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>Aceitar convite</Button.Label>
                </Button>
                <Button
                  onPress={() => {
                    props.onRespondInvite(false, entry.id);
                  }}
                  size="sm"
                  variant="danger-soft"
                >
                  <Button.Label>Recusar</Button.Label>
                </Button>
              </View>
            ) : null}

            {canPay ? (
              <Button
                onPress={() => {
                  props.onPayEntry(entry.id);
                }}
                size="sm"
              >
                <Button.Label>Pagar inscrição</Button.Label>
              </Button>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
