import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  ControlField,
  Dialog,
  FieldError,
  LinkButton,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import {
  OrganizationFormFields,
  uploadPendingLogo,
  useOrganizationLogo,
  type OrganizationFormValues,
} from "@/components/pages/organization/organization-form-fields";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  isValidPixKey,
  rawPixKey,
  type PixKeyType,
} from "@/lib/payments/pix-key";
import {
  activateOrganizationSchema,
  addressSchema,
  CURRENT_TERMS_VERSION,
  isPhysicalOrganizationType,
  type ActivateOrganizationInput,
} from "@convex/domains/organization/contract";
import { router } from "expo-router";
import { z } from "zod";

const OnboardingFormSchema = z
  .object({
    acceptedTerms: z.boolean(),
    address: addressSchema.optional(),
    contactEmail: activateOrganizationSchema.shape.contactEmail,
    description: z.string().optional(),
    logoDraftUri: z.string().optional(),
    logoStorageId: z.string().min(1).nullable(),
    name: activateOrganizationSchema.shape.name,
    organizerType: activateOrganizationSchema.shape.organizerType.optional(),
    organizerTypeLabel: z.string().optional(),
    phone: activateOrganizationSchema.shape.phone,
    pixKey: z.string(),
    pixKeyType: z.custom<PixKeyType>(
      (v) => v !== undefined && v !== null && v !== ""
    ),
    sports: z.array(z.string()).optional(),
    sportsLabel: z.string().optional(),
    website: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.organizerType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o tipo.",
        path: ["organizerType"],
      });
    }

    if (!isValidPixKey(value.pixKey ?? "", value.pixKeyType ?? "cpf")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chave PIX inválida para o tipo selecionado.",
        path: ["pixKey"],
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
      if (value.address) {
        for (const field of [
          "cep",
          "street",
          "number",
          "city",
          "state",
        ] as const) {
          if (!value.address[field]?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Campo obrigatório.",
              path: [`address.${field}`],
            });
          }
        }
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o endereço da sede.",
          path: ["address"],
        });
      }
    }

    if (value.organizerType === "outro" && !value.organizerTypeLabel?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Especifique o tipo da organização.",
        path: ["organizerTypeLabel"],
      });
    }

    if (value.sports?.includes("outro") && !value.sportsLabel?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Especifique a modalidade.",
        path: ["sportsLabel"],
      });
    }
  });

type OnboardingFormValues = z.input<typeof OnboardingFormSchema>;

const defaultValues: OnboardingFormValues = {
  acceptedTerms: false,
  address: undefined,
  contactEmail: "",
  description: "",
  logoDraftUri: undefined,
  logoStorageId: null,
  name: "",
  organizerType: undefined,
  organizerTypeLabel: "",
  phone: "",
  pixKey: "",
  pixKeyType: "cpf",
  sports: [],
  sportsLabel: "",
  website: "",
};

