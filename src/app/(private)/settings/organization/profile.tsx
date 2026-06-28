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
  isPhysicalOrganizationType,
  ORGANIZER_TYPES,
  SPORTS,
  upsertOrganizationSchema,
} from "@convex/domains/organization/contract";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";
import { z } from "zod";

const ORGANIZATION_LOGO_CROP_TARGET = { width: 900 } as const;

const ORGANIZER_TYPE_LABELS: Record<(typeof ORGANIZER_TYPES)[number], string> =
  {
    academia: "Academia",
    clube: "Clube",
    condominio: "Condomínio",
    confederacao: "Confederação",
    centro_de_treinamento: "Centro de treinamento",
    escola: "Escola",
    federacao: "Federação",
    liga: "Liga",
    outro: "Outro",
  };

const ORGANIZER_TYPE_OPTIONS = ORGANIZER_TYPES.map((value) => ({
  label: ORGANIZER_TYPE_LABELS[value],
  value,
}));

const SPORT_LABELS: Record<(typeof SPORTS)[number], string> = {
  badminton: "Badminton",
  beach_tennis: "Beach Tennis",
  futebol_society: "Futebol society",
  futevolei: "Futevôlei",
  padel: "Padel",
  pickleball: "Pickleball",
  raquetinha: "Raquetinha",
  squash: "Squash",
  tenis: "Tênis",
  tenis_de_mesa: "Tênis de mesa",
  volei_de_praia: "Vôlei de praia",
  volei_de_quadra: "Vôlei de quadra",
  outro: "Outro",
};

const SPORT_OPTIONS = SPORTS.map((value) => ({
  label: SPORT_LABELS[value],
  value,
}));

const EditFormSchema = z
  .object({
    address: upsertOrganizationSchema.shape.address.optional(),
    contactEmail: z.string().optional(),
    description: z.string().optional(),
    logoDraftUri: z.string().optional(),
    logoStorageId: upsertOrganizationSchema.shape.logoStorageId,
    name: upsertOrganizationSchema.shape.name,
    organizerType: upsertOrganizationSchema.shape.organizerType.optional(),
    sports: upsertOrganizationSchema.shape.sports.optional(),
    website: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      isPhysicalOrganizationType(value.organizerType) &&
      !(value.address?.cep?.trim() && value.address.number?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Endereço da sede é obrigatório para este tipo.",
        path: ["address"],
      });
    }
  });

type EditFormValues = z.input<typeof EditFormSchema>;

const defaultValues: EditFormValues = {
  address: undefined,
  contactEmail: "",
  description: "",
  logoDraftUri: undefined,
  logoStorageId: null,
  name: "",
  organizerType: undefined,
  sports: [],
  website: "",
};

