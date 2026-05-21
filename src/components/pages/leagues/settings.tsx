import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import type { ApiInputs } from "@convex/shared/api";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import {
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  Select,
  Surface,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

type CreateLeagueInput = ApiInputs["league"]["management"]["create"];

type SettingsProps = {
  isDisabled?: boolean;
  onChange: (value: CreateLeagueInput["visibility"]) => void;
  onDelete?: () => Promise<void>;
  showDelete?: boolean;
  value: CreateLeagueInput["visibility"];
  visibilityError?: string;
};

const visibilityOptions = [
  { label: "Pública", value: "public" as const },
  { label: "Privada", value: "private" as const },
  { label: "Somente por convite", value: "invite_only" as const },
];

export const Settings = ({
  isDisabled,
  onChange,
  onDelete,
  showDelete,
  value,
  visibilityError,
}: SettingsProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  async function handleConfirmDelete() {
    if (!onDelete) {
      return;
    }

    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch {
      // Keep the dialog open so the user can retry after the toast feedback.
    }
  }

  return (
    <>
      <View className="gap-6">
        <TextField isInvalid={Boolean(visibilityError)} isRequired>
          <Label>Visibilidade</Label>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                onChange(nextValue.value as CreateLeagueInput["visibility"]);
              }
            }}
            selectionMode="single"
            value={visibilityOptions.find((option) => option.value === value)}
          >
            <Select.Trigger>
              <Select.Value numberOfLines={1} placeholder="Escolha uma opção" />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {visibilityOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <Description>
            Define quem pode encontrar e entrar na liga.
          </Description>
          <FieldError>{visibilityError ?? ""}</FieldError>
        </TextField>

        {showDelete ? (
          <Surface className="gap-3 border border-danger-soft bg-danger-soft">
            <View className="flex-row items-center gap-2">
              <HugeIcons className="text-danger" icon={Alert02Icon} />
              <Text className="text-danger">Deletar liga</Text>
            </View>
            <Description>
              Remove permanentemente a liga e todas as configurações vinculadas.
            </Description>
            <Button
              className="self-start"
              isDisabled={isDisabled || !onDelete}
              onPress={() => {
                setIsDeleteDialogOpen(true);
              }}
              variant="danger-soft"
            >
              <Button.Label>Deletar liga</Button.Label>
            </Button>
          </Surface>
        ) : null}
      </View>

      <Dialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isDisabled) {
            return;
          }
          setIsDeleteDialogOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            {isDisabled ? null : (
              <Dialog.Close className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Deletar liga</Dialog.Title>
            <Description>
              Essa ação remove permanentemente a liga e não pode ser desfeita.
            </Description>

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={isDisabled}
                onPress={() => {
                  setIsDeleteDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                isDisabled={isDisabled || !onDelete}
                onPress={() => {
                  handleConfirmDelete().catch(() => undefined);
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Deletar liga</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};
