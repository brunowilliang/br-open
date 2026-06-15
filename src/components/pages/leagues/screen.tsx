import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button, Menu, Tabs, useToast } from "heroui-native";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";

import { Categories } from "@/components/pages/leagues/categories";
import { Courts } from "@/components/pages/leagues/courts";
import { Details } from "@/components/pages/leagues/details";
import {
  LeagueSchema,
  type LeagueScreenValues,
} from "@/components/pages/leagues/form-schema";
import { resolveLeagueFormInvalidSubmission } from "@/components/pages/leagues/form-validation";
import { Location } from "@/components/pages/leagues/location";
import { Rules } from "@/components/pages/leagues/rules";
import { Settings } from "@/components/pages/leagues/settings";
import { HugeIcons } from "@/components/ui/huge-icons";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import {
  cropImage,
  type CroppedImage,
  ImageCropper,
  type ImageCropArea,
  type ImageCropAsset,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";

type LeagueMediaKind = "avatar" | "cover";

type LeagueMediaCropConfig = {
  aspectRatio: number;
  height: number;
  width: number;
};

type UploadedLeagueMedia = {
  previewUri: string;
  storageId: string;
};

type LeagueMediaUploadPhase = "parse_response" | "post_upload" | "read_file";

type LeagueMediaUploadErrorOptions = {
  cause?: unknown;
  details?: string;
  status?: number;
};

type LeagueScreenProps = {
  defaultValues: LeagueScreenValues;
  isPending?: boolean;
  isRulesLocked?: boolean;
  mediaUrls?: {
    avatarUrl?: string | null;
    coverUrl?: string | null;
  };
  mode: "create" | "edit";
  onDelete?: () => Promise<void>;
  onSubmit: (values: LeagueScreenValues) => Promise<void>;
  showDelete?: boolean;
  title: string;
};

class LeagueMediaUploadError extends Error {
  readonly cause?: unknown;
  readonly details?: string;
  readonly phase: LeagueMediaUploadPhase;
  readonly status?: number;

  constructor(
    phase: LeagueMediaUploadPhase,
    message: string,
    options: LeagueMediaUploadErrorOptions = {}
  ) {
    super(message);
    this.name = "LeagueMediaUploadError";
    this.cause = options.cause;
    this.details = options.details;
    this.phase = phase;
    this.status = options.status;
  }
}

const LEAGUE_MEDIA_CROP_CONFIG = {
  cover: {
    aspectRatio: 16 / 9,
    height: 900,
    width: 1600,
  },
  avatar: {
    aspectRatio: 1,
    height: 900,
    width: 900,
  },
} as const satisfies Record<LeagueMediaKind, LeagueMediaCropConfig>;

const DEFAULT_UPLOAD_ERROR_MESSAGE = "Não foi possível enviar a imagem.";

function buildLeagueMediaCropConfig(
  kind: LeagueMediaKind
): LeagueMediaCropConfig {
  return LEAGUE_MEDIA_CROP_CONFIG[kind];
}

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

function formatLeagueMediaUploadError(error: unknown): string {
  if (!(error instanceof LeagueMediaUploadError)) {
    return DEFAULT_UPLOAD_ERROR_MESSAGE;
  }

  if (typeof error.status === "number") {
    return `${error.message} Código HTTP: ${error.status}.`;
  }

  return error.message;
}

async function buildLeagueMediaUploadFile(fileUri: string) {
  try {
    const { File: ExpoFile } = await import("expo-file-system");
    return new ExpoFile(fileUri);
  } catch (error) {
    throw new LeagueMediaUploadError(
      "read_file",
      "Não foi possível ler o arquivo recortado no aparelho.",
      {
        cause: error,
      }
    );
  }
}

function readUploadErrorDetails(response: { body: string }) {
  return response.body.trim() || undefined;
}

async function uploadLeagueMedia(input: {
  file: CroppedImage;
  uploadUrl: string;
}): Promise<UploadedLeagueMedia> {
  const uploadFile = await buildLeagueMediaUploadFile(input.file.uri);
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
    throw new LeagueMediaUploadError(
      "post_upload",
      "Não foi possível enviar a imagem para o Convex Storage.",
      {
        cause: error,
      }
    );
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    const details = readUploadErrorDetails(uploadResponse);
    throw new LeagueMediaUploadError(
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
    throw new LeagueMediaUploadError(
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
    throw new LeagueMediaUploadError(
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

export function LeagueScreen(props: LeagueScreenProps) {
  const {
    defaultValues,
    isPending,
    isRulesLocked,
    mediaUrls,
    mode,
    onDelete,
    onSubmit,
    showDelete,
    title,
  } = props;
  const crpc = useCRPC();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<{
    avatar?: string;
    cover?: string;
  }>({});
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    Partial<Record<LeagueMediaKind, CroppedImage>>
  >({});
  const [cropRequest, setCropRequest] = useState<{
    asset: ImageCropAsset;
    kind: LeagueMediaKind;
  } | null>(null);
  const [uploadingMediaKind, setUploadingMediaKind] =
    useState<LeagueMediaKind | null>(null);

  const form = useForm<LeagueScreenValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(LeagueSchema),
  });
  const generateUploadUrl = useMutation(
    crpc.league.management.generateUploadUrl.mutationOptions()
  );

  const isMediaBusy = Boolean(uploadingMediaKind);
  const isSubmitPending =
    isPending || form.formState.isSubmitting || isMediaBusy;
  const cropConfig = cropRequest
    ? buildLeagueMediaCropConfig(cropRequest.kind)
    : null;

  const submitForm = form.handleSubmit(
    async (input) => {
      let inputWithUploadedMedia: LeagueScreenValues;

      try {
        inputWithUploadedMedia = await uploadPendingMedia(input);
      } catch (error) {
        toast.show({
          description: formatLeagueMediaUploadError(error),
          id: "league-media-submit-upload-error",
          label: "Erro no upload",
          variant: "danger",
        });
        return;
      }

      await onSubmit(inputWithUploadedMedia);
    },
    (errors) => {
      const invalidSubmission = resolveLeagueFormInvalidSubmission(errors);

      setActiveTab(invalidSubmission.tab);
      toast.show({
        description: invalidSubmission.description,
        id: `league-form-validation-${invalidSubmission.tab}`,
        label: invalidSubmission.label,
        variant: "danger",
      });
    }
  );

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  async function handleMediaPress(kind: LeagueMediaKind) {
    if (isSubmitPending) {
      return;
    }

    try {
      const asset = await pickImageCropAsset();

      if (!asset) {
        return;
      }

      setCropRequest({ asset, kind });
    } catch {
      toast.show({
        description: "Não foi possível abrir a biblioteca de imagens.",
        id: `league-${kind}-picker-error`,
        label: "Erro ao selecionar imagem",
        variant: "danger",
      });
    }
  }

  async function handleCropConfirm(cropArea: ImageCropArea) {
    if (!cropRequest) {
      return;
    }

    const { asset, kind } = cropRequest;

    setUploadingMediaKind(kind);

    try {
      const croppedFile = await cropImage({
        cropArea,
        sourceUri: asset.uri,
        target: buildLeagueMediaCropConfig(kind),
      });

      setPendingMediaFiles((current) => ({
        ...current,
        [kind]: croppedFile,
      }));
      setMediaPreviewUrls((current) => ({
        ...current,
        [kind]: croppedFile.uri,
      }));
      setCropRequest(null);
      toast.show({
        description: "A imagem será enviada quando você salvar a liga.",
        id: `league-${kind}-crop-success`,
        label: kind === "avatar" ? "Avatar pronto" : "Banner pronto",
        variant: "success",
      });
    } catch {
      toast.show({
        description: "Não foi possível recortar a imagem.",
        id: `league-${kind}-crop-error`,
        label: "Erro ao recortar imagem",
        variant: "danger",
      });
    } finally {
      setUploadingMediaKind(null);
    }
  }

  async function uploadPendingMedia(
    input: LeagueScreenValues
  ): Promise<LeagueScreenValues> {
    const mediaKinds: LeagueMediaKind[] = ["avatar", "cover"];
    let nextValues = input;

    for (const kind of mediaKinds) {
      const pendingFile = pendingMediaFiles[kind];

      if (!pendingFile) {
        continue;
      }

      const formField =
        kind === "avatar" ? "avatarStorageId" : "coverStorageId";

      setUploadingMediaKind(kind);

      try {
        const uploadUrl = await generateUploadUrl.mutateAsync({});
        const uploadedMedia = await uploadLeagueMedia({
          file: pendingFile,
          uploadUrl,
        });

        nextValues = {
          ...nextValues,
          [formField]: uploadedMedia.storageId,
        };
        form.setValue(formField, uploadedMedia.storageId, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        setPendingMediaFiles((current) => {
          const nextPendingFiles = { ...current };

          delete nextPendingFiles[kind];
          return nextPendingFiles;
        });
      } finally {
        setUploadingMediaKind(null);
      }
    }

    return nextValues;
  }

  return (
    <FormProvider {...form}>
      <Tabs
        className="flex-1"
        onValueChange={setActiveTab}
        value={activeTab}
        variant="primary"
      >
        <Page>
          <Page.Header>
            <View className="flex-1 flex-col gap-2">
              <View className="flex-1 flex-row">
                <Page.Header.Left>
                  <Page.Header.BackButton />
                </Page.Header.Left>
                <Page.Header.Center>
                  <Page.Header.Title>{title}</Page.Header.Title>
                </Page.Header.Center>
                <Page.Header.Right>
                  <Menu>
                    <Menu.Trigger asChild>
                      <Button isIconOnly size="sm" variant="ghost">
                        <HugeIcons icon={MoreVerticalIcon} />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Overlay />
                      <Menu.Content presentation="popover">
                        <Menu.Item onPress={handleSubmitPress}>
                          <Menu.ItemTitle className="flex-none">
                            Salvar
                          </Menu.ItemTitle>
                          <HugeIcons icon={CheckmarkCircle02Icon} />
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu>
                </Page.Header.Right>
              </View>
              <Tabs.List>
                <Tabs.ScrollView>
                  <Tabs.Indicator />
                  <Tabs.Trigger value="details">
                    <Tabs.Label>Detalhes</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="location">
                    <Tabs.Label>Localização</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="categories">
                    <Tabs.Label>Categorias</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="rules">
                    <Tabs.Label>Regras</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="courts">
                    <Tabs.Label>Quadras</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="settings">
                    <Tabs.Label>Configurações</Tabs.Label>
                  </Tabs.Trigger>
                </Tabs.ScrollView>
              </Tabs.List>
            </View>
          </Page.Header>

          <Page.KeyboardAwareScrollView contentContainerClassName="px-4 pb-safe-offset-4">
            <Tabs.Content className="gap-4" value="details">
              <Details
                avatarUrl={mediaPreviewUrls.avatar ?? mediaUrls?.avatarUrl}
                coverUrl={mediaPreviewUrls.cover ?? mediaUrls?.coverUrl}
                isDisabled={isSubmitPending}
                isMediaUploading={isMediaBusy}
                onMediaPress={handleMediaPress}
              />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="location">
              <Location isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="categories">
              <Categories isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="rules">
              <Rules
                isDisabled={isSubmitPending || isRulesLocked}
                isLocked={isRulesLocked}
              />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="courts">
              <Courts isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="settings">
              <Settings
                isDisabled={isSubmitPending}
                onDelete={onDelete}
                showDelete={mode === "edit" && (showDelete ?? true)}
              />
            </Tabs.Content>
          </Page.KeyboardAwareScrollView>
        </Page>
      </Tabs>
      <ImageCropper
        aspectRatio={cropConfig?.aspectRatio ?? null}
        asset={cropRequest?.asset ?? null}
        description="Arraste a foto e pince para dar zoom."
        isProcessing={isMediaBusy}
        onCancel={() => {
          if (!isMediaBusy) {
            setCropRequest(null);
          }
        }}
        onConfirm={handleCropConfirm}
        title={
          cropRequest?.kind === "avatar" ? "Ajustar avatar" : "Ajustar banner"
        }
      />
    </FormProvider>
  );
}
