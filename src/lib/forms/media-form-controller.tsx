import type {
  DefaultValues,
  FieldValues,
  Path,
  Resolver,
} from "react-hook-form";
import { useValue } from "@legendapp/state/react";
import { useToast } from "heroui-native";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  FormProvider,
  useForm,
  type FieldErrors,
  type UseFormReturn,
} from "react-hook-form";

import {
  cropImage,
  ImageCropper,
  type ImageCropArea,
  type ImageCropperProps,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
import type {
  MediaFormDomain,
  MediaFormKind,
} from "@/lib/forms/media-form-store";

type MediaCropConfig = {
  aspectRatio: number;
  height: number;
  width: number;
};

export type MediaFormValues = {
  avatarStorageId: null | string;
  coverStorageId: null | string;
};

type MediaFormValuesField = MediaFormValues & FieldValues;

export type MediaFormControllerOptions<TValues extends MediaFormValuesField> = {
  defaultValues: TValues;
  domain: MediaFormDomain;
  /** Toast copy scope: "A imagem será enviada quando você salvar a liga." */
  entityLabel: string;
  generateUploadUrl: () => Promise<string>;
  isPending?: boolean;
  /** Domain-specific lock flag — only the league wizard (rules tab) uses it. */
  isRulesLocked?: boolean;
  mediaUrls?: {
    avatarUrl?: null | string;
    coverUrl?: null | string;
  };
  mode: "create" | "edit";
  onDelete?: () => Promise<void>;
  onInvalidSubmit: (errors: FieldErrors<TValues>) => void;
  onSubmit: (values: TValues) => Promise<void>;
  /** Pre-resolved RHF resolver (zodResolver of the domain schema). */
  resolver: Resolver<TValues>;
  sessionKey: string;
  showDelete?: boolean;
  title: string;
  toastScope: string;
};

export type MediaFormController<TValues extends MediaFormValues & FieldValues> =
  {
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
    form: UseFormReturn<TValues, unknown, TValues>;
  };

const MEDIA_CROP_CONFIG = {
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
} as const satisfies Record<MediaFormKind, MediaCropConfig>;

const MEDIA_KINDS: MediaFormKind[] = ["avatar", "cover"];

export function useMediaFormController<TValues extends MediaFormValuesField>(
  options: MediaFormControllerOptions<TValues>
): MediaFormController<TValues> {
  const {
    defaultValues,
    domain,
    entityLabel,
    generateUploadUrl,
    isPending,
    isRulesLocked,
    mediaUrls,
    mode,
    onDelete,
    onInvalidSubmit,
    onSubmit,
    resolver,
    sessionKey,
    showDelete,
    title,
    toastScope,
  } = options;
  const { toast } = useToast();
  const bucket$ = domain.getBucket$(sessionKey);
  const form = useForm<TValues, unknown, TValues>({
    defaultValues: defaultValues as DefaultValues<TValues>,
    mode: "onBlur",
    resolver: resolver as Resolver<TValues, unknown, TValues>,
    reValidateMode: "onChange",
  });
  const isFormSubmitting = form.formState.isSubmitting;
  const cropRequest = useValue(bucket$.crop.request);
  const isMediaBusy = useValue(bucket$.derived.isMediaBusy);
  const cropConfig = cropRequest ? MEDIA_CROP_CONFIG[cropRequest.kind] : null;

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
    async (input: TValues): Promise<TValues> => {
      let nextValues = input;

      for (const kind of MEDIA_KINDS) {
        const pendingFile = bucket$.media.pendingFiles[kind].get();

        if (!pendingFile) {
          continue;
        }

        const formField =
          kind === "avatar" ? "avatarStorageId" : "coverStorageId";

        bucket$.actions.setUploadingMediaKind(kind);

        try {
          const uploadUrl = await generateUploadUrl();
          const uploadedMedia = await uploadImageToStorage({
            file: pendingFile,
            uploadUrl,
          });

          nextValues = {
            ...nextValues,
            [formField]: uploadedMedia.storageId,
          } as TValues;
          form.setValue(
            formField as Path<TValues>,
            uploadedMedia.storageId as never,
            {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            }
          );
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
      let inputWithUploadedMedia: TValues;

      try {
        inputWithUploadedMedia = await uploadPendingMedia(input);
      } catch {
        toast.show({
          description:
            "Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.",
          id: `${toastScope}-media-submit-upload-error`,
          label: "Falha no envio da imagem",
          variant: "danger",
        });
        return;
      }

      await onSubmit(inputWithUploadedMedia);
    },
    (errors) => {
      onInvalidSubmit(errors);
    }
  );

  const handleSubmitPress = useCallback(() => {
    submitForm().catch(() => undefined);
  }, [submitForm]);

  const handleMediaPress = useCallback(
    async (kind: MediaFormKind) => {
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
          id: `${toastScope}-${kind}-picker-error`,
          label: "Sem acesso à galeria",
          variant: "danger",
        });
      }
    },
    [bucket$, toast, toastScope]
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
          target: MEDIA_CROP_CONFIG[kind],
        });

        bucket$.actions.setPendingMediaFile(kind, croppedFile);
        bucket$.actions.setMediaPreviewUrl(kind, croppedFile.uri);
        bucket$.actions.setCropRequest(null);
        toast.show({
          description: `A imagem será enviada quando você salvar ${entityLabel}.`,
          id: `${toastScope}-${kind}-crop-success`,
          label: kind === "avatar" ? "Avatar ajustado" : "Banner ajustado",
          variant: "success",
        });
      } catch {
        toast.show({
          description: "Não foi possível recortar a imagem. Tente novamente.",
          id: `${toastScope}-${kind}-crop-error`,
          label: "Falha ao ajustar imagem",
          variant: "danger",
        });
      } finally {
        bucket$.actions.setUploadingMediaKind(null);
      }
    },
    [bucket$, entityLabel, toast, toastScope]
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

export function MediaFormHost<TValues extends MediaFormValuesField>(props: {
  children: ReactNode;
  controller: MediaFormController<TValues>;
}) {
  return (
    <FormProvider {...props.controller.form}>
      {props.children}
      <ImageCropper {...props.controller.cropper} />
    </FormProvider>
  );
}
