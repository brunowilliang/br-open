import { PlayerProfileSchema } from "@convex/zod-schemas/player-profile";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { CalendarDate } from "@internationalized/date";
import { DateFormatter, getLocalTimeZone } from "@internationalized/date";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
  TextField,
  useToast,
} from "heroui-native";
import { Calendar } from "heroui-native-pro/calendar";
import { DatePicker } from "heroui-native-pro/date-picker";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

import { Header } from "@/components/ui/header";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";

const selectOptions = (options: readonly string[]) =>
  options
    .filter((option) => option !== "")
    .map((option) => ({ label: option, value: option }));
const genderOptions = selectOptions(PlayerProfileSchema.shape.gender.options);
const stateOptions = selectOptions(PlayerProfileSchema.shape.state.options);
const playerCountry = PlayerProfileSchema.shape.country;

const BIRTH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const birthDateFormatter = new DateFormatter("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatBirthDate(date: CalendarDate) {
  return birthDateFormatter.format(date.toDate(getLocalTimeZone()));
}

export default function PlayerProfile() {
  const crpc = useCRPC();
  const { toast } = useToast();
  const [isBirthDateOpen, setBirthDateOpen] = useState(false);
  const playerProfile = useQuery(crpc.player.profile.get.queryOptions());

  const form = useForm({
    defaultValues: {
      country: "Brasil",
    },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(PlayerProfileSchema),
    values: playerProfile.data ?? undefined,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const saveProfile = useMutation(
    crpc.player.profile.upsert.mutationOptions({
      onSuccess: () => {
        toast.show({
          description: "Os dados do jogador foram atualizados.",
          id: "player-profile-saved",
          label: "Perfil salvo",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: error.message || "Não foi possível salvar o perfil.",
          id: "player-profile-error",
          label: "Não foi possível salvar",
          variant: "danger",
        });
      },
    })
  );

  const isSubmitPending =
    playerProfile.isPending ||
    saveProfile.isPending ||
    form.formState.isSubmitting;
  const submitForm = form.handleSubmit(async (values) => {
    saveProfile.reset();
    await saveProfile.mutateAsync(values);
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Header.Icon
            className="size-5.5 text-foreground"
            icon={ArrowLeft01Icon}
            onPress={() => router.back()}
          />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Perfil de jogador</Page.Header.Title>
          <Page.Header.SubTitle>
            Dados esportivos e informações públicas
          </Page.Header.SubTitle>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-6 px-4 pb-safe-offset-4">
        <View className="gap-4">
          <Controller
            control={form.control}
            name="fullName"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Nome completo</Label>
                <Input
                  autoCapitalize="words"
                  autoComplete="name"
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
                  autoCapitalize="words"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Como você aparece nas competições"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="birthDate"
            render={({ field, fieldState }) => {
              const birthDate = BIRTH_DATE_PATTERN.exec(field.value ?? "");

              return (
                <DatePicker
                  dateDisplayFormat="short"
                  formatDate={formatBirthDate}
                  isDisabled={isSubmitPending}
                  isInvalid={Boolean(fieldState.error)}
                  isOpen={isBirthDateOpen}
                  isRequired
                  locale="pt-BR"
                  onOpenChange={(open) => {
                    setBirthDateOpen(open);

                    if (!open) {
                      field.onBlur();
                    }
                  }}
                  onValueChange={(value) => field.onChange(value?.label ?? "")}
                  value={
                    birthDate
                      ? {
                          label: field.value ?? "",
                          value: `${birthDate[3]}-${birthDate[2]}-${birthDate[1]}`,
                        }
                      : undefined
                  }
                >
                  <Label>Data de nascimento</Label>
                  <DatePicker.Select presentation="dialog">
                    <DatePicker.Trigger>
                      <DatePicker.Value placeholder="Selecionar data" />
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                    <DatePicker.Portal>
                      <DatePicker.Overlay />
                      <DatePicker.Content presentation="dialog">
                        <DatePicker.Calendar>
                          <Calendar.Header>
                            <Calendar.YearPickerTrigger>
                              <Calendar.YearPickerTriggerHeading />
                              <Calendar.YearPickerTriggerIndicator />
                            </Calendar.YearPickerTrigger>
                            <Calendar.NavButton slot="previous" />
                            <Calendar.NavButton slot="next" />
                          </Calendar.Header>
                          <Calendar.Grid>
                            <Calendar.GridHeader>
                              {(day) => <Calendar.HeaderCell day={day} />}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>
                              {(date) => <Calendar.Cell date={date} />}
                            </Calendar.GridBody>
                          </Calendar.Grid>
                          <Calendar.YearPickerGrid>
                            <Calendar.YearPickerGridBody>
                              {({ year, isSelected }) => (
                                <Calendar.YearPickerCell
                                  isSelected={isSelected}
                                  year={year}
                                />
                              )}
                            </Calendar.YearPickerGridBody>
                          </Calendar.YearPickerGrid>
                        </DatePicker.Calendar>
                      </DatePicker.Content>
                    </DatePicker.Portal>
                  </DatePicker.Select>
                  <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                </DatePicker>
              );
            }}
          />

          <Controller
            control={form.control}
            name="address"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Endereço</Label>
                <Input
                  autoCapitalize="words"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Rua, número, bairro e complemento"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="city"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Cidade</Label>
                <Input
                  autoCapitalize="words"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Sua cidade"
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
              <View className="gap-1">
                <Label>Estado</Label>
                <Select
                  isDisabled={isSubmitPending}
                  onOpenChange={(open) => {
                    if (!open) {
                      field.onBlur();
                    }
                  }}
                  onValueChange={(value) => field.onChange(value?.value ?? "")}
                  presentation="bottom-sheet"
                  value={stateOptions.find(
                    (option) => option.value === field.value
                  )}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Selecionar estado" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content
                      contentContainerProps={{
                        className: "px-0 bottom-safe-offset-4",
                      }}
                      presentation="bottom-sheet"
                      snapPoints={["80%"]}
                    >
                      <BottomSheetScrollView
                        className="flex-1"
                        contentContainerClassName="px-4 pb-safe-offset-4"
                        keyboardShouldPersistTaps="handled"
                      >
                        <Select.ListLabel>Selecione um estado</Select.ListLabel>
                        {stateOptions.map((option) => (
                          <Select.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                          >
                            {({ isSelected }) => (
                              <>
                                <Select.ItemLabel
                                  className={
                                    isSelected
                                      ? "font-medium text-accent"
                                      : "text-foreground"
                                  }
                                />
                                <Select.ItemIndicator />
                              </>
                            )}
                          </Select.Item>
                        ))}
                      </BottomSheetScrollView>
                    </Select.Content>
                  </Select.Portal>
                </Select>
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="zipCode"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>CEP</Label>
                <Input
                  editable={!isSubmitPending}
                  keyboardType="number-pad"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="00000-000"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="country"
            render={({ field, fieldState }) => (
              <TextField
                isDisabled
                isInvalid={Boolean(fieldState.error)}
                isRequired
              >
                <Label>País</Label>
                <Input
                  editable={false}
                  onBlur={field.onBlur}
                  value={field.value ?? playerCountry}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="gender"
            render={({ field, fieldState }) => (
              <View className="gap-1">
                <Label>Gênero</Label>
                <Select
                  isDisabled={isSubmitPending}
                  onOpenChange={(open) => {
                    if (!open) {
                      field.onBlur();
                    }
                  }}
                  onValueChange={(value) => field.onChange(value?.value ?? "")}
                  presentation="bottom-sheet"
                  value={genderOptions.find(
                    (option) => option.value === field.value
                  )}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Selecionar gênero" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content
                      contentContainerProps={{
                        className: "px-4 pb-safe-offset-4",
                      }}
                      enableDynamicSizing
                      presentation="bottom-sheet"
                    >
                      <Select.ListLabel>Selecione o gênero</Select.ListLabel>
                      {genderOptions.map((option) => (
                        <Select.Item
                          key={option.value}
                          label={option.label}
                          value={option.value}
                        >
                          {({ isSelected }) => (
                            <>
                              <Select.ItemLabel
                                className={
                                  isSelected
                                    ? "font-medium text-accent"
                                    : "text-foreground"
                                }
                              />
                              <Select.ItemIndicator />
                            </>
                          )}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select>
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="cpf"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>CPF</Label>
                <Input
                  editable={!isSubmitPending}
                  keyboardType="number-pad"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="000.000.000-00"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Telefone/WhatsApp</Label>
                <Input
                  autoComplete="tel"
                  editable={!isSubmitPending}
                  keyboardType="phone-pad"
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
        </View>

        <Button
          isDisabled={isSubmitPending}
          onPress={handleSubmitPress}
          variant="primary"
        >
          <Button.Label>
            {saveProfile.isPending ? "Salvando..." : "Salvar perfil"}
          </Button.Label>
        </Button>
      </Page.ScrollView>
    </Page>
  );
}
