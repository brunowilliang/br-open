import { Page } from "@/components/core/NewPage";
import { CourtEditor } from "@/components/ui/court-editor";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Button, Menu } from "heroui-native";

export default function LeagueCourtsRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useLeagueFormRoute();
  const isDisabled = isSubmitPending;
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
          <Page.Header.Title>Quadras</Page.Header.Title>
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

      <Page.ScrollView contentContainerClassName="grow gap-4 px-4 pb-floating-tab-bar-offset-4">
        <CourtEditor isDisabled={isDisabled} />
      </Page.ScrollView>
    </Page>
  );
}