export default function OrganizationOnboarding() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const form = useForm<OnboardingFormValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(OnboardingFormSchema),
    reValidateMode: "onChange",
  });

  const logo = useOrganizationLogo(
    form as unknown as ReturnType<typeof useForm<OrganizationFormValues>>
  );

  const generateUploadUrl = useMutation(
    crpc.organization.profile.generateUploadUrl.mutationOptions()
  );

  const startPixOnboarding = useMutation(
    crpc.payment.onboarding.start.mutationOptions()
  );

  const activateOrganization = useMutation(
    crpc.viewer.context.activateOrganization.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível concluir o cadastro da organização. Tente novamente."
          ),
          id: "organization-onboarding-error",
          label: "Falha ao criar organização",
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

        // A org foi criada e o usuário agora é owner — provisiona a conta PIX
        // informada no mesmo formulário. Se falhar, a org já existe, então
        // redirecionamos para o perfil onde a chave pode ser concluída.
        const pixKey = form.getValues("pixKey") ?? "";
        const pixKeyType = form.getValues("pixKeyType") ?? "cpf";
        if (pixKey) {
          try {
            await startPixOnboarding.mutateAsync({
              pixKey: rawPixKey(pixKey, pixKeyType),
            });
            await queryClient.invalidateQueries(
              crpc.payment.onboarding.getStatus.queryFilter()
            );
            toast.show({
              description:
                "Você já pode criar e gerenciar ligas como organizador.",
              id: "organization-onboarding-success",
              label: "Organização criada",
              variant: "success",
            });
          } catch (error) {
            toast.show({
              description: getToastErrorMessage(
                error,
                "A organização foi criada, mas não foi possível conectar a chave PIX. Conclua no perfil."
              ),
              id: "organization-onboarding-pix-error",
              label: "Conta criada, PIX pendente",
              variant: "warning",
            });
          }
        } else {
          toast.show({
            description:
              "Você já pode criar e gerenciar ligas como organizador.",
            id: "organization-onboarding-success",
            label: "Organização criada",
            variant: "success",
          });
        }

        router.replace("/settings/organization/profile");
      },
    })
  );

  const isSubmitPending =
    activateOrganization.isPending ||
    generateUploadUrl.isPending ||
    startPixOnboarding.isPending ||
    logo.isLogoProcessing;

  const submitForm = form.handleSubmit(async (values) => {
    let logoStorageId = values.logoStorageId;

    try {
      logoStorageId =
        (await uploadPendingLogo(
          logo.pendingLogoFile,
          generateUploadUrl,
          form as unknown as ReturnType<typeof useForm<OrganizationFormValues>>
        )) ?? logoStorageId;
    } catch {
      toast.show({
        description:
          "Não foi possível enviar o logo. Verifique sua conexão e tente novamente.",
        id: "organization-logo-submit-error",
        label: "Falha no envio da imagem",
        variant: "danger",
      });
      return;
    }

    const payload: ActivateOrganizationInput = {
      acceptedTerms: {
        acceptedAt: new Date().toISOString(),
        userId: "",
        version: CURRENT_TERMS_VERSION,
      },
      address: isPhysicalOrganizationType(values.organizerType)
        ? {
            cep: values.address?.cep ?? "",
            city: values.address?.city ?? "",
            complement: values.address?.complement || undefined,
            district: values.address?.district || undefined,
            number: values.address?.number ?? "",
            state: values.address?.state ?? "",
            street: values.address?.street ?? "",
          }
        : undefined,
      contactEmail: values.contactEmail,
      description: values.description || undefined,
      logoStorageId,
      name: values.name,
      organizerType: values.organizerType!,
      organizerTypeLabel: values.organizerTypeLabel || undefined,
      phone: values.phone,
      sports: values.sports?.length
        ? (values.sports as ActivateOrganizationInput["sports"])
        : undefined,
      sportsLabel: values.sportsLabel || undefined,
      website: values.website || undefined,
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
        <Page.ScrollView contentContainerClassName="px-4 pb-safe-offset-4">
          <View className="gap-3">
            <OrganizationFormFields
              form={
                form as unknown as ReturnType<
                  typeof useForm<OrganizationFormValues>
                >
              }
              isSubmitPending={isSubmitPending}
              logo={logo}
              mode="onboarding"
            />

            <Controller
              control={form.control}
              name="acceptedTerms"
              render={({ field, fieldState }) => (
                <View>
                  <ControlField
                    className="gap-2"
                    isDisabled={isSubmitPending}
                    isSelected={Boolean(field.value)}
                    onSelectedChange={(next) => field.onChange(next)}
                  >
                    <ControlField.Indicator>
                      <Checkbox className="mt-0.5" />
                    </ControlField.Indicator>
                    <View className="flex-1 flex-row flex-wrap">
                      <Text className="text-muted text-sm">
                        Li e aceito os{" "}
                      </Text>
                      <LinkButton
                        onPress={() => setIsTermsOpen(true)}
                        size="sm"
                      >
                        <LinkButton.Label className="text-accent">
                          termos e condições
                        </LinkButton.Label>
                      </LinkButton>
                      <Text className="text-muted text-sm">.</Text>
                    </View>
                  </ControlField>
                  {fieldState.error ? (
                    <FieldError>{fieldState.error.message ?? ""}</FieldError>
                  ) : null}
                </View>
              )}
            />
          </View>
        </Page.ScrollView>
        <Page.Footer className="px-4 pt-4 pb-safe-offset-4">
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

      <Dialog isOpen={isTermsOpen} onOpenChange={setIsTermsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <Dialog.Close className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Termos e condições</Dialog.Title>
            <Dialog.Description>
              Ao ativar o modo organizador, você concorda com as regras de uso
              da plataforma BR Open para organizações, incluindo a
              responsabilidade sobre os dados informados, o compromisso de
              manter as informações atualizadas e o cumprimento das normas
              vigentes para a gestão de competições esportivas.
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
