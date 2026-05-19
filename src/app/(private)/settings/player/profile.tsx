import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Tabs,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { Text } from "@/components/ui/text";
import { useCRPC } from "@/lib/convex/crpc";
import { playerProfileSchema } from "@convex/domains/player/contract";
import { Edit01Icon } from "@hugeicons/core-free-icons";
import { z } from "zod";

const PlayerProfileFormSchema = z
  .object({
    fullName: playerProfileSchema.shape.fullName,
    gender: playerProfileSchema.shape.gender.optional(),
    nickname: playerProfileSchema.shape.nickname,
    phone: z.string().optional(),
  })
  .pipe(playerProfileSchema);

type PlayerProfileFormValues = z.input<typeof PlayerProfileFormSchema>;
type PlayerProfileValues = z.output<typeof PlayerProfileFormSchema>;

const defaultValues: PlayerProfileFormValues = {
  fullName: "",
  gender: undefined,
  nickname: "",
  phone: "",
};

const genderOptions = [
  { label: "Masculino", value: "Masculino" as const },
  { label: "Feminino", value: "Feminino" as const },
];

export default function PlayerProfile() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const playerProfile = useQuery(crpc.player.profile.get.queryOptions());
  const [activeTab, setActiveTab] = useState("geral");

  const form = useForm<PlayerProfileFormValues, unknown, PlayerProfileValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(PlayerProfileFormSchema),
  });

  useEffect(() => {
    if (!playerProfile.data) {
      return;
    }

    form.reset(playerProfile.data);
  }, [form, playerProfile.data]);

  const updateProfile = useMutation(
    crpc.player.profile.upsert.mutationOptions({
      onSuccess: async (nextProfile) => {
        await queryClient.invalidateQueries(
          crpc.player.profile.get.queryFilter()
        );
        form.reset(nextProfile);
        toast.show({
          description: "Perfil atualizado com sucesso.",
          id: "update-player-profile-success",
          label: "Perfil atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: error.message || "Não foi possível atualizar o perfil.",
          id: "update-player-profile-error",
          label: "Erro ao atualizar perfil",
          variant: "danger",
        });
      },
    })
  );

  const isSubmitPending =
    updateProfile.isPending ||
    form.formState.isSubmitting ||
    playerProfile.isPending;
  const canSubmit =
    form.formState.isDirty && form.formState.isValid && !isSubmitPending;
  const displayName = form.watch("fullName") || "Seu perfil";

  const submitForm = form.handleSubmit(async (values) => {
    updateProfile.reset();
    await updateProfile.mutateAsync(values);
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
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
          <ErrorState message={playerProfile.error.message} />
        </Page.ScrollView>
      </Page>
    );
  }

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
      <Page.KeyboardAwareScrollView contentContainerClassName="items-center gap-6">
        <View>
          <Avatar alt={displayName} className="size-30">
            <Avatar.Image
              source={{
                uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
              }}
            />
            <Avatar.Fallback>BW</Avatar.Fallback>
          </Avatar>
          <Button
            className="absolute -right-2 -bottom-2"
            isIconOnly
            variant="secondary"
          >
            <HugeIcons className="text-accent" icon={Edit01Icon} />
          </Button>
        </View>
        <Text className="text-xl">{displayName}</Text>

        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <Tabs.List className="self-center">
            <Tabs.Indicator />
            <Tabs.Trigger value="geral">
              <Tabs.Label>Geral</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="informacao">
              <Tabs.Label>Acesso</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content className="min-w-full gap-4 px-4" value="geral">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <TextField isInvalid={Boolean(fieldState.error)} isRequired>
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
                <TextField isInvalid={Boolean(fieldState.error)} isRequired>
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
                <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                  <Label>Gênero</Label>

                  <Select
                    isDisabled={isSubmitPending}
                    onValueChange={(nextValue) => {
                      if (nextValue && !Array.isArray(nextValue)) {
                        field.onChange(nextValue.value);
                      }
                    }}
                    selectionMode="single"
                    value={genderOptions.find(
                      (option) => option.value === field.value
                    )}
                  >
                    <Select.Trigger>
                      <Select.Value
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
                <TextField isInvalid={Boolean(fieldState.error)}>
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
          </Tabs.Content>
          <Tabs.Content className="centered min-w-full px-4" value="informacao">
            <Text>ainda nao implementado</Text>
          </Tabs.Content>
        </Tabs>
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
  );
}
