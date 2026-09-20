import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Menu,
  TextArea,
  TextField,
} from "heroui-native";
import { useController, useFormContext } from "react-hook-form";

import { Page } from "@/components/core/page";
import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentLocationRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Torneio" : "Editar Torneio";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control } = useFormContext<TournamentScreenValues>();
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
        <TextField isInvalid={Boolean(cityState.error)} isRequired>
          <Label>Cidade</Label>
          <Input
            editable={!isDisabled}
            onBlur={cityField.onBlur}
            onChangeText={cityField.onChange}
            placeholder="Ex.: São Paulo"
            value={cityField.value}
          />
          <FieldError>{cityState.error?.message ?? ""}</FieldError>
        </TextField>
        <TextField isInvalid={Boolean(stateState.error)} isRequired>
          <Label>Estado (UF)</Label>
          <Input
            editable={!isDisabled}
            maxLength={2}
            onBlur={stateField.onBlur}
            onChangeText={(nextValue) =>
              stateField.onChange(nextValue.toUpperCase())
            }
            placeholder="Ex.: SP"
            value={stateField.value}
          />
          <FieldError>{stateState.error?.message ?? ""}</FieldError>
        </TextField>
        <TextField isInvalid={Boolean(locationNotesState.error)}>
          <Label>Complemento</Label>
          <TextArea
            editable={!isDisabled}
            onBlur={locationNotesField.onBlur}
            onChangeText={locationNotesField.onChange}
            placeholder="Ex.: Clube central, portão 2, estacionamento gratuito."
            value={locationNotesField.value ?? ""}
          />
          <Description>
            Referências para os jogadores encontrarem o local.
          </Description>
          <FieldError>{locationNotesState.error?.message ?? ""}</FieldError>
        </TextField>
      </Page.ScrollView>
    </Page>
  );
}
