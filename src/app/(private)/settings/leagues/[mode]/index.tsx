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
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { useController, useFormContext } from "react-hook-form";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { MediaConfirmDialog } from "@/components/ui/media-confirm-dialog";
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
  const [mediaTarget, setMediaTarget] = useState<null | "avatar" | "cover">(
    null
  );

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
        <PressableFeedback
          className="aspect-video w-full overflow-hidden rounded-3xl"
          isDisabled={isDisabled || isMediaUploading}
          onPress={() => setMediaTarget("cover")}
        >
          <Image
            className="size-full"
            contentFit="cover"
            fallback="blue"
            source={coverUrl ?? undefined}
          />
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <PressableFeedback
          className="-mt-20 self-center rounded-full"
          isDisabled={isDisabled || isMediaUploading}
          onPress={() => setMediaTarget("avatar")}
        >
          <Image
            alt="Perfil"
            className="size-30 rounded-full"
            fallback="blue"
            source={avatarUrl ?? undefined}
          />
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

        <MediaConfirmDialog
          isOpen={mediaTarget !== null}
          onConfirm={() => {
            if (mediaTarget) {
              onMediaPress?.(mediaTarget);
            }
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setMediaTarget(null);
            }
          }}
          target={mediaTarget === "cover" ? "banner" : "avatar"}
        />
      </Page.ScrollView>
    </Page>
  );
}
