import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Accordion,
  AccordionLayoutTransition,
  Button,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import Animated from "react-native-reanimated";

import { Page } from "@/components/core/NewPage";
import { ErrorState } from "@/components/ui/error-state";
import { ExpandableSection } from "@/components/ui/expandable-section";
import { ChangePasswordDialog } from "@/components/pages/player/change-password-dialog";
import { LinkedAccountsSection } from "@/components/pages/player/linked-accounts-section";
import {
  ProfileDetailsSection,
  type ProfileDetailsFormValues,
} from "@/components/pages/player/profile-details-section";
import { ProfileSecuritySection } from "@/components/pages/player/profile-security-section";
import { LoadingState } from "@/components/ui/loading-state";
import {
  authAccountsQueryKey,
  type AuthAccount,
} from "@/lib/account/linked-accounts";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getSecurityErrorMessage } from "@/lib/account/security-errors";
import {
  USERNAME_CANNOT_REMOVE_MESSAGE,
  normalizeUsername,
  resolveUsernameSubmitIssue,
  validateUsernameFormat,
} from "@/lib/account/username-rules";
import { useUsernameAvailability } from "@/lib/account/use-username-availability";
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
import { z } from "zod";

const PlayerProfileFormSchema = z
  .object({
    avatarDraftUri: z.string().optional(),
    avatarStorageId: upsertPlayerProfileSchema.shape.avatarStorageId,
    fullName: playerProfileSchema.shape.fullName,
    gender: playerProfileSchema.shape.gender.optional(),
    nickname: playerProfileSchema.shape.nickname,
    phone: z.string().nullable().optional(),
    username: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value) {
          return;
        }

        const message = validateUsernameFormat(value);

        if (message) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        }
      }),
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
  username: "",
};

const PLAYER_AVATAR_CROP_TARGET = {
  width: 900,
} as const;