export default function OrganizationProfile() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const organization = useQuery(crpc.organization.profile.get.queryOptions());
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<ImageCropAsset | null>(null);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<CroppedImage | null>(
    null
  );

  const form = useForm<EditFormValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(EditFormSchema),
  });

  const generateUploadUrl = useMutation(
    crpc.organization.profile.generateUploadUrl.mutationOptions()
  );

  useEffect(() => {
    if (!organization.data) {
      return;
    }

    form.reset({
      ...organization.data,
      address: organization.data.address ?? undefined,
      contactEmail: organization.data.contactEmail ?? "",
      description: organization.data.description ?? "",
      logoDraftUri: undefined,
      organizerType: organization.data.organizerType ?? undefined,
      sports: organization.data.sports ?? [],
      website: organization.data.website ?? "",
    });
    form.trigger().catch(() => undefined);
  }, [form, organization.data]);

  const updateProfile = useMutation(
    crpc.organization.profile.upsert.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar o perfil."
          ),
          id: "update-organization-profile-error",
          label: "Erro ao atualizar perfil",
          variant: "danger",
        });
      },
      onSuccess: async (next) => {
        await queryClient.invalidateQueries(
          crpc.organization.profile.get.queryFilter()
        );
        await queryClient.invalidateQueries(
          crpc.viewer.context.get.queryFilter()
        );
        form.reset({
          ...next,
          address: next.address ?? undefined,
          contactEmail: next.contactEmail ?? "",
          description: next.description ?? "",
          logoDraftUri: undefined,
          organizerType: next.organizerType ?? undefined,
          sports: next.sports ?? [],
          website: next.website ?? "",
        });
        await form.trigger();
        setLogoPreviewUri(null);
        setPendingLogoFile(null);
        toast.show({
          description: "Perfil da organização atualizado.",
          id: "update-organization-profile-success",
          label: "Perfil atualizado",
          variant: "success",
        });
      },
    })
  );

  const watchedType = form.watch("organizerType");
  const isPhysical = isPhysicalOrganizationType(watchedType);
  const displayName = form.watch("name") || "Perfil da organização";
  const logoSource = logoPreviewUri ?? organization.data?.logoUrl ?? undefined;

  const isSubmitPending =
    updateProfile.isPending ||
    generateUploadUrl.isPending ||
    isLogoProcessing ||
    organization.isPending;

  const canSubmit =
    (form.formState.isDirty || Boolean(pendingLogoFile)) &&
    form.formState.isValid &&
    !isSubmitPending;

  async function handleLogoPress() {
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
        id: "organization-logo-picker-error",
        label: "Erro ao selecionar imagem",
        variant: "danger",
      });
    }
  }

  async function handleCropConfirm(cropArea: ImageCropArea) {
    if (!cropAsset) {
      return;
    }

    setIsLogoProcessing(true);

    try {
      const croppedFile = await cropImage({
        cropArea,
        sourceUri: cropAsset.uri,
        target: ORGANIZATION_LOGO_CROP_TARGET,
      });

      setPendingLogoFile(croppedFile);
      setLogoPreviewUri(croppedFile.uri);
      form.setValue("logoDraftUri", croppedFile.uri, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      await form.trigger();
      setCropAsset(null);
    } catch {
      toast.show({
        description: "Não foi possível recortar a imagem.",
        id: "organization-logo-crop-error",
        label: "Erro ao recortar imagem",
        variant: "danger",
      });
    } finally {
      setIsLogoProcessing(false);
    }
  }

  async function uploadPendingLogo() {
    if (!pendingLogoFile) {
      return null;
    }

    const uploadUrl = await generateUploadUrl.mutateAsync({});
    const uploaded = await uploadImageToStorage({
      file: pendingLogoFile,
      uploadUrl,
    });

    form.setValue("logoStorageId", uploaded.storageId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPendingLogoFile(null);

    return uploaded.storageId;
  }

  const submitForm = form.handleSubmit(async (values) => {
    let logoStorageId = values.logoStorageId;

    try {
      logoStorageId = (await uploadPendingLogo()) ?? logoStorageId;
    } catch {
      toast.show({
        description: "Não foi possível enviar a imagem.",
        id: "organization-logo-submit-error",
        label: "Erro no upload",
        variant: "danger",
      });
      return;
    }

    await updateProfile.mutateAsync({
      ...values,
      logoStorageId,
      organizerType: values.organizerType!,
    });
  });

  const isError = organization.isError;
  const isLoading = organization.isPending;
  const isLoaded = !(isLoading || isError);

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Perfil da organização</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>

        {isLoading ? (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <LoadingState />
          </Page.ScrollView>
        ) : null}
        {isError ? (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <ErrorState
              error={organization.error}
              message="Não foi possível carregar o perfil."
            />
          </Page.ScrollView>
        ) : null}

        {isLoaded ? (
          <>
            <Page.ScrollView contentContainerClassName="items-center gap-2 px-4 w-full pb-safe-offset-4">
              <PressableFeedback
                className="rounded-full"
                isDisabled={isSubmitPending}
                onPress={handleLogoPress}
              >
                <Image
                  alt={displayName}
                  className="size-30 rounded-full"
                  fallback="green"
                  source={logoSource}
                />
                <View className="centered absolute inset-0 bg-black/45">
                  <HugeIcons
                    className="size-6 text-white"
                    icon={ImageUploadIcon}
                  />
                  <Text className="text-white" variant="description">
                    {isSubmitPending ? "Salvando..." : "Alterar logo"}
                  </Text>
                </View>
                <PressableFeedback.Highlight />
              </PressableFeedback>
              <Text className="text-xl">{displayName}</Text>

              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Nome da organização</Label>
                    <Input
                      autoCapitalize="words"
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="organizerType"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Sua organização é um(a):</Label>
                    <Select
                      isDisabled={isSubmitPending}
                      onValueChange={(nextValue) => {
                        if (nextValue && !Array.isArray(nextValue)) {
                          form.setValue(
                            "organizerType",
                            nextValue.value as EditFormValues["organizerType"],
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            }
                          );
                        }
                      }}
                      selectionMode="single"
                      value={ORGANIZER_TYPE_OPTIONS.find(
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
                          {ORGANIZER_TYPE_OPTIONS.map((option) => (
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

              {isPhysical ? (
                <View className="w-full gap-2">
                  <Text className="text-base">Endereço da sede</Text>
                  <Controller
                    control={form.control}
                    name="address.cep"
                    render={({ field, fieldState }) => (
                      <TextField
                        className="w-full"
                        isInvalid={Boolean(fieldState.error)}
                        isRequired
                      >
                        <Label>CEP</Label>
                        <Input
                          editable={!isSubmitPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          value={field.value ?? ""}
                        />
                        <FieldError>
                          {fieldState.error?.message ?? ""}
                        </FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <TextField className="w-full">
                        <Label>Endereço</Label>
                        <Input
                          editable={!isSubmitPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          value={field.value ?? ""}
                        />
                      </TextField>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="address.number"
                    render={({ field, fieldState }) => (
                      <TextField
                        className="w-full"
                        isInvalid={Boolean(fieldState.error)}
                        isRequired
                      >
                        <Label>Número</Label>
                        <Input
                          editable={!isSubmitPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          value={field.value ?? ""}
                        />
                        <FieldError>
                          {fieldState.error?.message ?? ""}
                        </FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="address.complement"
                    render={({ field }) => (
                      <TextField className="w-full">
                        <Label>Complemento</Label>
                        <Input
                          editable={!isSubmitPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          value={field.value ?? ""}
                        />
                      </TextField>
                    )}
                  />
                </View>
              ) : null}

              <Controller
                control={form.control}
                name="sports"
                render={({ field }) => (
                  <TextField className="w-full">
                    <Label>Modalidades</Label>
                    <Select
                      isDisabled={isSubmitPending}
                      onValueChange={(nextValue) => {
                        const next = Array.isArray(nextValue)
                          ? nextValue.map(
                              (item) => item?.value as (typeof SPORTS)[number]
                            )
                          : [];
                        form.setValue("sports", next, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      selectionMode="multiple"
                      value={(field.value ?? []).map((value) =>
                        SPORT_OPTIONS.find((option) => option.value === value)
                      )}
                    >
                      <Select.Trigger>
                        <Select.Value
                          className="font-normal"
                          numberOfLines={1}
                          placeholder="Selecione as modalidades"
                        />
                        <Select.TriggerIndicator />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" width="trigger">
                          <Select.ListLabel className="mb-2">
                            Modalidades
                          </Select.ListLabel>
                          {SPORT_OPTIONS.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <TextField className="w-full">
                    <Label>Descrição</Label>
                    <Input
                      editable={!isSubmitPending}
                      multiline
                      onChangeText={field.onChange}
                      placeholder="Conte mais sobre sua organização"
                      value={field.value ?? ""}
                    />
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="website"
                render={({ field }) => (
                  <TextField className="w-full">
                    <Label>Website</Label>
                    <Input
                      autoCapitalize="none"
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="https://..."
                      value={field.value ?? ""}
                    />
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <TextField className="w-full">
                    <Label>E-mail de contato</Label>
                    <Input
                      autoCapitalize="none"
                      editable={!isSubmitPending}
                      keyboardType="email-address"
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      value={field.value ?? ""}
                    />
                  </TextField>
                )}
              />
            </Page.ScrollView>
            <Page.Footer className="px-4 pb-safe-offset-4">
              <Button
                className="w-full"
                isDisabled={!canSubmit}
                onPress={() => submitForm().catch(() => undefined)}
              >
                <Button.Label>
                  {isSubmitPending ? "Salvando..." : "Salvar alterações"}
                </Button.Label>
              </Button>
            </Page.Footer>
          </>
        ) : null}
      </Page>
      {isLoaded ? (
        <ImageCropper
          aspectRatio={1}
          asset={cropAsset}
          description="Arraste a foto e pince para dar zoom."
          isProcessing={isLogoProcessing}
          onCancel={() => {
            if (!isLogoProcessing) {
              setCropAsset(null);
            }
          }}
          onConfirm={handleCropConfirm}
          title="Ajustar logo"
        />
      ) : null}
    </>
  );
}
