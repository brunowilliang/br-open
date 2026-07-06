import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  RuleCard,
  RuleExpandableContent,
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { WidgetAlert } from "@/components/pages/leagues/widget-alert";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useCRPC } from "@/lib/convex/crpc";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
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
import { NumberField, NumberStepper, Segment } from "heroui-native-pro";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { View } from "react-native";
import Animated from "react-native-reanimated";

const visibilityOptions = [
  { label: "Pública", value: "public" as const },
  { label: "Privada", value: "private" as const },
];

const scheduleVisibilityOptions = [
  { label: "Aberta para todos", value: "public" as const },
  { label: "Somente membros", value: "members_only" as const },
];

const priceBillingIntervalOptions = [
  { label: "Único", value: "once" as const },
  { label: "Semanal", value: "week" as const },
  { label: "Mensal", value: "month" as const },
  { label: "Trimestral", value: "quarter" as const },
  { label: "Anual", value: "year" as const },
];

const approvalModeOptions = [
  { label: "Automática", value: "auto" as const },
  { label: "Manual", value: "manual" as const },
];

const DEFAULT_PAID_PRICE_CENTS = 9000;

const SETTINGS_RULE_INFO = {
  limitedSpots: {
    description:
      "Controla quantos jogadores podem entrar na liga. Ativo: novos jogadores só entram até atingir o limite. Desativo: a liga aceita jogadores sem limite.",
    title: "Limitar vagas",
  },
  paidPrice: {
    description:
      "Define se a liga cobra mensalidade dos jogadores. Ao ativar, configure o valor e o período (semanal, mensal, etc.).",
    title: "Cobrança",
  },
  approvalMode: {
    description:
      "Automática: o jogador vai direto pro pagamento. Manual: você aprova a solicitação antes do jogador pagar.",
    title: "Aprovação de jogadores",
  },
} as const;

export default function LeagueSettingsRoute() {
  const { isSubmitPending, mode, onDelete, onSubmitPress, showDelete } =
    useLeagueFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";
  const router = useRouter();
  const crpc = useCRPC();

  // The organizer must have an active Woovi subaccount before they can charge
  // players for a paid league. Fetched unconditionally (cheap authQuery) so the
  // guard works in both create and edit modes.
  const wooviStatusQuery = useQuery(
    crpc.payment.onboarding.getStatus.queryOptions()
  );
  const wooviStatus = wooviStatusQuery.data?.status ?? null;

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
      "approvalMode",
    ],
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isWooviDialogOpen, setIsWooviDialogOpen] = useState(false);
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
  const approvalMode = useWatch({
    control,
    name: "approvalMode",
    defaultValue: getValues("approvalMode"),
  });
  const scheduleVisibility = useWatch({
    control,
    name: "ruleConfig.scheduleVisibility",
    defaultValue: getValues("ruleConfig.scheduleVisibility") ?? "public",
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
    // Turning charging ON requires an active Woovi subaccount. If not connected,
    // block the toggle and prompt the organizer to set up payments instead.
    if (!hasPaidPrice && wooviStatus !== "active") {
      setIsWooviDialogOpen(true);
      return;
    }

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
        <TextField isInvalid={Boolean(visibilityError)} isRequired>
          <Label>Visibilidade da liga</Label>
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
        <TextField isRequired>
          <Label>Visibilidade da agenda</Label>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.scheduleVisibility",
                  nextValue.value as LeagueScreenValues["ruleConfig"]["scheduleVisibility"],
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  }
                );
              }
            }}
            selectionMode="single"
            value={scheduleVisibilityOptions.find(
              (option) => option.value === scheduleVisibility
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
                {scheduleVisibilityOptions.map((option) => (
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
            Define quem pode ver os jogos agendados da liga.
          </Description>
        </TextField>
        <Animated.View className="gap-2" layout={AccordionLayoutTransition}>
          <ToggleableRuleCard
            description="Ative para definir quantos jogadores podem entrar na liga."
            enabled={hasLimitedSpots}
            info={SETTINGS_RULE_INFO.limitedSpots}
            isDisabled={isDisabled}
            label="Limitar vagas"
            onToggle={toggleLimitedSpots}
          >
            <RuleExpandableContent className="">
              <TextField isInvalid={Boolean(maxPlayersError)} isRequired>
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
            </RuleExpandableContent>
          </ToggleableRuleCard>

          <ToggleableRuleCard
            description="Ative para definir uma mensalidade para a liga."
            enabled={hasPaidPrice}
            error={
              hasPaidPrice && wooviStatus !== "active" ? (
                <WidgetAlert
                  status="warning"
                  title="Conta de pagamento não conectada — os jogadores não conseguirão pagar."
                />
              ) : null
            }
            info={SETTINGS_RULE_INFO.paidPrice}
            isDisabled={isDisabled}
            label="Cobrança"
            onToggle={togglePaidPrice}
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

            <TextField isRequired>
              <Label>Aprovação de jogadores</Label>
              <Segment
                isDisabled={isDisabled}
                onValueChange={(nextValue) => {
                  if (nextValue) {
                    setValue(
                      "approvalMode",
                      nextValue as LeagueScreenValues["approvalMode"],
                      fieldUpdateOptions
                    );
                  }
                }}
                value={approvalMode}
              >
                <Segment.Group>
                  <Segment.Indicator />
                  {approvalModeOptions.map((option) => (
                    <Segment.Item key={option.value} value={option.value}>
                      <Segment.Label>{option.label}</Segment.Label>
                    </Segment.Item>
                  ))}
                </Segment.Group>
              </Segment>
              <Description>
                {SETTINGS_RULE_INFO.approvalMode.description}
              </Description>
            </TextField>
          </ToggleableRuleCard>

          {showDelete ? (
            <RuleCard className="gap-3 border border-danger-soft bg-danger-soft">
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
            </RuleCard>
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

        <Dialog
          isOpen={isWooviDialogOpen}
          onOpenChange={(nextOpen) => {
            if (isDisabled) {
              return;
            }
            setIsWooviDialogOpen(nextOpen);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="gap-4 p-5">
              {isDisabled ? null : (
                <Dialog.Close className="absolute top-4 right-4 z-100" />
              )}
              <Dialog.Title>Configure sua conta de pagamento</Dialog.Title>
              <Description>
                Para ativar a cobrança na liga, conecte sua conta de pagamento
                para receber os pagamentos via PIX.
              </Description>

              <View className="flex-row gap-2 self-end">
                <Button
                  isDisabled={isDisabled}
                  onPress={() => {
                    setIsWooviDialogOpen(false);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>Agora não</Button.Label>
                </Button>
                <Button
                  isDisabled={isDisabled}
                  onPress={() => {
                    setIsWooviDialogOpen(false);
                    router.navigate("/settings/organization/payments" as Href);
                  }}
                  size="sm"
                  variant="primary"
                >
                  <Button.Label>Configurar</Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Page.ScrollView>
    </Page>
  );
}
