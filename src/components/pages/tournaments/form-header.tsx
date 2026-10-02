import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { Button, Menu, Tabs } from "heroui-native";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { HugeIcons } from "@/components/ui/huge-icons";
import { normalizeRouteParam } from "@/lib/router/normalize-param";
import {
  getCreateTournamentFormNavigation,
  getEditTournamentFormNavigation,
  TOURNAMENT_FORM_TAB_ITEMS,
  type TournamentFormTabValue,
} from "@/lib/tournaments/tournament-form-navigation";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

/** Header fixo do wizard: monta uma vez no `_layout` do cluster (fora do
 *  remount do form); a seção ativa vem da rota e o toque navega preservando o
 *  modo. */
export function TournamentFormHeader() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    tournamentId?: string | string[];
  }>();
  const { isSubmitPending, onSubmitPress } = useTournamentFormRoute();

  const routeName = segments.at(-1);
  const activeTab =
    TOURNAMENT_FORM_TAB_ITEMS.find((item) => item.routeName === routeName) ??
    TOURNAMENT_FORM_TAB_ITEMS[0];
  const isEdit = normalizeRouteParam(params.mode) === "edit";
  const subtitle = isEdit ? "Editar Torneio" : "Criar Torneio";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }

  function handleTabValueChange(value: string) {
    const tab = value as TournamentFormTabValue;

    if (tab === activeTab.value) {
      return;
    }

    if (isEdit) {
      const tournamentId = normalizeRouteParam(params.tournamentId)?.trim();

      if (!tournamentId) {
        return;
      }

      router.navigate(getEditTournamentFormNavigation(tab, tournamentId));
      return;
    }

    router.navigate(getCreateTournamentFormNavigation(tab));
  }

  return (
    <Page.Header>
      <View className="flex-1 flex-col gap-2">
        <View className="flex-1 flex-row items-center">
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
            <Page.Header.Title>{activeTab.label}</Page.Header.Title>
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
        </View>

        <Tabs onValueChange={handleTabValueChange} value={activeTab.value}>
          <Tabs.List>
            <Tabs.ScrollView>
              <Tabs.Indicator
                animation={{
                  translateX: { config: { duration: 250 }, type: "timing" },
                  width: { config: { duration: 250 }, type: "timing" },
                }}
              />
              {TOURNAMENT_FORM_TAB_ITEMS.map((item) => (
                <Tabs.Trigger key={item.value} value={item.value}>
                  <Tabs.Label>{item.label}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.ScrollView>
          </Tabs.List>
        </Tabs>
      </View>
    </Page.Header>
  );
}
