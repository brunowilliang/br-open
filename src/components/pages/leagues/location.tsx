import { FieldError, Input, Label, TextArea, TextField } from "heroui-native";
import { useController, useFormContext } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";

type LocationProps = {
  isDisabled?: boolean;
};

export const Location = ({ isDisabled }: LocationProps) => {
  const { control } = useFormContext<LeagueScreenValues>();
  const { field: cityField, fieldState: cityState } = useController({
    control,
    name: "city",
  });
  const { field: stateField, fieldState: stateState } = useController({
    control,
    name: "state",
  });
  const { field: locationNotesField, fieldState: locationNotesState } =
    useController({
      control,
      name: "locationNotes",
    });

  return (
    <>
      <TextField isInvalid={Boolean(cityState.error)} isRequired>
        <Label>Cidade</Label>
        <Input
          editable={!isDisabled}
          onBlur={cityField.onBlur}
          onChangeText={cityField.onChange}
          placeholder="Ex: Florianópolis"
          value={cityField.value}
        />
        <FieldError>{cityState.error?.message ?? ""}</FieldError>
      </TextField>

      <TextField isInvalid={Boolean(stateState.error)} isRequired>
        <Label>Estado</Label>
        <Input
          autoCapitalize="characters"
          editable={!isDisabled}
          onBlur={stateField.onBlur}
          onChangeText={stateField.onChange}
          placeholder="Ex: SC"
          value={stateField.value}
        />
        <FieldError>{stateState.error?.message ?? ""}</FieldError>
      </TextField>

      <TextField isInvalid={Boolean(locationNotesState.error)}>
        <Label>Complemento do local</Label>
        <TextArea
          editable={!isDisabled}
          onBlur={locationNotesField.onBlur}
          onChangeText={locationNotesField.onChange}
          placeholder="Ex: Quadra 3 do clube"
          value={locationNotesField.value ?? ""}
        />
        <FieldError>{locationNotesState.error?.message ?? ""}</FieldError>
      </TextField>
    </>
  );
};
