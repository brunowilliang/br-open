import {
  CheckmarkCircle02Icon,
  ImageUploadIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  FieldError,
  Input,
  Label,
  Menu,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { useController, useFormContext } from "react-hook-form";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";

export default function LeagueDetailsRoute() {
  const {
    avatarUrl,
    coverUrl,
    isMediaBusy,
    isSubmitPending,
    mode,
    onMediaPress,
    onSubmitPress,
  } = useLeagueFormRoute();
  const isDisabled = isSubmitPending;
  const isMediaUploading = isMediaBusy;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control } = useFormContext<LeagueScreenValues>();
  const { field: nameField, fieldState: nameState } = useController({
    control,
    name: "name",
  });
  const { field: descriptionField, fieldState: descriptionState } =
    useController({
      control,
      name: "description",
    });

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Detalhes</Page.Header.Title>
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
        <PressableFeedback
          className="aspect-video w-full overflow-hidden rounded-3xl"
          isDisabled={isDisabled}
          onPress={() => onMediaPress?.("cover")}
        >
          <Image
            className="size-full"
            contentFit="cover"
            fallback="blue"
            source={coverUrl ?? undefined}
          />
          <View className="centered absolute inset-0 bg-black/45">
            <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
            <Text className="mb-7 text-white" variant="description">
              {isMediaUploading ? "Salvando..." : "Alterar Banner"}
            </Text>
          </View>
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <PressableFeedback
          className="-mt-20 self-center rounded-full"
          isDisabled={isDisabled}
          onPress={() => onMediaPress?.("avatar")}
        >
          <Image
            alt="Perfil"
            className="size-30 rounded-full"
            fallback="blue"
            source={avatarUrl ?? undefined}
          />
          <View className="centered absolute inset-0 bg-black/45">
            <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
            <Text className="text-white" variant="description">
              {isMediaUploading ? "Salvando..." : "Alterar Avatar"}
            </Text>
          </View>
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <TextField isInvalid={Boolean(nameState.error)} isRequired>
          <Label>Nome da liga</Label>
          <Input
            editable={!isDisabled}
            onBlur={nameField.onBlur}
            onChangeText={nameField.onChange}
            placeholder="Ex.: Liga de Tênis do Clube"
            value={nameField.value}
          />
          <FieldError>{nameState.error?.message ?? ""}</FieldError>
        </TextField>
        <TextField isInvalid={Boolean(descriptionState.error)}>
          <Label>Descrição da liga</Label>
          <TextArea
            editable={!isDisabled}
            onBlur={descriptionField.onBlur}
            onChangeText={descriptionField.onChange}
            placeholder="Conte um pouco sobre a liga, regras e público."
            value={descriptionField.value ?? ""}
          />
          <FieldError>{descriptionState.error?.message ?? ""}</FieldError>
        </TextField>
      </Page.ScrollView>
    </Page>
  );
}
