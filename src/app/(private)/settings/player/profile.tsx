import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  FieldError,
  Input,
  Label,
  PressableFeedback,
  Select,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  cropImage,
  type CroppedImage,
  type ImageCropArea,
  type ImageCropAsset,
  ImageCropper,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
import {
  playerProfileSchema,
  upsertPlayerProfileSchema,
} from "@convex/domains/player/contract";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";
import { z } from "zod";

const PlayerProfileFormSchema = z
  .object({
    avatarDraftUri: z.string().optional(),
    avatarStorageId: upsertPlayerProfileSchema.shape.avatarStorageId,
    fullName: playerProfileSchema.shape.fullName,
    gender: playerProfileSchema.shape.gender.optional(),
    nickname: playerProfileSchema.shape.nickname,
    phone: z.string().nullable().optional(),
  })
  .pipe(upsertPlayerProfileSchema);

type PlayerProfileFormValues = z.input<typeof PlayerProfileFormSchema>;
type PlayerProfileValues = z.output<typeof PlayerProfileFormSchema>;

const defaultValues: PlayerProfileFormValues = {
  avatarDraftUri: undefined,
  avatarStorageId: null,
  fullName: "",
  gender: undefined,
  nickname: "",
  phone: "",
};

const genderOptions = [
  { label: "Masculino", value: "Masculino" as const },
  { label: "Feminino", value: "Feminino" as const },
];

const PLAYER_AVATAR_CROP_TARGET = {
  width: 900,
} as const;

