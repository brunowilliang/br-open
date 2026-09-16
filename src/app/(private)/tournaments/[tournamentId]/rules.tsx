import { useValue } from "@legendapp/state/react";
import { TennisRacketIcon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Card } from "heroui-native";
import { useEffect } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { RulesGrid, RulesItemCard } from "@/components/ui/rules-grid";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

export default function TournamentRulesRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const tournament = useValue(bucket$.data.tournament);
  const rulesView = useValue(bucket$.derived.rulesView);

  useEffect(() => {
    bucket$.actions.setActiveRoute("rules");
  }, [bucket$]);

  const isError = bootstrapStatus === "error" || (!!tournament && !rulesView);
  const isLoading = !tournament;
  const showStatusState = isError || isLoading;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Regras</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView
        className="flex-1"
        contentContainerClassName={cn(
          "px-4 pb-safe-offset-4",
          showStatusState && "centered"
        )}
      >
        {isError && (
          <ErrorState message="Não foi possível carregar as regras do torneio." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && rulesView && (
          <View className="gap-4">
            <Card className="gap-1 p-2">
              <Card.Header className="flex-row gap-2 p-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={TennisRacketIcon}
                  />
                </View>
                <View className="flex-1">
                  <Text weight="medium">Partidas</Text>
                  <Text color="muted" variant="description">
                    O formato que vale para todos os confrontos do torneio.
                  </Text>
                </View>
              </Card.Header>
              <Card.Body className="gap-2 px-2 pt-0 pb-2">
                <RulesGrid>
                  <RulesItemCard label="Formato" value={rulesView.format} />
                  <RulesItemCard label="Set" value={rulesView.setFormat} />
                  <RulesItemCard label="Pontuação" value={rulesView.scoring} />
                  <RulesItemCard label="Duração" value={rulesView.duration} />
                  <RulesItemCard label="Tie-break" value={rulesView.tieBreak} />
                </RulesGrid>
              </Card.Body>
            </Card>
          </View>
        )}
      </Page.ScrollView>
    </Page>
  );
}
