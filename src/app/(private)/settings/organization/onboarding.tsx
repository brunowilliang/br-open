import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  PressableFeedback,
  Select,
  Spinner,
  TextField,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Linking, View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
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
import { fetchAddressByCep, ViaCepNotFoundError } from "@/lib/uploads/viacep";
import {
  activateOrganizationSchema,
  CURRENT_TERMS_VERSION,
  isPhysicalOrganizationType,
  ORGANIZER_TYPES,
  SPORTS,
  type ActivateOrganizationInput,
} from "@convex/domains/organization/contract";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";
import { z } from "zod";

const ORGANIZATION_LOGO_CROP_TARGET = { width: 900 } as const;
const TERMS_URL = "https://bropen.com/termos";

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

const OnboardingFormSchema = z
  .object({
    acceptedTerms: z.boolean(),
    cep: z.string().optional(),
    city: z.string().optional(),
    complement: z.string().optional(),
    district: z.string().optional(),
    logoDraftUri: z.string().optional(),
    logoStorageId: z.string().min(1).nullable(),
    name: activateOrganizationSchema.shape.name,
    number: z.string().optional(),
    organizerType: activateOrganizationSchema.shape.organizerType.optional(),
    sports: z.array(z.enum(SPORTS)).optional(),
    state: z.string().optional(),
    street: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.organizerType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o tipo.",
        path: ["organizerType"],
      });
    }

    if (value.acceptedTerms !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Você precisa aceitar os termos.",
        path: ["acceptedTerms"],
      });
    }

    if (isPhysicalOrganizationType(value.organizerType)) {
      for (const field of [
        "cep",
        "street",
        "number",
        "city",
        "state",
      ] as const) {
        if (!value[field]?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Campo obrigatório.",
            path: [field],
          });
        }
      }
    }
  });

type OnboardingFormValues = z.input<typeof OnboardingFormSchema>;

const defaultValues: OnboardingFormValues = {
  acceptedTerms: false,
  cep: "",
  city: "",
  complement: "",
  district: "",
  logoDraftUri: undefined,
  logoStorageId: null,
  name: "",
  number: "",
  organizerType: undefined,
  sports: [],
  state: "",
  street: "",
};

