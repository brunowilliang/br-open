import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  Description,
  FieldError,
  Input,
  Label,
  PressableFeedback,
  Select,
  TextField,
} from "heroui-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { View } from "react-native";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";

import { applyPhoneInputChange, formatPhoneBR } from "@/lib/format/phone";
import {
  USERNAME_FIELD_HINT,
  USERNAME_TAKEN_MESSAGE,
  normalizeUsername,
} from "@/lib/account/username-rules";
import type { UsernameAvailabilityStatus } from "@/lib/account/use-username-availability";

export const genderOptions = [
  { label: "Masculino", value: "Masculino" as const },
  { label: "Feminino", value: "Feminino" as const },
];

export type ProfileDetailsFormValues = {
  avatarDraftUri?: string;
  avatarStorageId: null | string | undefined;
  fullName: string;
  gender?: string;
  nickname: string;
  phone?: null | string;
  username?: string;
};

type ProfileDetailsSectionProps = {
  avatarSource?: string;
  form: UseFormReturn<ProfileDetailsFormValues>;
  isSubmitPending: boolean;
  onAvatarPress: () => void;
  onPhoneSubmitEditing?: () => void;
  usernameStatus: UsernameAvailabilityStatus;
};

/**
 * Conteúdo do acordeão "Detalhes": avatar + campos do perfil do jogador.
 * A tela (rota) continua dona das mutations — aqui é só o form controlado.
 */
export function ProfileDetailsSection(props: ProfileDetailsSectionProps) {
  const {
    avatarSource,
    form,
    isSubmitPending,
    onAvatarPress,
    onPhoneSubmitEditing,
    usernameStatus,
  } = props;
  const displayName =
    (form.watch("fullName") as string | undefined) || "Seu perfil";

  return (
    <>
      <PressableFeedback
        className="self-center rounded-full"
        isDisabled={isSubmitPending}
        onPress={onAvatarPress}
      >
        <Image
          alt={displayName}
          className="size-30 rounded-full"
          fallback="green"
          source={avatarSource}
        />
        <View className="centered absolute inset-0 bg-black/45">
          <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
          <Text className="text-white" variant="description">
            {isSubmitPending ? "Salvando..." : "Alterar Avatar"}
          </Text>
        </View>
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <Text className="text-xl">{displayName}</Text>

      <Controller
        control={form.control}
        name="fullName"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Nome completo</Label>
            <Input
              autoCapitalize="words"
              editable={!isSubmitPending}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Seu nome completo"
              textContentType="name"
              value={field.value ?? ""}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />

      <Controller
        control={form.control}
        name="nickname"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Apelido</Label>
            <Input
              editable={!isSubmitPending}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Seu apelido"
              textContentType="nickname"
              value={field.value ?? ""}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />

      <Controller
        control={form.control}
        name="username"
        render={({ field, fieldState }) => {
          const isTaken = usernameStatus === "taken";

          return (
            <TextField
              className="w-full"
              isInvalid={Boolean(fieldState.error) || isTaken}
            >
              <Label>Username</Label>
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitPending}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="maria.silva"
                textContentType="username"
                value={field.value ?? ""}
                variant="secondary"
              />
              <Description
                className={
                  usernameStatus === "available" ? "text-success" : undefined
                }
              >
                {usernameStatus === "available"
                  ? `@${normalizeUsername(field.value ?? "")} está disponível.`
                  : usernameStatus === "checking"
                    ? "Verificando disponibilidade..."
                    : USERNAME_FIELD_HINT}
              </Description>
              <FieldError>
                {isTaken
                  ? USERNAME_TAKEN_MESSAGE
                  : (fieldState.error?.message ?? "")}
              </FieldError>
            </TextField>
          );
        }}
      />

      <Controller
        control={form.control}
        name="gender"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Gênero</Label>

            <Select
              isDisabled={isSubmitPending}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  form.setValue(
                    "gender",
                    nextValue.value as ProfileDetailsFormValues["gender"],
                    {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    }
                  );
                }
              }}
              selectionMode="single"
              value={genderOptions.find(
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
                <SelectScrollContent label="Escolha uma opção" width="trigger">
                  {genderOptions.map((option) => (
                    <SelectOptionItem
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </SelectScrollContent>
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
          <TextField className="w-full" isInvalid={Boolean(fieldState.error)}>
            <Label>Telefone/WhatsApp</Label>
            <Input
              editable={!isSubmitPending}
              keyboardType="phone-pad"
              onBlur={field.onBlur}
              onChangeText={(text) =>
                field.onChange(
                  formatPhoneBR(applyPhoneInputChange(field.value ?? "", text))
                )
              }
              onSubmitEditing={onPhoneSubmitEditing}
              placeholder="(00) 00000-0000"
              textContentType="telephoneNumber"
              value={formatPhoneBR(field.value ?? "")}
              variant="secondary"
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
    </>
  );
}
