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
import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
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
import {
  playerProfileSchema,
  upsertPlayerProfileSchema,
} from "@convex/domains/player/contract";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";
import { z } from "zod";

type UploadedPlayerAvatar = {
  previewUri: string;
  storageId: string;
};

type PlayerAvatarUploadPhase = "parse_response" | "post_upload" | "read_file";

type PlayerAvatarUploadErrorOptions = {
  cause?: unknown;
  details?: string;
  status?: number;
};

class PlayerAvatarUploadError extends Error {
  readonly cause?: unknown;
  readonly details?: string;
  readonly phase: PlayerAvatarUploadPhase;
  readonly status?: number;

  constructor(
    phase: PlayerAvatarUploadPhase,
    message: string,
    options: PlayerAvatarUploadErrorOptions = {}
  ) {
    super(message);
    this.name = "PlayerAvatarUploadError";
    this.cause = options.cause;
    this.details = options.details;
    this.phase = phase;
    this.status = options.status;
  }
}

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

const DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE = "Não foi possível enviar o avatar.";
const PLAYER_AVATAR_CROP_TARGET = {
  width: 900,
} as const;

function parseConvexUploadStorageId(response: unknown): string {
  if (
    typeof response === "object" &&
    response !== null &&
    "storageId" in response &&
    typeof response.storageId === "string" &&
    response.storageId.trim()
  ) {
    return response.storageId;
  }

  throw new Error("Convex upload response did not include a storage id.");
}

function formatPlayerAvatarUploadError(error: unknown): string {
  if (!(error instanceof PlayerAvatarUploadError)) {
    return DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE;
  }

  if (typeof error.status === "number") {
    return `${error.message} Código HTTP: ${error.status}.`;
  }

  return error.message;
}

async function buildPlayerAvatarUploadFile(fileUri: string) {
  try {
    const { File: ExpoFile } = await import("expo-file-system");

    return new ExpoFile(fileUri);
  } catch (error) {
    throw new PlayerAvatarUploadError(
      "read_file",
      "Não foi possível ler o avatar recortado no aparelho.",
      {
        cause: error,
      }
    );
  }
}

function readUploadErrorDetails(response: { body: string }) {
  return response.body.trim() || undefined;
}

async function uploadPlayerAvatar(input: {
  file: CroppedImage;
  uploadUrl: string;
}): Promise<UploadedPlayerAvatar> {
  const uploadFile = await buildPlayerAvatarUploadFile(input.file.uri);
  const { UploadType } = await import("expo-file-system");
  const contentType = input.file.mimeType || "image/jpeg";

  let uploadResponse: Awaited<ReturnType<typeof uploadFile.upload>>;

  try {
    uploadResponse = await uploadFile.upload(input.uploadUrl, {
      headers: {
        "Content-Type": contentType,
      },
      httpMethod: "POST",
      mimeType: contentType,
      uploadType: UploadType.BINARY_CONTENT,
    });
  } catch (error) {
    throw new PlayerAvatarUploadError(
      "post_upload",
      "Não foi possível enviar o avatar para o Convex Storage.",
      {
        cause: error,
      }
    );
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    const details = readUploadErrorDetails(uploadResponse);

    throw new PlayerAvatarUploadError(
      "post_upload",
      "O Convex Storage recusou o upload.",
      {
        details,
        status: uploadResponse.status,
      }
    );
  }

  let uploadResponseBody: unknown;

  try {
    uploadResponseBody = JSON.parse(uploadResponse.body);
  } catch (error) {
    throw new PlayerAvatarUploadError(
      "parse_response",
      "O Convex Storage respondeu com um payload inválido.",
      {
        cause: error,
      }
    );
  }

  let storageId: string;

  try {
    storageId = parseConvexUploadStorageId(uploadResponseBody);
  } catch (error) {
    throw new PlayerAvatarUploadError(
      "parse_response",
      "O Convex Storage respondeu sem um storageId válido.",
      {
        cause: error,
      }
    );
  }

  return {
    previewUri: input.file.uri,
    storageId,
  };
}

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
    } catch (error) {
      toast.show({
        description: formatPlayerAvatarUploadError(error),
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
      const uploadedAvatar = await uploadPlayerAvatar({
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

  if (playerProfile.isPending) {
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Perfil</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>

        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <LoadingState />
        </Page.ScrollView>
      </Page>
    );
  }

  if (playerProfile.isError) {
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Perfil</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>

        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <ErrorState
            error={playerProfile.error}
            message="Não foi possível carregar o perfil."
          />
        </Page.ScrollView>
      </Page>
    );
  }

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Perfil</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
        <Page.KeyboardAwareScrollView contentContainerClassName="items-center gap-2 px-4 w-full">
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
              <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
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
        </Page.KeyboardAwareScrollView>
        <Page.Footer>
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
      </Page>
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
    </>
  );
}
