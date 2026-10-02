import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "heroui-native";
import { useState, type ReactNode } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

const AnimatedContentContainer = ({ children }: { children: ReactNode }) => (
  <Animated.View
    entering={FadeIn.duration(200)}
    exiting={FadeOut.duration(200)}
  >
    {children}
  </Animated.View>
);

type TournamentOverviewTabsProps = {
  description?: null | string;
  /** Painel da primeira aba ("Visão geral"); sem ele (visitante) a barra
   * começa em Informações. */
  overview?: ReactNode;
};

/** Abas do miolo do torneio, iguais nas três casas: a "Visão geral" na frente
 * quando o papel tem painel e, sempre, Informações/Regulamento/Premiação. */
export function TournamentOverviewTabs(props: TournamentOverviewTabsProps) {
  const hasOverview = props.overview !== undefined;
  const [activeTab, setActiveTab] = useState(
    hasOverview ? "visao-geral" : "informacoes"
  );

  return (
    <Tabs onValueChange={setActiveTab} value={activeTab}>
      <Tabs.List className="bg-surface">
        <Tabs.ScrollView>
          <Tabs.Indicator className="bg-surface-tertiary" />
          {hasOverview ? (
            <Tabs.Trigger value="visao-geral">
              {({ isSelected }) => (
                <Tabs.Label
                  className={isSelected ? "text-foreground" : "text-muted"}
                >
                  Visão geral
                </Tabs.Label>
              )}
            </Tabs.Trigger>
          ) : null}
          <Tabs.Trigger value="informacoes">
            {({ isSelected }) => (
              <Tabs.Label
                className={isSelected ? "text-foreground" : "text-muted"}
              >
                Informações
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="regulamento">
            {({ isSelected }) => (
              <Tabs.Label
                className={isSelected ? "text-foreground" : "text-muted"}
              >
                Regulamento
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="premiacao">
            {({ isSelected }) => (
              <Tabs.Label
                className={isSelected ? "text-foreground" : "text-muted"}
              >
                Premiação
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        </Tabs.ScrollView>
      </Tabs.List>

      <Animated.View layout={LinearTransition.duration(200)}>
        {hasOverview ? (
          <Tabs.Content value="visao-geral">
            <AnimatedContentContainer>
              {props.overview}
            </AnimatedContentContainer>
          </Tabs.Content>
        ) : null}
        <Tabs.Content value="informacoes">
          <AnimatedContentContainer>
            <Text color="muted">{props.description}</Text>
          </AnimatedContentContainer>
        </Tabs.Content>
        <Tabs.Content value="regulamento">
          <AnimatedContentContainer>
            <EmptyState
              description="O regulamento deste torneio ainda não foi publicado."
              title="Sem regulamento"
            />
          </AnimatedContentContainer>
        </Tabs.Content>
        <Tabs.Content value="premiacao">
          <AnimatedContentContainer>
            <EmptyState
              description="A premiação deste torneio ainda não foi definida."
              title="Sem premiação"
            />
          </AnimatedContentContainer>
        </Tabs.Content>
      </Animated.View>
    </Tabs>
  );
}
