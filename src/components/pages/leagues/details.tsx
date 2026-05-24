import {
  FieldError,
  Input,
  Label,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { useController, useFormContext } from "react-hook-form";
import { Image as NativeImage } from "react-native";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { Image } from "@/components/core/image";

type DetailsProps = {
  isDisabled?: boolean;
};

export const Details = ({ isDisabled }: DetailsProps) => {
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
      <PressableFeedback className="aspect-video w-full overflow-hidden rounded-3xl">
        <NativeImage
          className="size-full"
          source={{
            uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
          }}
        />
        <PressableFeedback.Highlight />
      </PressableFeedback>

      <PressableFeedback className="-mt-20 self-center rounded-full">
        <Image
          alt="Perfil"
          className="size-30 rounded-full"
          fallback="blue"
          source="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
        />
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