export default function OrganizationOnboarding() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<ImageCropAsset | null>(null);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<CroppedImage | null>(
    null
  );
  const [isCepLookingUp, setIsCepLookingUp] = useState(false);

  const form = useForm<OnboardingFormValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(OnboardingFormSchema),
  });

  const generateUploadUrl = useMutation(
    crpc.organization.profile.generateUploadUrl.mutationOptions()
  );

  const activateOrganization = useMutation(
    crpc.viewer.context.activateOrganization.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível criar a organização."
          ),
          id: "organization-onboarding-error",
          label: "Erro ao criar organização",
          variant: "danger",
        });
      },
      onSuccess: async (nextViewerContext) => {
        applyViewerContextToClientState({
          queryClient,
          viewerContext: nextViewerContext,
          viewerContextFilter: crpc.viewer.context.get.queryFilter(),
        });
        await queryClient.invalidateQueries(
          crpc.viewer.context.get.queryFilter()
        );
        await queryClient.invalidateQueries(
          crpc.organization.profile.get.queryFilter()
        );
        toast.show({
          description: "Sua organização foi criada.",
          id: "organization-onboarding-success",
          label: "Organização criada",
          variant: "success",
        });
        // @ts-expect-error expo-router types are regenerated at dev time
        router.replace("/settings/organization/profile");
      },
    })
  );

  const watchedType = form.watch("organizerType");
  const isPhysical = isPhysicalOrganizationType(watchedType);
  const displayName = form.watch("name") || "Nova organização";

  const isSubmitPending =
    activateOrganization.isPending ||
    generateUploadUrl.isPending ||
    isLogoProcessing ||
    isCepLookingUp;

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

  async function handleCepBlur() {
    const cep = form.getValues("cep") ?? "";

    if (cep.replace(/\D/g, "").length !== 8) {
      return;
    }

    setIsCepLookingUp(true);

    try {
      const result = await fetchAddressByCep(cep);

      form.setValue("street", result.street, { shouldDirty: true });
      form.setValue("district", result.district, { shouldDirty: true });
      form.setValue("city", result.city, { shouldDirty: true });
      form.setValue("state", result.state, { shouldDirty: true });
      await form.trigger(["cep", "street", "city", "state"]);
    } catch (error) {
      const message =
        error instanceof ViaCepNotFoundError
          ? "CEP não encontrado."
          : "Não foi possível buscar o CEP.";

      form.setError("cep", { message });
    } finally {
      setIsCepLookingUp(false);
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

    const payload: ActivateOrganizationInput = {
      acceptedTerms: {
        acceptedAt: new Date().toISOString(),
        userId: "", // server fills via ctx.userId
        version: CURRENT_TERMS_VERSION,
      },
      address: isPhysical
        ? {
            cep: values.cep ?? "",
            city: values.city ?? "",
            complement: values.complement || undefined,
            district: values.district || undefined,
            number: values.number ?? "",
            state: values.state ?? "",
            street: values.street ?? "",
          }
        : undefined,
      description: undefined,
      logoStorageId,
      name: values.name,
      organizerType: values.organizerType!,
      sports: values.sports,
      website: undefined,
    };

    await activateOrganization.mutateAsync(payload);
  });

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Configurar organização</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
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
              source={logoPreviewUri ?? undefined}
            />
            <View className="centered absolute inset-0 bg-black/45">
              <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
              <Text className="text-white" variant="description">
                {isSubmitPending ? "Salvando..." : "Adicionar logo"}
              </Text>
            </View>
            <PressableFeedback.Highlight />
          </PressableFeedback>

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
                  placeholder="Ex.: Clube BR Open"
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
                        nextValue.value as OnboardingFormValues["organizerType"],
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
                name="cep"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>CEP</Label>
                    <Input
                      editable={!isSubmitPending}
                      onBlur={() => {
                        field.onBlur();
                        handleCepBlur();
                      }}
                      onChangeText={field.onChange}
                      placeholder="00000-000"
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                    {isCepLookingUp ? <Spinner size="sm" /> : null}
                  </TextField>
                )}
              />
              <Controller
                control={form.control}
                name="street"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Endereço</Label>
                    <Input
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
                name="number"
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
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />
              <Controller
                control={form.control}
                name="complement"
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
              <Controller
                control={form.control}
                name="district"
                render={({ field }) => (
                  <TextField className="w-full">
                    <Label>Bairro</Label>
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
                name="city"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Cidade</Label>
                    <Input
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
                name="state"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Estado</Label>
                    <Input
                      editable={!isSubmitPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      value={field.value ?? ""}
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
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
                <Label>Quais modalidades sua organização atende?</Label>
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
            name="acceptedTerms"
            render={({ field, fieldState }) => (
              <View className="w-full">
                <View className="flex-row items-center gap-2">
                  <Checkbox
                    isDisabled={isSubmitPending}
                    isSelected={Boolean(field.value)}
                    onSelectedChange={(next) => field.onChange(next)}
                  />
                  <Text className="flex-1">
                    Li e aceito os{" "}
                    <Text
                      className="text-primary underline"
                      onPress={() => Linking.openURL(TERMS_URL)}
                    >
                      termos e condições
                    </Text>
                    .
                  </Text>
                </View>
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </View>
            )}
          />
        </Page.ScrollView>
        <Page.Footer className="px-4 pb-safe-offset-4">
          <Button
            className="w-full"
            isDisabled={isSubmitPending || !form.formState.isValid}
            onPress={() => submitForm().catch(() => undefined)}
          >
            <Button.Label>
              {isSubmitPending ? "Criando..." : "Criar organização"}
            </Button.Label>
          </Button>
        </Page.Footer>
      </Page>
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
    </>
  );
}
