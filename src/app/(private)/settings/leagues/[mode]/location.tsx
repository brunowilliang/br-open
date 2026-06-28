import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  FieldError,
  Input,
  Label,
  Menu,
  TextArea,
  TextField,
} from "heroui-native";
import { useController, useFormContext } from "react-hook-form";

import { Page } from "@/components/core/page";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";

export default function LeagueLocationRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useLeagueFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control } = useFormContext<LeagueScreenValues>();
  const { field: cityField, fieldState: cityState } = useController({
    control,
    name: "city",
  });
  const { field: stateField, fieldState: stateState } = useController({
    control,
    name: "state",
  });
  const { field: locationNotesField, fieldState: locationNotesState } =
    useController({
      control,
      name: "locationNotes",
    });

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Local</Page.Header.Title>
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
        <TextField isInvalid={Boolean(cityState.error)} isRequired>
          <Label>Cidade</Label>
          <Input
            editable={!isDisabled}
            onBlur={cityField.onBlur}
            onChangeText={cityField.onChange}
            placeholder="Ex: Florianópolis"
            value={cityField.value}
          />
          <FieldError>{cityState.error?.message ?? ""}</FieldError>
        </TextField>

        <TextField isInvalid={Boolean(stateState.error)} isRequired>
          <Label>Estado</Label>
          <Input
            autoCapitalize="characters"
            editable={!isDisabled}
            maxLength={2}
            onBlur={stateField.onBlur}
            onChangeText={stateField.onChange}
            placeholder="Ex: SC"
            value={stateField.value}
          />
          <FieldError>{stateState.error?.message ?? ""}</FieldError>
        </TextField>

        <TextField isInvalid={Boolean(locationNotesState.error)}>
          <Label>Complemento do local</Label>
          <TextArea
            editable={!isDisabled}
            onBlur={locationNotesField.onBlur}
            onChangeText={locationNotesField.onChange}
            placeholder="Ex: Próximo ao supermercado"
            value={locationNotesField.value ?? ""}
          />
          <FieldError>{locationNotesState.error?.message ?? ""}</FieldError>
        </TextField>
      </Page.ScrollView>
    </Page>
  );
}
