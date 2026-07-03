import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Button, Menu, Tabs } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";

import { ChallengeRulesSection } from "./rules/_sections/challenge-rules-section";
import { MatchRulesSection } from "./rules/_sections/match-rules-section";
import { RankingRulesSection } from "./rules/_sections/ranking-rules-section";
import { ResultRulesSection } from "./rules/_sections/result-rules-section";

export default function LeagueRulesRoute() {
  const { isRulesLocked, isSubmitPending, mode, onSubmitPress } =
    useLeagueFormRoute();
  const [activeTab, setActiveTab] = useState("desafios");
  const isDisabled = isSubmitPending || isRulesLocked;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Regras</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay className="bg-backdrop" />
              <Menu.Content presentation="popover">
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle className="flex-none">Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <View className="gap-4">
          <Tabs
            onValueChange={setActiveTab}
            value={activeTab}
            // variant="secondary"
          >
            <Tabs.List className="w-full">
              <Tabs.ScrollView>
                <Tabs.Indicator />
                <Tabs.Trigger className="flex-1" value="desafios">
                  <Tabs.Label>Desafios</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="resultado">
                  <Tabs.Label>Resultado</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="ranking">
                  <Tabs.Label>Ranking</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="partidas">
                  <Tabs.Label>Partidas</Tabs.Label>
                </Tabs.Trigger>
              </Tabs.ScrollView>
            </Tabs.List>
            <Tabs.Content className="gap-2 pt-2" value="desafios">
              <ChallengeRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="resultado">
              <ResultRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="ranking">
              <RankingRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="partidas">
              <MatchRulesSection isDisabled={isDisabled} />
            </Tabs.Content>
          </Tabs>
        </View>
      </Page.ScrollView>
    </Page>
  );
}
