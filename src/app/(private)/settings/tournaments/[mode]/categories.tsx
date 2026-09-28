import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { CategoryEditor } from "@/components/ui/category-editor";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Button, Menu } from "heroui-native";

export default function TournamentCategoriesRoute() {
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
          <Page.Header.Title>Categorias</Page.Header.Title>
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
        <Text color="muted" variant="description">
          Cada categoria tem chave e inscrições próprias. O nome é livre e a
          taxa e o limite de vagas são opcionais.
        </Text>

        <CategoryEditor isDisabled={isDisabled} />
      </Page.ScrollView>
    </Page>
  );
}