export default function PlayerProfile() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const playerProfile = useQuery(crpc.player.profile.get.queryOptions());
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<ImageCropAsset | null>(null);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] =
    useState<CroppedImage | null>(null);

  const form = useForm<PlayerProfileFormValues, unknown, PlayerProfileValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(PlayerProfileFormSchema),
  });
  const generateUploadUrl = useMutation(
    crpc.player.profile.generateUploadUrl.mutationOptions()
  );

  useEffect(() => {
    if (!playerProfile.data) {
      return;
    }

    form.reset({
      ...playerProfile.data,
      avatarDraftUri: undefined,
    });
    form.trigger().catch(() => undefined);
  }, [form, playerProfile.data]);

  const updateProfile = useMutation(
    crpc.player.profile.upsert.mutationOptions({
      onSuccess: async (nextProfile) => {
        await queryClient.invalidateQueries(
          crpc.player.profile.get.queryFilter()
        );
        form.reset({
          ...nextProfile,
          avatarDraftUri: undefined,
        });
        await form.trigger();
        setAvatarPreviewUri(null);
        setPendingAvatarFile(null);
        toast.show({
          description: "Perfil atualizado com sucesso.",
          id: "update-player-profile-success",
          label: "Perfil atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar o perfil."
          ),
          id: "update-player-profile-error",
          label: "Erro ao atualizar perfil",
          variant: "danger",
        });
      },
    })
  );

  const isSubmitPending =
    updateProfile.isPending ||
    generateUploadUrl.isPending ||
    form.formState.isSubmitting ||
    isAvatarProcessing ||
    playerProfile.isPending;
  const canSubmit =
    (form.formState.isDirty || Boolean(pendingAvatarFile)) &&
    form.formState.isValid &&
    !isSubmitPending;
  const displayName = form.watch("fullName") || "Seu perfil";
  const avatarSource =
    avatarPreviewUri ?? playerProfile.data?.avatarUrl ?? undefined;

  const submitForm = form.handleSubmit(async (values) => {
    updateProfile.reset();

    let valuesWithAvatar: PlayerProfileValues;

    try {
      valuesWithAvatar = await uploadPendingAvatar(values);
    } catch {
      toast.show({
        description: "Não foi possível enviar o avatar.",
        id: "player-avatar-submit-upload-error",
        label: "Erro no upload",
        variant: "danger",
      });
      return;
    }

    await updateProfile.mutateAsync(valuesWithAvatar);
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  async function handleAvatarPress() {
    if (isSubmitPending) {
      return;
    }

    try {
      const asset = await pickImageCropAsset();

      if (!asset) {
        return;
      }

      setCropAsset(asset);
    } catch {
      toast.show({
        description: "Não foi possível abrir a biblioteca de imagens.",
        id: "player-avatar-picker-error",
        label: "Erro ao selecionar imagem",
        variant: "danger",
      });
    }
  }

  async function handleCropConfirm(cropArea: ImageCropArea) {
    if (!cropAsset) {
      return;
    }

    setIsAvatarProcessing(true);

    try {
      const croppedFile = await cropImage({
        cropArea,
        sourceUri: cropAsset.uri,
        target: PLAYER_AVATAR_CROP_TARGET,
      });

      setPendingAvatarFile(croppedFile);
      setAvatarPreviewUri(croppedFile.uri);
      form.setValue("avatarDraftUri", croppedFile.uri, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      await form.trigger();
      setCropAsset(null);
      toast.show({
        description: "O avatar será enviado quando você salvar o perfil.",
        id: "player-avatar-crop-success",
        label: "Avatar pronto",
        variant: "success",
      });
    } catch {
      toast.show({
        description: "Não foi possível recortar o avatar.",
        id: "player-avatar-crop-error",
        label: "Erro ao recortar imagem",
        variant: "danger",
      });
    } finally {
      setIsAvatarProcessing(false);
    }
  }

  async function uploadPendingAvatar(input: PlayerProfileValues) {
    if (!pendingAvatarFile) {
      return input;
    }

    setIsAvatarProcessing(true);

    try {
      const uploadUrl = await generateUploadUrl.mutateAsync({});
      const uploadedAvatar = await uploadImageToStorage({
        file: pendingAvatarFile,
        uploadUrl,
      });
      const nextValues = {
        ...input,
        avatarStorageId: uploadedAvatar.storageId,
      };

      form.setValue("avatarStorageId", uploadedAvatar.storageId, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue("avatarDraftUri", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      setPendingAvatarFile(null);

      return nextValues;
    } finally {
      setIsAvatarProcessing(false);
    }
  }

  const isProfileError = playerProfile.isError;
  const isProfileLoading = playerProfile.isPending;
  const isProfileLoaded = !(isProfileLoading || isProfileError);

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Perfil do jogador</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>

        {isProfileLoading && (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <LoadingState />
          </Page.ScrollView>
        )}
        {isProfileError && (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <ErrorState
              error={playerProfile.error}
              message="Não foi possível carregar o perfil."
            />
          </Page.ScrollView>
        )}
        {isProfileLoaded && (
          <>
            <Page.ScrollView contentContainerClassName="items-center gap-2 px-4 w-full">
              <PressableFeedback
                className="rounded-full"
                isDisabled={isSubmitPending}
                onPress={handleAvatarPress}
              >
                <Image
                  alt={displayName}
                  className="size-30 rounded-full"
                  fallback="green"
                  source={avatarSource}
                />
                <View className="centered absolute inset-0 bg-black/45">
                  <HugeIcons
                    className="size-6 text-white"
                    icon={ImageUploadIcon}
                  />
                  <Text className="text-white" variant="description">
                    {isSubmitPending ? "Salvando..." : "Alterar Avatar"}
                  </Text>
                </View>
                <PressableFeedback.Highlight />
              </PressableFeedback>
              <Text className="text-xl">{displayName}</Text>
              <Controller
                control={form.control}
                name="fullName"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Nome completo</Label>
                    <Input
                      autoCapitalize="words"
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Seu nome completo"
                      textContentType="name"
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="nickname"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Apelido</Label>
                    <Input
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Seu apelido"
                      textContentType="nickname"
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="gender"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Gênero</Label>

                    <Select
                      isDisabled={isSubmitPending}
                      onValueChange={(nextValue) => {
                        if (nextValue && !Array.isArray(nextValue)) {
                          form.setValue(
                            "gender",
                            nextValue.value as PlayerProfileFormValues["gender"],
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            }
                          );
                        }
                      }}
                      selectionMode="single"
                      value={genderOptions.find(
                        (option) => option.value === field.value
                      )}
                    >
                      <Select.Trigger>
                        <Select.Value
                          className="font-normal"
                          numberOfLines={1}
                          placeholder="Escolha uma opção"
                        />
                        <Select.TriggerIndicator />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" width="trigger">
                          <Select.ListLabel className="mb-2">
                            Escolha uma opção
                          </Select.ListLabel>
                          {genderOptions.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                  >
                    <Label>Telefone/WhatsApp</Label>
                    <Input
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      onSubmitEditing={handleSubmitPress}
                      placeholder="(00) 00000-0000"
                      textContentType="telephoneNumber"
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />
            </Page.ScrollView>
            <Page.Footer className="px-4 pb-safe-offset-4">
              <Button
                className="w-full"
                isDisabled={!canSubmit}
                onPress={handleSubmitPress}
              >
                <Button.Label>
                  {isSubmitPending ? "Salvando..." : "Salvar alterações"}
                </Button.Label>
              </Button>
            </Page.Footer>
          </>
        )}
      </Page>
      {isProfileLoaded ? (
        <ImageCropper
          aspectRatio={1}
          asset={cropAsset}
          description="Arraste a foto e pince para dar zoom."
          isProcessing={isAvatarProcessing}
          onCancel={() => {
            if (!isAvatarProcessing) {
              setCropAsset(null);
            }
          }}
          onConfirm={handleCropConfirm}
          title="Ajustar avatar"
        />
      ) : null}
    </>
  );
}
