import {
  FieldError,
  Input,
  Label,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { useController, useFormContext } from "react-hook-form";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { ImageUploadIcon } from "@hugeicons/core-free-icons";

type LeagueMediaKind = "avatar" | "cover";

type DetailsProps = {
  avatarUrl?: string | null;
  coverUrl?: string | null;
  isDisabled?: boolean;
  isMediaUploading?: boolean;
  onMediaPress?: (kind: LeagueMediaKind) => void;
};

export const Details = ({
  avatarUrl,
  coverUrl,
  isDisabled,
  isMediaUploading,
  onMediaPress,
}: DetailsProps) => {
  const { control } = useFormContext<LeagueScreenValues>();
  const { field: nameField, fieldState: nameState } = useController({
    control,
    name: "name",
  });
  const { field: descriptionField, fieldState: descriptionState } =
    useController({
      control,
      name: "description",
    });

  return (
    <>
      <PressableFeedback
        className="aspect-video w-full overflow-hidden rounded-3xl"
        isDisabled={isDisabled}
        onPress={() => onMediaPress?.("cover")}
      >
        <Image
          className="size-full"
          contentFit="cover"
          fallback="blue"
          source={coverUrl ?? undefined}
        />
        <View className="centered absolute inset-0 bg-black/45">
          <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
          <Text className="mb-7 text-white" variant="description">
            {isMediaUploading ? "Salvando..." : "Alterar Banner"}
          </Text>
        </View>
        <PressableFeedback.Highlight />
      </PressableFeedback>

      <PressableFeedback
        className="-mt-20 self-center rounded-full"
        isDisabled={isDisabled}
        onPress={() => onMediaPress?.("avatar")}
      >
        <Image
          alt="Perfil"
          className="size-30 rounded-full"
          fallback="blue"
          source={avatarUrl ?? undefined}
        />
        <View className="centered absolute inset-0 bg-black/45">
          <HugeIcons className="size-6 text-white" icon={ImageUploadIcon} />
          <Text className="text-white" variant="description">
            {isMediaUploading ? "Salvando..." : "Alterar Avatar"}
          </Text>
        </View>
        <PressableFeedback.Highlight />
      </PressableFeedback>

      <TextField isInvalid={Boolean(nameState.error)} isRequired>
        <Label>Nome da liga</Label>
        <Input
          editable={!isDisabled}
          onBlur={nameField.onBlur}
          onChangeText={nameField.onChange}
          placeholder="Placeholder"
          value={nameField.value}
        />
        <FieldError>{nameState.error?.message ?? ""}</FieldError>
      </TextField>
      <TextField isInvalid={Boolean(descriptionState.error)}>
        <Label>Descrição da liga</Label>
        <TextArea
          editable={!isDisabled}
          onBlur={descriptionField.onBlur}
          onChangeText={descriptionField.onChange}
          placeholder="Enter your message"
          value={descriptionField.value ?? ""}
        />
        <FieldError>{descriptionState.error?.message ?? ""}</FieldError>
      </TextField>
    </>
  );
};
