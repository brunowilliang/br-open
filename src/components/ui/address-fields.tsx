import {
  FieldError,
  Input,
  InputGroup,
  Label,
  Select,
  Spinner,
  TextField,
} from "heroui-native";
import { useRef, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { applyCepInputChange, formatCep } from "@/lib/format/cep";
import { BRAZILIAN_STATES } from "@/lib/format/states";
import { fetchAddressByCep } from "@/lib/uploads/viacep";

type AddressFormValue = {
  cep?: string;
  city?: string;
  complement?: string;
  district?: string;
  number?: string;
  state?: string;
  street?: string;
};

type AddressFormValues = { address?: AddressFormValue };

const stateOptions = BRAZILIAN_STATES.map((state) => ({
  label: state,
  value: state,
}));

/** Bloco de endereço compartilhado (perfil da organização + wizard de torneio):
 * ordem, placeholders e CEP tolerante num só lugar — não duplicar por tela. */
export function AddressFields<TFieldValues extends AddressFormValues>(props: {
  form: UseFormReturn<TFieldValues>;
  isSubmitPending: boolean;
  variant?: "primary" | "secondary";
}) {
  // O caminho dos campos (`address.*`) é o mesmo nos dois forms; o restante do
  // form de cada tela não importa aqui.
  const form = props.form as unknown as UseFormReturn<AddressFormValues>;
  const { isSubmitPending, variant } = props;
  const [isCepLookingUp, setIsCepLookingUp] = useState(false);
  const cepLookupRef = useRef<null | string>(null);
  const isLocked = isSubmitPending || isCepLookingUp;

  async function handleCepChange(rawValue: string | undefined) {
    const cep = (rawValue ?? "").replace(/\D/g, "");

    if (cep.length === 8 && cep !== cepLookupRef.current) {
      cepLookupRef.current = cep;
      setIsCepLookingUp(true);

      try {
        const result = await fetchAddressByCep(cep);

        // Resposta de um CEP antigo (A em voo, campo já em B) não sobrescreve o
        // que o usuário digitou depois.
        const currentCep = String(form.getValues("address.cep") ?? "").replace(
          /\D/g,
          ""
        );

        if (currentCep !== cep) {
          return;
        }

        form.setValue("address.street", result.street, { shouldDirty: true });
        form.setValue("address.district", result.district, {
          shouldDirty: true,
        });
        form.setValue("address.city", result.city, { shouldDirty: true });
        form.setValue("address.state", result.state, { shouldDirty: true });
        await form.trigger();
      } catch {
        // CEP não encontrado ou falha na busca: o preenchimento manual assume,
        // sem erro no campo.
      } finally {
        // Só o dono da busca em voo desliga o spinner e libera o ref.
        if (cepLookupRef.current === cep) {
          setIsCepLookingUp(false);
          cepLookupRef.current = null;
        }
      }
    }
  }

  return (
    <>
      <Controller
        control={form.control}
        name="address.cep"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>CEP</Label>
            <InputGroup>
              <InputGroup.Input
                editable={!isSubmitPending}
                keyboardType="numeric"
                onBlur={field.onBlur}
                onChangeText={(text) => {
                  const next = formatCep(
                    applyCepInputChange(String(field.value ?? ""), text)
                  );
                  field.onChange(next);
                  handleCepChange(next);
                }}
                placeholder="00000-000"
                returnKeyType="search"
                value={formatCep(String(field.value ?? ""))}
                variant={variant}
              />
              {isCepLookingUp ? (
                <InputGroup.Suffix isDecorative>
                  <Spinner size="sm" />
                </InputGroup.Suffix>
              ) : null}
            </InputGroup>
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="address.street"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Endereço</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Ex.: Rua das Palmeiras"
              value={String(field.value ?? "")}
              variant={variant}
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="address.number"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Número</Label>
            <Input
              editable={!isLocked}
              keyboardType="numeric"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Ex.: 123"
              value={String(field.value ?? "")}
              variant={variant}
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="address.district"
        render={({ field }) => (
          <TextField className="w-full">
            <Label>Bairro</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Ex.: Centro"
              value={String(field.value ?? "")}
              variant={variant}
            />
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="address.city"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Cidade</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Ex.: São Paulo"
              value={String(field.value ?? "")}
              variant={variant}
            />
            <FieldError>{fieldState.error?.message ?? ""}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="address.state"
        render={({ field, fieldState }) => (
          <TextField
            className="w-full"
            isInvalid={Boolean(fieldState.error)}
            isRequired
          >
            <Label>Estado</Label>
            <Select
              isDisabled={isLocked}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  field.onChange(nextValue.value);
                }
              }}
              selectionMode="single"
              value={stateOptions.find(
                (option) => option.value === field.value
              )}
            >
              <Select.Trigger
                className={variant === "secondary" ? "bg-default" : undefined}
              >
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
                  {stateOptions.map((option) => (
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
        name="address.complement"
        render={({ field }) => (
          <TextField className="w-full">
            <Label>Complemento</Label>
            <Input
              editable={!isLocked}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Ex.: Apto 42, bloco B"
              value={String(field.value ?? "")}
              variant={variant}
            />
          </TextField>
        )}
      />
    </>
  );
}
