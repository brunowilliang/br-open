import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  AccordionLayoutTransition,
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  Menu,
  Select,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { RuleCard } from "@/components/pages/leagues/rule-card";
import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

const visibilityOptions = [
  { label: "Pública", value: "public" as const },
  { label: "Privada", value: "private" as const },
];

const approvalModeOptions = [
  { label: "Automática", value: "auto" as const },
  { label: "Manual", value: "manual" as const },
];

export default function TournamentSettingsRoute() {
  const { isSubmitPending, mode, onDelete, onSubmitPress, showDelete } =
    useTournamentFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Torneio" : "Editar Torneio";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control, getValues, setValue } =
    useFormContext<TournamentScreenValues>();
  const { errors } = useFormState({
    control,
    name: ["visibility", "approvalMode"],
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const visibility = useWatch({
    control,
    defaultValue: getValues("visibility"),
    name: "visibility",
  });
  const approvalMode = useWatch({
    control,
    defaultValue: getValues("approvalMode"),
    name: "approvalMode",
  });
  const visibilityError = errors.visibility?.message;
  const approvalModeError = errors.approvalMode?.message;

  async function handleConfirmDelete() {
    if (!onDelete) {
      return;
    }

    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch {
      // Mantém o diálogo aberto para o usuário tentar de novo após o erro.
    }
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Ajustes</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay className="bg-backdrop" />
              <Menu.Content presentation="popover" width={240}>
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle>Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <TextField isInvalid={Boolean(visibilityError)} isRequired>
          <Label>Visibilidade do torneio</Label>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "visibility",
                  nextValue.value as TournamentScreenValues["visibility"],
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  }
                );
              }
            }}
            selectionMode="single"
            value={visibilityOptions.find(
              (option) => option.value === visibility
            )}
          >
            <Select.Trigger>
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
                {visibilityOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </SelectScrollContent>
            </Select.Portal>
          </Select>
          <Description>
            Define quem pode encontrar o torneio na busca. Torneios privados
            ficam visíveis apenas para a organização.
          </Description>
          <FieldError>{visibilityError ?? ""}</FieldError>
        </TextField>

        <TextField isInvalid={Boolean(approvalModeError)} isRequired>
          <Label>Aprovação de inscrições</Label>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "approvalMode",
                  nextValue.value as TournamentScreenValues["approvalMode"],
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  }
                );
              }
            }}
            selectionMode="single"
            value={approvalModeOptions.find(
              (option) => option.value === approvalMode
            )}
          >
            <Select.Trigger>
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
                {approvalModeOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </SelectScrollContent>
            </Select.Portal>
          </Select>
          <Description>
            Automática: o jogador confirma (e paga, se houver taxa) direto.
            Manual: você aprova cada inscrição.
          </Description>
          <FieldError>{approvalModeError ?? ""}</FieldError>
        </TextField>

        {showDelete ? (
          <Animated.View className="gap-2" layout={AccordionLayoutTransition}>
            <RuleCard className="gap-3 border border-danger-soft bg-danger-soft">
              <View className="flex-row items-center gap-2">
                <HugeIcons className="text-danger" icon={Alert02Icon} />
                <Text color="danger">Deletar torneio</Text>
              </View>
              <Text color="danger" variant="description">
                Remove permanentemente o torneio e todas as configurações
                vinculadas.
              </Text>
              <Button
                className="self-start"
                isDisabled={isDisabled || !onDelete}
                onPress={() => {
                  setIsDeleteDialogOpen(true);
                }}
                variant="danger-soft"
              >
                <Button.Label>Deletar torneio</Button.Label>
              </Button>
            </RuleCard>
          </Animated.View>
        ) : null}
      </Page.ScrollView>

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
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Deletar torneio</Dialog.Title>
            <Text color="muted" variant="description">
              Essa ação remove permanentemente o torneio e não pode ser
              desfeita. Só rascunhos sem inscrições podem ser deletados.
            </Text>

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
                <Button.Label>Deletar torneio</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}
