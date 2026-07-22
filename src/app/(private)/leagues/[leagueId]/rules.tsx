import {
  ChampionIcon,
  Clock03Icon,
  Target02Icon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
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
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

function RulesItemCard(props: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface-secondary px-4 py-3">
      <Text numberOfLines={1} weight="medium">
        {props.label}
      </Text>
      <Text color="muted" numberOfLines={2} variant="description">
        {props.value}
      </Text>
    </View>
  );
}

export default function LeagueRulesRoute() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const league = useValue(bucket$.data.league);
  const rulesView = useValue(bucket$.derived.rulesView);

  useEffect(() => {
    bucket$.actions.setActiveRoute("rules");
  }, [bucket$]);

  const isError = bootstrapStatus === "error" || (!!league && !rulesView);
  const isLoading = !league;
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
          <ErrorState message="Não foi possível carregar as regras da liga." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && rulesView && (
          <View className="gap-4">
            <Card className="gap-1 p-2">
              <Card.Header className="flex-row gap-2 p-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={Target02Icon}
                  />
                </View>
                <View className="flex-1">
                  <Text weight="medium">Desafios</Text>
                  <Text color="muted" variant="description">
                    Os limites que organizam quem pode desafiar, quantas
                    partidas pode manter em aberto e quanto tempo existe para
                    responder.
                  </Text>
                </View>
              </Card.Header>
              <Card.Body className="flex-row flex-wrap gap-2 px-2 pt-0 pb-2">
                <RulesItemCard
                  label="Distância"
                  value={rulesView.challenge.maxDistance}
                />
                <RulesItemCard
                  label="Ativos"
                  value={rulesView.challenge.activeLimit}
                />
                <RulesItemCard
                  label="Mensal"
                  value={rulesView.challenge.monthlyLimit}
                />
                <RulesItemCard
                  label="Resposta"
                  value={rulesView.challenge.responseDeadline}
                />
              </Card.Body>
            </Card>

            <Card className="gap-1 p-2">
              <Card.Header className="flex-row gap-2 p-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={ChampionIcon}
                  />
                </View>
                <View className="flex-1">
                  <Text weight="medium">Progressão</Text>
                  <Text color="muted" variant="description">
                    Como a liga sobe, desce e trata entradas, derrotas e W.O.
                  </Text>
                </View>
              </Card.Header>
              <Card.Body className="flex-row flex-wrap gap-2 px-2 pt-0 pb-2">
                <RulesItemCard
                  label="Entrada"
                  value={rulesView.progression.newPlayerPlacement}
                />
                <RulesItemCard
                  label="Vitória"
                  value={rulesView.progression.winBehavior}
                />
                <RulesItemCard
                  label="Derrota"
                  value={rulesView.progression.lossBehavior}
                />
                <RulesItemCard
                  label="W.O."
                  value={rulesView.progression.walkoverBehavior}
                />
              </Card.Body>
            </Card>

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
                    O formato padrão que vale para todas as partidas da liga.
                  </Text>
                </View>
              </Card.Header>
              <Card.Body className="flex-row flex-wrap gap-2 px-2 pt-0 pb-2">
                <RulesItemCard label="Formato" value={rulesView.match.format} />
                <RulesItemCard label="Set" value={rulesView.match.setFormat} />
                <RulesItemCard
                  label="Pontuação"
                  value={rulesView.match.scoring}
                />
                <RulesItemCard
                  label="Duração"
                  value={rulesView.match.duration}
                />
                <RulesItemCard
                  label="Tie-break"
                  value={rulesView.match.tieBreak}
                />
                <RulesItemCard
                  label="Decisão"
                  value={rulesView.match.finalSet}
                />
              </Card.Body>
            </Card>

            <Card className="gap-1 p-2">
              <Card.Header className="flex-row gap-2 p-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={Clock03Icon}
                  />
                </View>
                <View className="flex-1">
                  <Text weight="medium">Inatividade</Text>
                  <Text color="muted" variant="description">
                    {rulesView.inactivity}
                  </Text>
                </View>
              </Card.Header>
            </Card>
          </View>
        )}
      </Page.ScrollView>
    </Page>
  );
}
