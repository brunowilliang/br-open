import {
  ChampionIcon,
  Clock03Icon,
  Target02Icon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams } from "expo-router";
import { Card } from "heroui-native";
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

type RulesIconType = typeof Target02Icon;

type RulesSectionItem = {
  label: string;
  value: string;
};

type RulesSectionProps = {
  description: string;
  icon: RulesIconType;
  items?: RulesSectionItem[];
  title: string;
};

function RulesIcon(props: { icon: RulesIconType }) {
  return (
    <View className="centered size-10 rounded-2xl bg-accent-soft">
      <HugeIcons className="size-5 text-accent" icon={props.icon} />
    </View>
  );
}

function RulesItemCard(props: RulesSectionItem) {
  return (
    <View className="min-w-0 flex-1 basis-[45%] gap-1 rounded-2xl bg-surface-secondary px-3 py-2">
      <Text numberOfLines={1} weight="medium">
        {props.label}
      </Text>
      <Text color="muted" numberOfLines={2} variant="description">
        {props.value}
      </Text>
    </View>
  );
}

function RulesSection(props: RulesSectionProps) {
  return (
    <Card className="gap-1 p-2">
      <Card.Header className="flex-row gap-2 p-2">
        <RulesIcon icon={props.icon} />
        <View className="flex-1">
          <Text weight="medium">{props.title}</Text>
          <Text color="muted" variant="description">
            {props.description}
          </Text>
        </View>
      </Card.Header>
      {props.items?.length ? (
        <Card.Body className="flex-row flex-wrap gap-2 px-2 pt-0 pb-2">
          {props.items.map((item) => (
            <RulesItemCard key={item.label} {...item} />
          ))}
        </Card.Body>
      ) : null}
    </Card>
  );
}

export default function LeagueRulesRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  return <LeagueRulesRouteContent leagueId={leagueId} />;
}

function LeagueRulesRouteContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const league = useValue(bucket$.data.league);
  const rulesView = useValue(bucket$.derived.rulesView);

  useEffect(() => {
    bucket$.actions.setActiveRoute("rules");
  }, [bucket$]);

  let content: ReactNode;

  if (bootstrapStatus === "error") {
    content = (
      <ErrorState message="Não foi possível carregar as regras da liga." />
    );
  } else if (!league) {
    content = <LoadingState />;
  } else if (rulesView) {
    const sections: RulesSectionProps[] = [
      {
        description:
          "Os limites que organizam quem pode desafiar, quantas partidas pode manter em aberto e quanto tempo existe para responder.",
        icon: Target02Icon,
        items: [
          { label: "Distância", value: rulesView.challenge.maxDistance },
          { label: "Ativos", value: rulesView.challenge.activeLimit },
          { label: "Mensal", value: rulesView.challenge.monthlyLimit },
          { label: "Resposta", value: rulesView.challenge.responseDeadline },
        ],
        title: "Desafios",
      },
      {
        description:
          "Como a liga sobe, desce e trata entradas, derrotas e W.O.",
        icon: ChampionIcon,
        items: [
          {
            label: "Entrada",
            value: rulesView.progression.newPlayerPlacement,
          },
          { label: "Vitória", value: rulesView.progression.winBehavior },
          { label: "Derrota", value: rulesView.progression.lossBehavior },
          { label: "W.O.", value: rulesView.progression.walkoverBehavior },
        ],
        title: "Progressão",
      },
      {
        description:
          "O formato padrão que vale para todas as partidas da liga.",
        icon: TennisRacketIcon,
        items: [
          { label: "Formato", value: rulesView.match.format },
          { label: "Set", value: rulesView.match.setFormat },
          { label: "Pontuação", value: rulesView.match.scoring },
          { label: "Duração", value: rulesView.match.duration },
          { label: "Tie-break", value: rulesView.match.tieBreak },
          { label: "Decisão", value: rulesView.match.finalSet },
        ],
        title: "Partidas",
      },
      {
        description: rulesView.inactivity,
        icon: Clock03Icon,
        title: "Inatividade",
      },
    ];

    content = (
      <View className="gap-0">
        {sections.map((section) => (
          <RulesSection key={section.title} {...section} />
        ))}
      </View>
    );
  } else {
    content = (
      <ErrorState message="Não foi possível carregar as regras da liga." />
    );
  }

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
        contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
      >
        {content}
      </Page.ScrollView>
    </Page>
  );
}
