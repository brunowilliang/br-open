import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Button, Menu } from "heroui-native";

import { Page } from "@/components/core/page";
import { MatchRulesSection } from "@/components/match-rules/match-rules-section";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentRulesRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Torneio" : "Editar Torneio";

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
              <Menu.Content presentation="popover" width={240}>
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle>Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <MatchRulesSection isDisabled={isDisabled} prefix="matchConfig" />
      </Page.ScrollView>
    </Page>
  );
}
