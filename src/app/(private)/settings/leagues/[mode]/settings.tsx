import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  AccordionLayoutTransition,
  Button,
  Checkbox,
  Description,
  Dialog,
  FieldError,
  Label,
  Menu,
  PressableFeedback,
  Select,
  Surface,
  TextField,
} from "heroui-native";
import { NumberField, NumberStepper, Segment } from "heroui-native-pro";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

const visibilityOptions = [
  { label: "Pública", value: "public" as const },
  { label: "Privada", value: "private" as const },
];

const priceBillingIntervalOptions = [
  { label: "Semanal", value: "week" as const },
  { label: "Mensal", value: "month" as const },
  { label: "Trimestral", value: "quarter" as const },
  { label: "Anual", value: "year" as const },
];

const fieldUpdateOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;
const DEFAULT_PAID_PRICE_CENTS = 9000;
const SETTINGS_CONTENT_ENTERING = FadeIn.duration(180);
const SETTINGS_CONTENT_EXITING = FadeOut.duration(120);
const AnimatedSurface = Animated.createAnimatedComponent(Surface);

export default function LeagueSettingsRoute() {
  const { isSubmitPending, onDelete, onSubmitPress, showDelete, title } =
    useLeagueFormRoute();
  const isDisabled = isSubmitPending;

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "visibility",
      "maxPlayers",
      "monthlyPriceCents",
      "priceBillingInterval",
    ],
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const visibility = useWatch({
    control,
    name: "visibility",
    defaultValue: getValues("visibility"),
  });
  const maxPlayers = useWatch({
    control,
    name: "maxPlayers",
    defaultValue: getValues("maxPlayers"),
  });
  const monthlyPriceCents = useWatch({
    control,
    name: "monthlyPriceCents",
    defaultValue: getValues("monthlyPriceCents"),
  });
  const priceBillingInterval = useWatch({
    control,
    name: "priceBillingInterval",
    defaultValue: getValues("priceBillingInterval"),
  });
  const visibilityError = errors.visibility?.message;
  const maxPlayersError = errors.maxPlayers?.message;
  const monthlyPriceCentsError = errors.monthlyPriceCents?.message;
  const priceBillingIntervalError = errors.priceBillingInterval?.message;
  const hasLimitedSpots = maxPlayers !== null;
  const hasPaidPrice = (monthlyPriceCents ?? 0) > 0;

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

  function toggleLimitedSpots() {
    setValue("maxPlayers", hasLimitedSpots ? null : 20, fieldUpdateOptions);
  }

  function togglePaidPrice() {
    setValue(
      "monthlyPriceCents",
      hasPaidPrice ? 0 : DEFAULT_PAID_PRICE_CENTS,
      fieldUpdateOptions
    );
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>{title}</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay />
              <Menu.Content presentation="popover">
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle className="flex-none">Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <Animated.View className="gap-6" layout={AccordionLayoutTransition}>
          <TextField isInvalid={Boolean(visibilityError)} isRequired>
            <Label>Visibilidade</Label>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  setValue(
                    "visibility",
                    nextValue.value as LeagueScreenValues["visibility"],
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

          <AnimatedSurface className="gap-4" layout={AccordionLayoutTransition}>
            <PressableFeedback
              accessibilityLabel="Limitar vagas"
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: hasLimitedSpots,
                disabled: isDisabled,
              }}
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={toggleLimitedSpots}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={hasLimitedSpots}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Limitar vagas</Label>
                <Description className="-mt-1.5">
                  Ative para definir quantos jogadores podem entrar na liga.
                </Description>
              </View>
            </PressableFeedback>

            {hasLimitedSpots ? (
              <Animated.View
                entering={SETTINGS_CONTENT_ENTERING}
                exiting={SETTINGS_CONTENT_EXITING}
                layout={AccordionLayoutTransition}
              >
                <TextField isInvalid={Boolean(maxPlayersError)} isRequired>
                  <Label>Quantidade de vagas</Label>
                  <Description className="-mt-1.5 mb-1">
                    Número máximo de jogadores ativos na liga.
                  </Description>
                  <NumberStepper
                    className="self-start"
                    defaultValue={maxPlayers ?? 20}
                    isDisabled={isDisabled}
                    maxValue={500}
                    minValue={1}
                    onValueChange={(nextValue) => {
                      setValue("maxPlayers", nextValue, fieldUpdateOptions);
                    }}
                    step={1}
                    value={maxPlayers ?? 20}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                  <FieldError>{maxPlayersError ?? ""}</FieldError>
                </TextField>
              </Animated.View>
            ) : null}
          </AnimatedSurface>

          <AnimatedSurface className="gap-4" layout={AccordionLayoutTransition}>
            <PressableFeedback
              accessibilityLabel="Cobrança"
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: hasPaidPrice,
                disabled: isDisabled,
              }}
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={togglePaidPrice}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={hasPaidPrice}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Cobrança</Label>
                <Description className="-mt-1.5">
                  Ative para definir uma mensalidade para a liga.
                </Description>
              </View>
            </PressableFeedback>

            {hasPaidPrice ? (
              <Animated.View
                className="gap-4"
                entering={SETTINGS_CONTENT_ENTERING}
                exiting={SETTINGS_CONTENT_EXITING}
                layout={AccordionLayoutTransition}
              >
                <NumberField
                  formatOptions={{
                    currency: "BRL",
                    style: "currency",
                  }}
                  isDisabled={isDisabled}
                  isInvalid={Boolean(monthlyPriceCentsError)}
                  isRequired
                  minValue={0}
                  onChange={(nextValue) => {
                    setValue(
                      "monthlyPriceCents",
                      Math.max(0, Math.round(nextValue * 100)),
                      fieldUpdateOptions
                    );
                  }}
                  step={5}
                  value={(monthlyPriceCents ?? 0) / 100}
                >
                  <Label>Valor</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input keyboardType="decimal-pad" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>Valor cobrado no período escolhido.</Description>
                  <FieldError>{monthlyPriceCentsError ?? ""}</FieldError>
                </NumberField>

                <TextField
                  isInvalid={Boolean(priceBillingIntervalError)}
                  isRequired
                >
                  <Label>Período de cobrança</Label>
                  <Segment
                    isDisabled={isDisabled}
                    onValueChange={(nextValue) => {
                      if (nextValue) {
                        setValue(
                          "priceBillingInterval",
                          nextValue as LeagueScreenValues["priceBillingInterval"],
                          fieldUpdateOptions
                        );
                      }
                    }}
                    value={priceBillingInterval}
                  >
                    <Segment.Group>
                      <Segment.ScrollView>
                        <Segment.Indicator />
                        {priceBillingIntervalOptions.map((option) => (
                          <Segment.Item key={option.value} value={option.value}>
                            <Segment.Label>{option.label}</Segment.Label>
                          </Segment.Item>
                        ))}
                      </Segment.ScrollView>
                    </Segment.Group>
                  </Segment>
                  <FieldError>{priceBillingIntervalError ?? ""}</FieldError>
                </TextField>
              </Animated.View>
            ) : null}
          </AnimatedSurface>

          {showDelete ? (
            <AnimatedSurface
              className="gap-3 border border-danger-soft bg-danger-soft"
              layout={AccordionLayoutTransition}
            >
              <View className="flex-row items-center gap-2">
                <HugeIcons className="text-danger" icon={Alert02Icon} />
                <Text className="text-danger">Deletar liga</Text>
              </View>
              <Description className="text-danger">
                Remove permanentemente a liga e todas as configurações
                vinculadas.
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
            </AnimatedSurface>
          ) : null}
        </Animated.View>

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
      </Page.ScrollView>
    </Page>
  );
}
