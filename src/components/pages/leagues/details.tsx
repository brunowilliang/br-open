import {
  Avatar,
  Description,
  FieldError,
  Input,
  Label,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { Image } from "react-native";

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
  onRegulationBlur: () => void;
  onRegulationChange: (value: string) => void;
  regulation: string;
  regulationError?: string;
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
  onRegulationBlur,
  onRegulationChange,
  regulation,
  regulationError,
}: DetailsProps) => (
  <>
    <PressableFeedback className="aspect-video w-full overflow-hidden rounded-3xl">
      <Image
        className="size-full"
        source={{
          uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
        }}
      />
      <PressableFeedback.Highlight />
    </PressableFeedback>

    <PressableFeedback className="-mt-20 self-center rounded-full">
      <Avatar alt="Perfil" className="size-30">
        <Avatar.Image
          source={{
            uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
          }}
        />
        <Avatar.Fallback>BW</Avatar.Fallback>
      </Avatar>
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
    <TextField isInvalid={Boolean(regulationError)}>
      <Label>Regulamento</Label>
      <TextArea
        editable={!isDisabled}
        onBlur={onRegulationBlur}
        onChangeText={onRegulationChange}
        placeholder="Ex: Jogos devem ser marcados com antecedência..."
        value={regulation}
      />
      <Description>
        Descreva as regras gerais, combinados e orientações da liga.
      </Description>
      <FieldError>{regulationError ?? ""}</FieldError>
    </TextField>
  </>
);
