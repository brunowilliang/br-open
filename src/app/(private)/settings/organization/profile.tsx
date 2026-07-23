import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, useToast } from "heroui-native";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { ErrorState } from "@/components/ui/error-state";
import {
  OrganizationFormFields,
  uploadPendingLogo,
  useOrganizationLogo,
  type OrganizationFormValues,
} from "@/components/pages/organization/organization-form-fields";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  upsertOrganizationSchema,
  type UpsertOrganizationInput,
} from "@convex/domains/organization/contract";
import { z } from "zod";

const EditFormSchema = z.object({
  address: upsertOrganizationSchema.shape.address.optional(),
  contactEmail: upsertOrganizationSchema.shape.contactEmail,
  description: z.string().optional(),
  logoDraftUri: z.string().optional(),
  logoStorageId: upsertOrganizationSchema.shape.logoStorageId,
  name: upsertOrganizationSchema.shape.name,
  organizerType: upsertOrganizationSchema.shape.organizerType.optional(),
  organizerTypeLabel: z.string().optional(),
  phone: upsertOrganizationSchema.shape.phone,
  sports: z.array(z.string()).optional(),
  sportsLabel: z.string().optional(),
  website: z.string().optional(),
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
  organizerTypeLabel: "",
  phone: "",
  sports: [],
  sportsLabel: "",
  website: "",
};

export default function OrganizationProfile() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const organization = useQuery(crpc.organization.profile.get.queryOptions());

  const form = useForm<EditFormValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(EditFormSchema),
    reValidateMode: "onChange",
  });

  const logo = useOrganizationLogo(
    form as unknown as ReturnType<typeof useForm<OrganizationFormValues>>
  );

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
      organizerTypeLabel: organization.data.organizerTypeLabel ?? "",
      phone: organization.data.phone ?? "",
      sports: organization.data.sports ?? [],
      sportsLabel: organization.data.sportsLabel ?? "",
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
            "Não foi possível salvar as informações da organização. Tente novamente."
          ),
          id: "update-organization-profile-error",
          label: "Falha ao salvar perfil",
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
          organizerTypeLabel: next.organizerTypeLabel ?? "",
          phone: next.phone ?? "",
          sports: next.sports ?? [],
          sportsLabel: next.sportsLabel ?? "",
          website: next.website ?? "",
        });
        await form.trigger();
        logo.setLogoPreviewUri(null);
        logo.setPendingLogoFile(null);
        toast.show({
          description: "As informações da organização foram atualizadas.",
          id: "update-organization-profile-success",
          label: "Perfil salvo",
          variant: "success",
        });
      },
    })
  );

  const logoSource =
    logo.logoPreviewUri ?? organization.data?.logoUrl ?? undefined;

  const isSubmitPending =
    updateProfile.isPending ||
    generateUploadUrl.isPending ||
    logo.isLogoProcessing ||
    organization.isPending;

  const canSubmit =
    (form.formState.isDirty || Boolean(logo.pendingLogoFile)) &&
    form.formState.isValid &&
    !isSubmitPending;

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

    const payload: UpsertOrganizationInput = {
      address: values.address,
      contactEmail: values.contactEmail,
      description: values.description,
      logoStorageId,
      name: values.name,
      organizerType: values.organizerType!,
      organizerTypeLabel: values.organizerTypeLabel,
      phone: values.phone,
      sports: values.sports?.length
        ? (values.sports as UpsertOrganizationInput["sports"])
        : undefined,
      sportsLabel: values.sportsLabel,
      website: values.website,
    };

    await updateProfile.mutateAsync(payload);
  });

  const isError = organization.isError;
  const isLoading = organization.isPending;
  const isLoaded = !(isLoading || isError);

  return (
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
                logoSource={logoSource}
                mode="profile"
              />
            </View>
          </Page.ScrollView>
          <Page.Footer className="px-4 pt-4 pb-safe-offset-4">
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
  );
}
