import { FieldError, Input, Label, TextArea, TextField } from "heroui-native";

type LocationProps = {
  city: string;
  cityError?: string;
  isDisabled?: boolean;
  locationNotes: string;
  locationNotesError?: string;
  onCityBlur: () => void;
  onCityChange: (value: string) => void;
  onLocationNotesBlur: () => void;
  onLocationNotesChange: (value: string) => void;
  onStateBlur: () => void;
  onStateChange: (value: string) => void;
  state: string;
  stateError?: string;
};

export const Location = ({
  city,
  cityError,
  isDisabled,
  locationNotes,
  locationNotesError,
  onCityBlur,
  onCityChange,
  onLocationNotesBlur,
  onLocationNotesChange,
  onStateBlur,
  onStateChange,
  state,
  stateError,
}: LocationProps) => (
  <>
    <TextField isInvalid={Boolean(cityError)} isRequired>
      <Label>Cidade</Label>
      <Input
        editable={!isDisabled}
        onBlur={onCityBlur}
        onChangeText={onCityChange}
        placeholder="Ex: Florianópolis"
        value={city}
      />
      <FieldError>{cityError ?? ""}</FieldError>
    </TextField>

    <TextField isInvalid={Boolean(stateError)} isRequired>
      <Label>Estado</Label>
      <Input
        autoCapitalize="characters"
        editable={!isDisabled}
        onBlur={onStateBlur}
        onChangeText={onStateChange}
        placeholder="Ex: SC"
        value={state}
      />
      <FieldError>{stateError ?? ""}</FieldError>
    </TextField>

    <TextField isInvalid={Boolean(locationNotesError)}>
      <Label>Complemento do local</Label>
      <TextArea
        editable={!isDisabled}
        onBlur={onLocationNotesBlur}
        onChangeText={onLocationNotesChange}
        placeholder="Ex: Quadra 3 do clube"
        value={locationNotes}
      />
      <FieldError>{locationNotesError ?? ""}</FieldError>
    </TextField>
  </>
);