export default function PlayerProfile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ firstRun?: string }>();
  const isFirstRun = params.firstRun === "true";
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const playerProfile = useQuery(crpc.player.profile.get.staticQueryOptions());
  const session = authClient.useSession();
  const currentUsername = session.data?.user?.username ?? "";
  const accounts = useQuery({
    queryFn: async (): Promise<AuthAccount[]> => {
      const { data, error } = await authClient.listAccounts();

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    queryKey: authAccountsQueryKey,
  });
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<ImageCropAsset | null>(null);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] =
    useState<CroppedImage | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isUsernameUpdatePending, setIsUsernameUpdatePending] = useState(false);

  const form = useForm<PlayerProfileFormValues, unknown, PlayerProfileValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(PlayerProfileFormSchema),
    reValidateMode: "onChange",
  });
  const generateUploadUrl = useMutation({
    mutationFn: crpcClient.player.profile.generateUploadUrl.mutate,
    mutationKey: crpc.player.profile.generateUploadUrl.mutationKey(),
  });

  useEffect(() => {
    if (!playerProfile.data) {
      return;
    }

    form.reset({
      ...playerProfile.data,
      avatarDraftUri: undefined,
      username: currentUsername,
    });
    form.trigger().catch(() => undefined);
  }, [currentUsername, form, playerProfile.data]);

  const updateProfile = useMutation({
    mutationFn: crpcClient.player.profile.upsert.mutate,
    mutationKey: crpc.player.profile.upsert.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível salvar suas alterações. Tente novamente."
        ),
        id: "update-player-profile-error",
        label: "Falha ao salvar perfil",
        variant: "danger",
      });
    },
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
        description: isFirstRun
          ? "Seu perfil foi criado. Bem-vindo ao BR Open!"
          : "Suas alterações já estão visíveis para outros jogadores.",
        id: "update-player-profile-success",
        label: "Perfil salvo",
        variant: "success",
      });
      if (isFirstRun) {
        router.replace("/");
      }
    },
  });

  const isSubmitPending =
    updateProfile.isPending ||
    generateUploadUrl.isPending ||
    form.formState.isSubmitting ||
    isAvatarProcessing ||
    isUsernameUpdatePending ||
    playerProfile.isPending;
  const canSubmit =
    (form.formState.isDirty || Boolean(pendingAvatarFile)) &&
    form.formState.isValid &&
    !isSubmitPending;
  const avatarSource =
    avatarPreviewUri ?? playerProfile.data?.avatarUrl ?? undefined;

  const submitForm = form.handleSubmit(async (values) => {
    updateProfile.reset();

    const usernameIssue = resolveUsernameSubmitIssue({
      currentUsername,
      value: form.getValues("username") ?? "",
    });

    if (usernameIssue === "cannot_remove") {
      form.setError("username", {
        message: USERNAME_CANNOT_REMOVE_MESSAGE,
        type: "manual",
      });
      return;
    }

    let didUpdateUsername = false;
    const nextUsername = normalizeUsername(form.getValues("username") ?? "");

    if (nextUsername && nextUsername !== normalizeUsername(currentUsername)) {
      setIsUsernameUpdatePending(true);
      const { error } = await authClient.updateUser({
        username: nextUsername,
      });
      setIsUsernameUpdatePending(false);

      if (error) {
        const message = getSecurityErrorMessage(
          error,
          "Não foi possível salvar seu username. Tente novamente."
        );

        form.setError("username", { message, type: "manual" });
        toast.show({
          description: message,
          id: "update-username-error",
          label: "Falha ao salvar username",
          variant: "danger",
        });
        return;
      }

      form.setValue("username", nextUsername, { shouldDirty: false });
      didUpdateUsername = true;
    }

    let valuesWithAvatar: PlayerProfileValues;

    try {
      valuesWithAvatar = await uploadPendingAvatar(values);
    } catch {
      toast.show({
        description:
          "Não foi possível enviar o avatar. Verifique sua conexão e tente novamente.",
        id: "player-avatar-submit-upload-error",
        label: "Falha no envio da foto",
        variant: "danger",
      });
      return;
    }

    await updateProfile.mutateAsync(valuesWithAvatar);

    // Refetch só no FIM do submit: no meio, o efeito de hidratação reagiria
    // com playerProfile.data stale (ainda não invalidado) e reverteria no
    // form edições não salvas se uma etapa posterior falhasse.
    if (didUpdateUsername) {
      await session.refetch();
    }
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
        description:
          "Não foi possível abrir a galeria de fotos. Confira as permissões do app.",
        id: "player-avatar-picker-error",
        label: "Sem acesso à galeria",
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
        label: "Foto ajustada",
        variant: "success",
      });
    } catch {
      toast.show({
        description: "Não foi possível recortar a imagem. Tente novamente.",
        id: "player-avatar-crop-error",
        label: "Falha ao ajustar foto",
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
  const currentEmail = session.data?.user?.email;
  const accountRows = accounts.data ?? [];
  const usernameStatus = useUsernameAvailability({
    currentUsername,
    value: form.watch("username") ?? "",
  });

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            {isFirstRun ? null : <Page.Header.BackButton />}
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>
              {isFirstRun ? "Complete seu perfil" : "Perfil do jogador"}
            </Page.Header.Title>
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
            <Page.ScrollView contentContainerClassName="px-4 pb-safe-offset-4">
              <Animated.View
                className="gap-3"
                layout={AccordionLayoutTransition}
              >
                <Accordion
                  defaultValue="detalhes"
                  selectionMode="single"
                  variant="surface"
                >
                  {/* ---- Detalhes (form atual completo) ---- */}
                  <ExpandableSection
                    description="Avatar, nome, apelido e contato."
                    sectionKey="detalhes"
                    title="Detalhes"
                  >
                    {/* Cast do form justificado: o form da rota é tipado
                        pelo schema COMPLETO com `.pipe` (TInput ≠ TOutput —
                        o zodResolver transforma os valores no submit),
                        enquanto a seção espera o UseFormReturn simples do
                        subset que ela renderiza; os campos compartilhados
                        têm o mesmo shape de entrada e a seção só lê/escreve
                        esses campos — cast seguro. */}
                    <ProfileDetailsSection
                      avatarSource={avatarSource}
                      form={
                        form as unknown as UseFormReturn<ProfileDetailsFormValues>
                      }
                      isSubmitPending={isSubmitPending}
                      onAvatarPress={handleAvatarPress}
                      onPhoneSubmitEditing={handleSubmitPress}
                      usernameStatus={usernameStatus}
                    />
                  </ExpandableSection>

                  {/* ---- Segurança (senha, e-mail) ---- */}
                  <ExpandableSection
                    contentClassName="pb-0"
                    description="Proteja o acesso à sua conta."
                    sectionKey="seguranca"
                    title="Segurança"
                  >
                    {accounts.isPending ? (
                      <LoadingState />
                    ) : accounts.isError ? (
                      <ErrorState
                        error={accounts.error}
                        message="Não foi possível carregar suas contas."
                      />
                    ) : (
                      <ProfileSecuritySection
                        accounts={accountRows}
                        currentEmail={currentEmail}
                        onOpenChangePassword={() => {
                          setIsPasswordDialogOpen(true);
                        }}
                      />
                    )}
                  </ExpandableSection>

                  {/* ---- Contas Vinculadas ---- */}
                  <ExpandableSection
                    contentClassName="pb-0"
                    description="Formas de entrar na sua conta."
                    sectionKey="contas"
                    title="Contas Vinculadas"
                  >
                    {accounts.isPending ? (
                      <LoadingState />
                    ) : accounts.isError ? (
                      <ErrorState
                        error={accounts.error}
                        message="Não foi possível carregar suas contas."
                      />
                    ) : (
                      <LinkedAccountsSection accounts={accountRows} />
                    )}
                  </ExpandableSection>
                </Accordion>
              </Animated.View>
            </Page.ScrollView>
            <Page.Footer className="px-4 pt-4 pb-safe-offset-4">
              <Button
                className="w-full"
                isDisabled={!canSubmit}
                onPress={handleSubmitPress}
              >
                <Button.Label>
                  {isSubmitPending
                    ? "Salvando..."
                    : isFirstRun
                      ? "Completar"
                      : "Salvar alterações"}
                </Button.Label>
              </Button>
            </Page.Footer>
          </>
        )}
      </Page>
      {isProfileLoaded ? (
        <>
          <ChangePasswordDialog
            isOpen={isPasswordDialogOpen}
            onOpenChange={setIsPasswordDialogOpen}
          />
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
      ) : null}
    </>
  );
}
