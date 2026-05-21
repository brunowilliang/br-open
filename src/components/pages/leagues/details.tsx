import {
  FieldError,
  Input,
  Label,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { Image as NativeImage } from "react-native";

import { Image } from "@/components/core/image";

type DetailsProps = {
  description: string;
  descriptionError?: string;
  isDisabled?: boolean;
  name: string;
  nameError?: string;
  onDescriptionBlur: () => void;
  onDescriptionChange: (value: string) => void;
  onNameBlur: () => void;
  onNameChange: (value: string) => void;
};

export const Details = ({
  description,
  descriptionError,
  isDisabled,
  name,
  nameError,
  onDescriptionBlur,
  onDescriptionChange,
  onNameBlur,
  onNameChange,
}: DetailsProps) => (
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

    <TextField isInvalid={Boolean(nameError)} isRequired>
      <Label>Nome da liga</Label>
      <Input
        editable={!isDisabled}
        onBlur={onNameBlur}
        onChangeText={onNameChange}
        placeholder="Placeholder"
        value={name}
      />
      <FieldError>{nameError ?? ""}</FieldError>
    </TextField>
    <TextField isInvalid={Boolean(descriptionError)}>
      <Label>Descrição da liga</Label>
      <TextArea
        editable={!isDisabled}
        onBlur={onDescriptionBlur}
        onChangeText={onDescriptionChange}
        placeholder="Enter your message"
        value={description}
      />
      <FieldError>{descriptionError ?? ""}</FieldError>
    </TextField>
  </>
);
