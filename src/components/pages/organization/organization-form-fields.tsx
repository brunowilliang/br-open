import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionLayoutTransition,
  Button,
  Description,
  FieldError,
  InputGroup,
  Input,
  Label,
  PressableFeedback,
  Select,
  Spinner,
  TextArea,
  TextField,
  useToast,
} from "heroui-native";
import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { z } from "zod";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  PIX_KEY_TYPES,
  applyPixInputChange,
  formatPixKey,
  isNumericPixKey,
  isValidPixKey,
  rawPixKey,
  type PixKeyType,
} from "@/lib/payments/pix-key";
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
import {
  cropImage,
  type CroppedImage,
  type ImageCropArea,
  type ImageCropAsset,
  ImageCropper,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import { fetchAddressByCep, ViaCepNotFoundError } from "@/lib/uploads/viacep";
import {
  isPhysicalOrganizationType,
  ORGANIZER_TYPES,
  SPORTS,
} from "@convex/domains/organization/contract";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";

// ---------------------------------------------------------------------------
// Form values (shared shape for both onboarding and profile)
// ---------------------------------------------------------------------------

export type OrganizationFormValues = {
  acceptedTerms?: boolean;
  address?: {
    cep?: string;
    city?: string;
    complement?: string;
    district?: string;
    number?: string;
    state?: string;
    street?: string;
  };
  contactEmail?: string;
  description?: string;
  logoDraftUri?: string;
  logoStorageId?: null | string;
  name?: string;
  organizerType?: string;
  organizerTypeLabel?: string;
  phone?: string;
  sports?: string[];
  sportsLabel?: string;
  website?: string;
};

const ORGANIZATION_LOGO_CROP_TARGET = { width: 900 } as const;

export const ORGANIZER_TYPE_LABELS: Record<
  (typeof ORGANIZER_TYPES)[number],
  string
> = {
  academia: "Academia",
  clube: "Clube",
  condominio: "Condomínio",
  confederacao: "Confederação",
  centro_de_treinamento: "Centro de treinamento",
  escola: "Escola",
  federacao: "Federação",
  liga: "Liga",
  particular: "Particular",
  outro: "Outro",
};

export const ORGANIZER_TYPE_OPTIONS = ORGANIZER_TYPES.map((value) => ({
  label: ORGANIZER_TYPE_LABELS[value],
  value,
}));

export const SPORT_LABELS: Record<(typeof SPORTS)[number], string> = {
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

export const SPORT_OPTIONS = SPORTS.map((value) => ({
  label: SPORT_LABELS[value],
  value,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an array of sport keys into a Portuguese display string, e.g.
 * "Tênis, Beach Tennis e Padel". If the array contains "outro", the
 * provided `sportsLabel` is appended.
 */
export function formatSportsLabel(
  sports: readonly string[],
  sportsLabel?: string
): string {
  const labels = sports
    .filter((s) => s !== "outro")
    .map((s) => SPORT_LABELS[s as (typeof SPORTS)[number]] ?? s);

  if (sports.includes("outro") && sportsLabel) {
    labels.push(sportsLabel);
  }

  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

// ---------------------------------------------------------------------------
// Logo hook
// ---------------------------------------------------------------------------

export function useOrganizationLogo(
  form: UseFormReturn<OrganizationFormValues>
) {
  const { toast } = useToast();
  const [cropAsset, setCropAsset] = useState<ImageCropAsset | null>(null);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<CroppedImage | null>(
    null
  );
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);

  async function handleLogoPress(isSubmitPending: boolean) {
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
        id: "organization-logo-picker-error",
        label: "Sem acesso à galeria",
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
        description: "Não foi possível recortar a imagem. Tente novamente.",
        id: "organization-logo-crop-error",
        label: "Falha ao ajustar imagem",
        variant: "danger",
      });
    } finally {
      setIsLogoProcessing(false);
    }
  }

  function handleCropCancel() {
    if (!isLogoProcessing) {
      setCropAsset(null);
    }
  }

  return {
    cropAsset,
    handleCropCancel,
    handleCropConfirm,
    handleLogoPress,
    isLogoProcessing,
    logoPreviewUri,
    pendingLogoFile,
    setLogoPreviewUri,
    setPendingLogoFile,
  };
}

export type OrganizationLogoReturn = ReturnType<typeof useOrganizationLogo>;

// ---------------------------------------------------------------------------
// Upload helper
// ---------------------------------------------------------------------------

type GenerateUploadUrl = {
  mutateAsync: (input: Record<string, never>) => Promise<string>;
};

export async function uploadPendingLogo(
  pendingLogoFile: CroppedImage | null,
  generateUploadUrl: GenerateUploadUrl,
  form: UseFormReturn<OrganizationFormValues>
): Promise<null | string> {
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

  return uploaded.storageId;
}

// ---------------------------------------------------------------------------
// Expandable card section — one Accordion card per section so they stay
// independent (separate cards, not joined like a single Accordion).
// ---------------------------------------------------------------------------

type ExpandableSectionProps = {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  description?: string;
  title: string;
};

function ExpandableSection(props: ExpandableSectionProps) {
  return (
    // Each card is an Animated.View sibling with `layout` so that when its
    // Accordion content expands/collapses, the other cards (and the terms
    // checkbox below) reposition smoothly instead of snapping. Per Reanimated
    // docs, every sibling of an entering/exiting element needs its own
    // `layout` prop — wrapping everything in a single Animated.View does NOT
    // propagate layout animations to children.
    <Animated.View layout={AccordionLayoutTransition}>
      <Accordion
        defaultValue={props.defaultExpanded ? ["section"] : []}
        selectionMode="single"
        variant="surface"
      >
        <Accordion.Item value="section">
          <Accordion.Trigger>
            <View className="flex-1">
              <Text className="font-medium text-base">{props.title}</Text>
              {props.description ? (
                <Text color="muted" variant="description">
                  {props.description}
                </Text>
              ) : null}
            </View>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content className="gap-3">
            {props.children}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

export type OrganizationFormMode = "onboarding" | "profile";

type OrganizationFormFieldsProps = {
  form: UseFormReturn<OrganizationFormValues>;
  isSubmitPending: boolean;
  logo: OrganizationLogoReturn;
  logoSource?: null | string;
  mode: OrganizationFormMode;
};

export function OrganizationFormFields(props: OrganizationFormFieldsProps) {
  const { form, isSubmitPending, logo, logoSource, mode } = props;

  const watchedType = useWatch({
    control: form.control,
    name: "organizerType",
  }) as string | null | undefined;
  const isPhysical = isPhysicalOrganizationType(watchedType);
  const watchedName = useWatch({ control: form.control, name: "name" }) as
    | string
    | undefined;
  const displayName =
    watchedName ??
    (mode === "onboarding" ? "Nova organização" : "Perfil da organização");

  return (
    <>
      {/* ---- Detalhes (logo + nome + tipo) ---- */}
      <ExpandableSection
        defaultExpanded
        description="Identidade e tipo da organização."
        title="Detalhes"
      >
        <PressableFeedback
          className="self-center rounded-full"
          isDisabled={isSubmitPending}
          onPress={() => logo.handleLogoPress(isSubmitPending)}
        >
          <Image
            alt={displayName}
            className="size-30 rounded-full"
            fallback="green"
            source={logoSource ?? logo.logoPreviewUri ?? undefined}
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
          name={"name"}
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
                value={String(field.value ?? "")}
                variant="secondary"
              />
              <FieldError>{fieldState.error?.message ?? ""}</FieldError>
            </TextField>
          )}
        />

        <Controller
          control={form.control}
          name={"organizerType"}
          render={({ field, fieldState }) => (
            <TextField
              className="w-full"
              isInvalid={Boolean(fieldState.error)}
              isRequired
            >
              <Label>Tipo de organização</Label>
              <Select
                isDisabled={isSubmitPending}
                onValueChange={(nextValue) => {
                  if (nextValue && !Array.isArray(nextValue)) {
                    form.setValue("organizerType", nextValue.value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }
                }}
                selectionMode="single"
                value={ORGANIZER_TYPE_OPTIONS.find(
                  (option) => option.value === field.value
                )}
              >
                <Select.Trigger className="bg-surface-secondary">
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

        <ConditionalOutroField
          form={form}
          isSubmitPending={isSubmitPending}
          labelField="organizerTypeLabel"
          placeholder="Especifique o tipo da organização"
          triggerField="organizerType"
        />
      </ExpandableSection>

      {/* ---- Modalidades ---- */}
      <ExpandableSection
        description="Selecione os esportes oferecidos."
        title="Modalidades"
      >
        <Controller
          control={form.control}
          name={"sports"}
          render={({ field }) => {
            const sports = (
              Array.isArray(field.value) ? field.value : []
            ) as string[];
            const sportsLabel = form.watch("sportsLabel") as string | undefined;
            const displayLabel = formatSportsLabel(sports, sportsLabel);

            return (
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
                  value={sports.map((value) =>
                    SPORT_OPTIONS.find((option) => option.value === value)
                  )}
                >
                  <Select.Trigger className="bg-surface-secondary">
                    <Text
                      className={
                        displayLabel
                          ? "flex-1 text-foreground"
                          : "flex-1 font-normal text-field-placeholder"
                      }
                      numberOfLines={1}
                    >
                      {displayLabel || "Selecione as modalidades"}
                    </Text>
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
            );
          }}
        />

        <ConditionalOutroField
          form={form}
          isSubmitPending={isSubmitPending}
          labelField="sportsLabel"
          placeholder="Especifique a modalidade"
          triggerField="sports"
        />
      </ExpandableSection>

      {/* ---- Endereço (condicional — só se físico, colapsado por padrão) ---- */}
      {isPhysical ? (
        <AddressSection form={form} isSubmitPending={isSubmitPending} />
      ) : null}

      {/* ---- Sobre (sempre visível, colapsado por padrão) ---- */}
      <ExpandableSection
        defaultExpanded={false}
        description="Apresentação e contato."
        title="Sobre"
      >
        <Controller
          control={form.control}
          name={"description"}
          render={({ field }) => (
            <TextField className="w-full">
              <Label>Descrição</Label>
              <TextArea
                editable={!isSubmitPending}
                onChangeText={field.onChange}
                placeholder="Conte mais sobre sua organização"
                value={String(field.value ?? "")}
                variant="secondary"
              />
            </TextField>
          )}
        />

        <Controller
          control={form.control}
          name={"website"}
          render={({ field }) => (
            <TextField className="w-full">
              <Label>Website</Label>
              <Input
                autoCapitalize="none"
                editable={!isSubmitPending}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="https://..."
                value={String(field.value ?? "")}
                variant="secondary"
              />
            </TextField>
          )}
        />

        <Controller
          control={form.control}
          name={"contactEmail"}
          render={({ field, fieldState }) => (
            <TextField
              className="w-full"
              isInvalid={Boolean(fieldState.error)}
              isRequired
            >
              <Label>E-mail de contato</Label>
              <Input
                autoCapitalize="none"
                editable={!isSubmitPending}
                keyboardType="email-address"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={String(field.value ?? "")}
                variant="secondary"
              />
              <FieldError>{fieldState.error?.message ?? ""}</FieldError>
            </TextField>
          )}
        />

        <Controller
          control={form.control}
          name={"phone"}
          render={({ field, fieldState }) => (
            <TextField
              className="w-full"
              isInvalid={Boolean(fieldState.error)}
              isRequired
            >
              <Label>Telefone / WhatsApp</Label>
              <Input
                editable={!isSubmitPending}
                keyboardType="phone-pad"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="(11) 99999-9999"
                value={String(field.value ?? "")}
                variant="secondary"
              />
              <FieldError>{fieldState.error?.message ?? ""}</FieldError>
            </TextField>
          )}
        />
      </ExpandableSection>

      {/* ---- Pagamentos (última seção) ---- */}
      <PaymentSection />

      {/* ImageCropper rendered as sibling */}
      <ImageCropper
        aspectRatio={1}
        asset={logo.cropAsset}
        description="Arraste a foto e pince para dar zoom."
        isProcessing={logo.isLogoProcessing}
        onCancel={logo.handleCropCancel}
        onConfirm={logo.handleCropConfirm}
        title="Ajustar logo"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Payment section — PIX key onboarding/edit (same ExpandableSection pattern)
// ---------------------------------------------------------------------------

type PixKeyFormValues = {
  pixKey: string;
  pixKeyType: PixKeyType;
};

function PixKeyFields(props: {
  form: ReturnType<typeof useForm<PixKeyFormValues>>;
  isPending: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <>
      <Controller
        control={props.form.control}
        name="pixKeyType"
        render={({ field: typeField }) => (
          <TextField isRequired>
            <Label>Tipo de chave</Label>
            <Select
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  typeField.onChange(nextValue.value as PixKeyType);
                  props.form.setValue("pixKey", "");
                }
              }}
              selectionMode="single"
              value={{
                label:
                  PIX_KEY_TYPES.find((o) => o.value === typeField.value)
                    ?.label ?? "CPF",
                value: (typeField.value as string) ?? "cpf",
              }}
            >
              <Select.Trigger className="bg-surface-secondary">
                <Select.Value
                  className="font-normal"
                  numberOfLines={1}
                  placeholder="Escolha um tipo"
                />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover" width="trigger">
                  <Select.ListLabel className="mb-2">
                    Escolha um tipo
                  </Select.ListLabel>
                  {PIX_KEY_TYPES.map((option) => (
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
        control={props.form.control}
        name="pixKey"
        render={({ field, fieldState }) => (
          <TextField isRequired>
            <Label>Chave PIX</Label>
            <Input
              autoCapitalize="none"
              className="w-full"
              isInvalid={Boolean(fieldState.error)}
              keyboardType={
                isNumericPixKey(props.form.getValues("pixKeyType"))
                  ? "numeric"
                  : "default"
              }
              onBlur={field.onBlur}
              onChangeText={(text) => {
                const formType = props.form.getValues("pixKeyType");
                const prev = String(field.value ?? "");
                const digits = applyPixInputChange(prev, text, formType);
                field.onChange(formatPixKey(digits, formType));
              }}
              placeholder="Digite sua chave PIX"
              value={String(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />

      <Button
        className="w-full"
        isDisabled={props.isPending}
        onPress={() => props.onSubmit()}
      >
        <Button.Label>
          {props.isPending ? "Conectando..." : props.submitLabel}
        </Button.Label>
      </Button>
    </>
  );
}

function PaymentSection() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const statusQuery = useQuery(
    crpc.payment.onboarding.getStatus.queryOptions()
  );

  const startOnboarding = useMutation(
    crpc.payment.onboarding.start.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível vincular sua chave PIX. Tente novamente."
          ),
          id: "payment-onboarding-error",
          label: "Falha ao conectar conta",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        toast.show({
          description: isEditing
            ? "A nova chave já está ativa para recebimentos."
            : "Sua chave PIX foi vinculada e já pode receber pagamentos.",
          id: "payment-onboarding-success",
          label: isEditing ? "Chave PIX atualizada" : "Conta conectada",
          variant: "success",
        });
        setIsEditing(false);
        await queryClient.invalidateQueries(
          crpc.payment.onboarding.getStatus.queryFilter()
        );
        await queryClient.invalidateQueries(
          crpc.payment.dashboard.getOverview.queryFilter()
        );
      },
    })
  );

  const pixForm = useForm<PixKeyFormValues>({
    defaultValues: { pixKey: "", pixKeyType: "cpf" },
    resolver: zodResolver(
      z.object({
        pixKey: z.string().min(1, "Informe a chave PIX."),
        pixKeyType: z.custom<PixKeyType>(
          (v) => v !== undefined && v !== null && v !== ""
        ),
      })
    ),
  });

  const onSubmit = pixForm.handleSubmit(async (values) => {
    if (!isValidPixKey(values.pixKey, values.pixKeyType)) {
      pixForm.setError("pixKey", {
        message: "Chave PIX inválida para o tipo selecionado.",
      });
      return;
    }
    const raw = rawPixKey(values.pixKey, values.pixKeyType);
    await startOnboarding.mutateAsync({ pixKey: raw });
  });

  function handleEditPixKey() {
    setIsEditing(true);
    pixForm.reset({ pixKey: "", pixKeyType: "cpf" });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    pixForm.reset({ pixKey: "", pixKeyType: "cpf" });
  }

  const account = statusQuery.data ?? null;
  const isConnected = account?.status === "active";

  let description: string;
  if (statusQuery.isPending) {
    description = "Carregando...";
  } else if (isConnected) {
    description = "Conta conectada";
  } else if (account?.status === "pending") {
    description = "Validando conta...";
  } else if (account?.status === "rejected") {
    description = "Conta rejeitada";
  } else {
    description = "Receba pagamentos via PIX nas suas ligas";
  }

  const defaultExpanded = !(isConnected || statusQuery.isPending);

  return (
    <ExpandableSection
      defaultExpanded={defaultExpanded}
      description={description}
      title="Pagamentos"
    >
      {statusQuery.isPending ? (
        <View className="flex-row items-center gap-2 py-2">
          <Spinner size="sm" />
          <Description>Carregando dados da conta...</Description>
        </View>
      ) : isConnected && !isEditing ? (
        <>
          {account?.name ? (
            <TextField>
              <Description>Nome da conta</Description>
              <Label>{account.name}</Label>
            </TextField>
          ) : null}
          {account?.pixKey ? (
            <TextField>
              <Description>Chave PIX</Description>
              <Label>{account.pixKey}</Label>
            </TextField>
          ) : null}
          <Description>
            Os pagamentos das suas ligas são recebidos automaticamente nesta
            conta via PIX.
          </Description>
          <Button onPress={handleEditPixKey} variant="secondary">
            <Button.Label>Editar chave PIX</Button.Label>
          </Button>
        </>
      ) : isEditing ? (
        <>
          <PixKeyFields
            form={pixForm}
            isPending={startOnboarding.isPending}
            onSubmit={() => onSubmit().catch(() => undefined)}
            submitLabel="Salvar chave"
          />
          <Button
            isDisabled={startOnboarding.isPending}
            onPress={handleCancelEdit}
            variant="ghost"
          >
            <Button.Label>Cancelar</Button.Label>
          </Button>
        </>
      ) : account?.status === "rejected" ? (
        <>
          <Description className="text-danger">
            Conta rejeitada. Tente conectar novamente.
          </Description>
          <PixKeyFields
            form={pixForm}
            isPending={startOnboarding.isPending}
            onSubmit={() => onSubmit().catch(() => undefined)}
            submitLabel="Conectar conta"
          />
        </>
      ) : (
        <>
          <Description>
            Quando um jogador paga por uma liga, o valor é dividido — você
            recebe sua parte automaticamente via PIX.
          </Description>
          <PixKeyFields
            form={pixForm}
            isPending={startOnboarding.isPending}
            onSubmit={() => onSubmit().catch(() => undefined)}
            submitLabel="Conectar conta"
          />
        </>
      )}
    </ExpandableSection>
  );
}

function ConditionalOutroField(props: {
  form: UseFormReturn<OrganizationFormValues>;
  isSubmitPending: boolean;
  triggerField: "organizerType" | "sports";
  labelField: "organizerTypeLabel" | "sportsLabel";
  placeholder: string;
}) {
  const triggerValue = useWatch({
    control: props.form.control,
    name: props.triggerField,
  });
  const isOutro =
    props.triggerField === "organizerType"
      ? triggerValue === "outro"
      : Array.isArray(triggerValue) && triggerValue.includes("outro");

  if (!isOutro) {
    return null;
  }

  return (
    <Controller
      control={props.form.control}
      name={props.labelField}
      render={({ field, fieldState }) => (
        <TextField
          className="w-full"
          isInvalid={Boolean(fieldState.error)}
          isRequired
        >
          <Label>Especifique</Label>
          <Input
            autoCapitalize="words"
            editable={!props.isSubmitPending}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder={props.placeholder}
            value={String(field.value ?? "")}
            variant="secondary"
          />
          <FieldError>{fieldState.error?.message ?? ""}</FieldError>
        </TextField>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Address section — owns the CEP lookup state so the spinner can render
// inside the CEP input (right side) and the other fields disable during lookup.
// ---------------------------------------------------------------------------

function AddressSection(props: {
  form: UseFormReturn<OrganizationFormValues>;
  isSubmitPending: boolean;
}) {
  const [isCepLookingUp, setIsCepLookingUp] = useState(false);
  const cepLookupRef = useRef<null | string>(null);
  const isLocked = props.isSubmitPending || isCepLookingUp;

  async function handleCepChange(rawValue: string | undefined) {
    const cep = (rawValue ?? "").replace(/\D/g, "");

    if (cep.length === 8 && cep !== cepLookupRef.current) {
      cepLookupRef.current = cep;
      setIsCepLookingUp(true);

      try {
        const result = await fetchAddressByCep(cep);

        props.form.setValue("address.street", result.street, {
          shouldDirty: true,
        });
        props.form.setValue("address.district", result.district, {
          shouldDirty: true,
        });
        props.form.setValue("address.city", result.city, {
          shouldDirty: true,
        });
        props.form.setValue("address.state", result.state, {
          shouldDirty: true,
        });
        await props.form.trigger();
      } catch (error) {
        const message =
          error instanceof ViaCepNotFoundError
            ? "CEP não encontrado."
            : "Não foi possível buscar o CEP.";

        props.form.setError("address.cep", { message });
      } finally {
        setIsCepLookingUp(false);
        cepLookupRef.current = null;
      }
    }
  }

  return (
    <ExpandableSection
      defaultExpanded={false}
      description="Localização da sede."
      title="Endereço"
    >
      <Controller
        control={props.form.control}
        name={"address.cep"}
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>CEP</Label>
            <InputGroup>
              <InputGroup.Input
                editable={!props.isSubmitPending}
                keyboardType="numeric"
                onBlur={field.onBlur}
                onChangeText={(text) => {
                  field.onChange(text);
                  handleCepChange(text);
                }}
                placeholder="00000000"
                returnKeyType="search"
                value={String(field.value ?? "")}
                variant="secondary"
              />
              {isCepLookingUp ? (
                <InputGroup.Suffix isDecorative>
                  <Spinner size="sm" />
                </InputGroup.Suffix>
              ) : null}
            </InputGroup>
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />

      <Controller
        control={props.form.control}
        name={"address.street"}
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Endereço</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={props.form.control}
        name={"address.number"}
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Número</Label>
            <Input
              editable={!isLocked}
              keyboardType="numeric"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={props.form.control}
        name={"address.complement"}
        render={({ field }) => (
          <TextField className="w-full">
            <Label>Complemento</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
          </TextField>
        )}
      />
      <Controller
        control={props.form.control}
        name={"address.district"}
        render={({ field }) => (
          <TextField className="w-full">
            <Label>Bairro</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
          </TextField>
        )}
      />
      <Controller
        control={props.form.control}
        name={"address.city"}
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Cidade</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={props.form.control}
        name={"address.state"}
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Estado</Label>
            <Input
              autoCapitalize="characters"
              editable={!isLocked}
              maxLength={2}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={String(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
    </ExpandableSection>
  );
}
