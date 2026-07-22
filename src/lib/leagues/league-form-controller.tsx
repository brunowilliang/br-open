import { zodResolver } from "@hookform/resolvers/zod";
import { useValue } from "@legendapp/state/react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";

import {
  LeagueSchema,
  type LeagueScreenValues,
} from "@/components/pages/leagues/form-schema";
import { resolveLeagueFormInvalidSubmission } from "@/components/pages/leagues/form-validation";
import {
  getLeagueFormBucket$,
  type LeagueFormMode,
  type LeagueMediaKind,
} from "@/lib/leagues/league-form-store";
import { useCRPC } from "@/lib/convex/crpc";
import {
  cropImage,
  ImageCropper,
  type ImageCropArea,
  type ImageCropperProps,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
import type { LeagueFormTabValue } from "@/lib/leagues/league-form-navigation";

type LeagueMediaCropConfig = {
  aspectRatio: number;
  height: number;
  width: number;
};

type LeagueFormControllerOptions = {
  defaultValues: LeagueScreenValues;
  isPending?: boolean;
  isRulesLocked?: boolean;
  mediaUrls?: {
    avatarUrl?: string | null;
    coverUrl?: string | null;
  };
  mode: LeagueFormMode;
  onDelete?: () => Promise<void>;
  onSubmit: (values: LeagueScreenValues) => Promise<void>;
  onValidationTabRequest: (tab: LeagueFormTabValue) => void;
  sessionKey: string;
  showDelete?: boolean;
  title: string;
};

type LeagueFormController = {
  form: UseFormReturn<LeagueScreenValues>;
  cropper: Pick<
    ImageCropperProps,
    | "asset"
    | "aspectRatio"
    | "description"
    | "isProcessing"
    | "onCancel"
    | "onConfirm"
    | "title"
  >;
};

const LEAGUE_MEDIA_CROP_CONFIG = {
  avatar: {
    aspectRatio: 1,
    height: 900,
    width: 900,
  },
  cover: {
    aspectRatio: 16 / 9,
    height: 900,
    width: 1600,
  },
} as const satisfies Record<LeagueMediaKind, LeagueMediaCropConfig>;

const LEAGUE_MEDIA_KINDS: LeagueMediaKind[] = ["avatar", "cover"];

function buildLeagueMediaCropConfig(
  kind: LeagueMediaKind
): LeagueMediaCropConfig {
  return LEAGUE_MEDIA_CROP_CONFIG[kind];
}

export function useLeagueFormController(
  options: LeagueFormControllerOptions
): LeagueFormController {
  const {
    defaultValues,
    isPending,
    isRulesLocked,
    mediaUrls,
    mode,
    onDelete,
    onSubmit,
    onValidationTabRequest,
    sessionKey,
    showDelete,
    title,
  } = options;
  const crpc = useCRPC();
  const { toast } = useToast();
  const bucket$ = getLeagueFormBucket$(sessionKey);
  const form = useForm<LeagueScreenValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(LeagueSchema),
    reValidateMode: "onChange",
  });
  const generateUploadUrl = useMutation(
    crpc.league.management.generateUploadUrl.mutationOptions()
  );
  const isFormSubmitting = form.formState.isSubmitting;
  const cropRequest = useValue(bucket$.crop.request);
  const isMediaBusy = useValue(bucket$.derived.isMediaBusy);
  const cropConfig = cropRequest
    ? buildLeagueMediaCropConfig(cropRequest.kind)
    : null;

  useEffect(() => {
    bucket$.actions.configure({
      avatarUrl: mediaUrls?.avatarUrl,
      coverUrl: mediaUrls?.coverUrl,
      externalPending: isPending,
      isRulesLocked,
      mode,
      showDelete,
      title,
    });
  }, [
    bucket$,
    isPending,
    isRulesLocked,
    mediaUrls?.avatarUrl,
    mediaUrls?.coverUrl,
    mode,
    showDelete,
    title,
  ]);

  // Reset the form + clear pending media only when defaultValues actually
  // change by value, not on every parent re-render (callers rebuild the
  // defaultValues object each render, which would wipe in-progress edits).
  // Genuine league changes are also handled by the key-based remount in the
  // settings layout, so this only needs to cover the content-change case.
  const previousDefaultValuesRef = useRef(defaultValues);
  useEffect(() => {
    if (previousDefaultValuesRef.current === defaultValues) {
      return;
    }
    previousDefaultValuesRef.current = defaultValues;
    form.reset(defaultValues);
    bucket$.actions.clearMedia();
  }, [bucket$, defaultValues, form]);

  useEffect(() => {
    bucket$.actions.setFormSubmitting(isFormSubmitting);
  }, [bucket$, isFormSubmitting]);

  const uploadPendingMedia = useCallback(
    async (input: LeagueScreenValues): Promise<LeagueScreenValues> => {
      let nextValues = input;

      for (const kind of LEAGUE_MEDIA_KINDS) {
        const pendingFile = bucket$.media.pendingFiles[kind].get();

        if (!pendingFile) {
          continue;
        }

        const formField =
          kind === "avatar" ? "avatarStorageId" : "coverStorageId";

        bucket$.actions.setUploadingMediaKind(kind);

        try {
          const uploadUrl = await generateUploadUrl.mutateAsync({});
          const uploadedMedia = await uploadImageToStorage({
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
          bucket$.actions.setPendingMediaFile(kind, null);
        } finally {
          bucket$.actions.setUploadingMediaKind(null);
        }
      }

      return nextValues;
    },
    [bucket$, form, generateUploadUrl]
  );

  const submitForm = form.handleSubmit(
    async (input) => {
      let inputWithUploadedMedia: LeagueScreenValues;

      try {
        inputWithUploadedMedia = await uploadPendingMedia(input);
      } catch {
        toast.show({
          description:
            "Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.",
          id: "league-media-submit-upload-error",
          label: "Falha no envio da imagem",
          variant: "danger",
        });
        return;
      }

      await onSubmit(inputWithUploadedMedia);
    },
    (errors) => {
      const invalidSubmission = resolveLeagueFormInvalidSubmission(errors);

      onValidationTabRequest(invalidSubmission.tab);
      toast.show({
        description: invalidSubmission.description,
        id: `league-form-validation-${invalidSubmission.tab}`,
        label: invalidSubmission.label,
        variant: "danger",
      });
    }
  );

  const handleSubmitPress = useCallback(() => {
    submitForm().catch(() => undefined);
  }, [submitForm]);

  const handleMediaPress = useCallback(
    async (kind: LeagueMediaKind) => {
      if (bucket$.derived.isSubmitPending.get()) {
        return;
      }

      try {
        const asset = await pickImageCropAsset();

        if (!asset) {
          return;
        }

        bucket$.actions.setCropRequest({ asset, kind });
      } catch {
        toast.show({
          description:
            "Não foi possível abrir a galeria de fotos. Confira as permissões do app.",
          id: `league-${kind}-picker-error`,
          label: "Sem acesso à galeria",
          variant: "danger",
        });
      }
    },
    [bucket$, toast]
  );

  const handleCropConfirm = useCallback(
    async (cropArea: ImageCropArea) => {
      const currentCropRequest = bucket$.crop.request.get();

      if (!currentCropRequest) {
        return;
      }

      const { asset, kind } = currentCropRequest;

      bucket$.actions.setUploadingMediaKind(kind);

      try {
        const croppedFile = await cropImage({
          cropArea,
          sourceUri: asset.uri,
          target: buildLeagueMediaCropConfig(kind),
        });

        bucket$.actions.setPendingMediaFile(kind, croppedFile);
        bucket$.actions.setMediaPreviewUrl(kind, croppedFile.uri);
        bucket$.actions.setCropRequest(null);
        toast.show({
          description: "A imagem será enviada quando você salvar a liga.",
          id: `league-${kind}-crop-success`,
          label: kind === "avatar" ? "Avatar ajustado" : "Banner ajustado",
          variant: "success",
        });
      } catch {
        toast.show({
          description: "Não foi possível recortar a imagem. Tente novamente.",
          id: `league-${kind}-crop-error`,
          label: "Falha ao ajustar imagem",
          variant: "danger",
        });
      } finally {
        bucket$.actions.setUploadingMediaKind(null);
      }
    },
    [bucket$, toast]
  );

  useEffect(() => {
    bucket$.actions.registerCallbacks({
      onDelete,
      onMediaPress: handleMediaPress,
      onSubmitPress: handleSubmitPress,
    });

    return () => {
      bucket$.actions.unregisterCallbacks();
    };
  }, [bucket$, handleMediaPress, handleSubmitPress, onDelete]);

  // Free the bucket + its callback closures on unmount so they don't leak in
  // the module-scoped maps (they capture form/toast props). A remount will
  // recreate the bucket lazily.
  useEffect(
    () => () => {
      bucket$.actions.dispose();
    },
    [bucket$]
  );

  return {
    cropper: {
      aspectRatio: cropConfig?.aspectRatio ?? null,
      asset: cropRequest?.asset ?? null,
      description: "Arraste a foto e pince para dar zoom.",
      isProcessing: isMediaBusy,
      onCancel: () => {
        if (!bucket$.derived.isMediaBusy.get()) {
          bucket$.actions.setCropRequest(null);
        }
      },
      onConfirm: handleCropConfirm,
      title:
        cropRequest?.kind === "avatar" ? "Ajustar avatar" : "Ajustar banner",
    },
    form,
  };
}

export function LeagueFormHost(props: {
  children: ReactNode;
  controller: LeagueFormController;
}) {
  return (
    <FormProvider {...props.controller.form}>
      {props.children}
      <ImageCropper {...props.controller.cropper} />
    </FormProvider>
  );
}
