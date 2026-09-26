import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  AccordionLayoutTransition,
  Button,
  FieldError,
  Label,
  Menu,
  PressableFeedback,
  Switch,
  TextField,
} from "heroui-native";
import { NumberField, NumberStepper } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";

import { RuleCard, RuleExpandableContent } from "@/components/ui/rule-card";
import {
  TOURNAMENT_CATEGORY_PRESETS,
  type TournamentScreenValues,
} from "@/components/pages/tournaments/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

type CategoryGender = TournamentScreenValues["categories"][number]["gender"];
type CategoryModality =
  TournamentScreenValues["categories"][number]["modality"];

const fieldUpdateOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;

function parsePresetValue(presetValue: string): {
  gender: CategoryGender;
  modality: CategoryModality;
} {
  const [modality, gender] = presetValue.split(":");

  return {
    gender: gender as CategoryGender,
    modality: modality as CategoryModality,
  };
}

function findCategory(
  categories: TournamentScreenValues["categories"],
  presetValue: string
) {
  const { gender, modality } = parsePresetValue(presetValue);

  return categories.find(
    (category) => category.modality === modality && category.gender === gender
  );
}

export default function TournamentCategoriesRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useTournamentFormRoute();
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
  const { errors } = useFormState({ control, name: "categories" });
  const categories = useWatch({
    control,
    defaultValue: getValues("categories"),
    name: "categories",
  });
  const categoriesError = errors.categories?.message;

  function togglePreset(presetValue: string, isEnabled: boolean) {
    const { gender, modality } = parsePresetValue(presetValue);

    if (isEnabled) {
      setValue(
        "categories",
        [
          ...categories,
          {
            entryFeeCents: 0,
            gender,
            maxEntries: null,
            modality,
          },
        ],
        fieldUpdateOptions
      );
      return;
    }

    setValue(
      "categories",
      categories.filter(
        (category) =>
          !(category.modality === modality && category.gender === gender)
      ),
      fieldUpdateOptions
    );
  }

  function updateCategory(
    presetValue: string,
    patch: Partial<TournamentScreenValues["categories"][number]>
  ) {
    const { gender, modality } = parsePresetValue(presetValue);

    setValue(
      "categories",
      categories.map((category) =>
        category.modality === modality && category.gender === gender
          ? { ...category, ...patch }
          : category
      ),
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
          <Page.Header.Title>Categorias</Page.Header.Title>
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

      <Page.ScrollView contentContainerClassName="gap-3 px-4 pb-floating-tab-bar-offset-4">
        <Text color="muted" variant="description">
          Cada categoria tem chave e inscrições próprias. A taxa e o limite de
          vagas são opcionais.
        </Text>

        {TOURNAMENT_CATEGORY_PRESETS.map((preset) => {
          const category = findCategory(categories, preset.value);
          const isEnabled = category !== undefined;

          return (
            <RuleCard key={preset.value}>
              <PressableFeedback
                accessibilityLabel={preset.label}
                accessibilityRole="switch"
                accessibilityState={{
                  checked: isEnabled,
                  disabled: isDisabled,
                }}
                className="flex-row items-center gap-3"
                isDisabled={isDisabled}
                onPress={() => {
                  togglePreset(preset.value, !isEnabled);
                }}
              >
                <View className="min-w-0 flex-1" pointerEvents="none">
                  <Text weight="medium">{preset.label}</Text>
                  <Text color="muted" variant="description">
                    {preset.modality === "doubles"
                      ? "Dupla fixa (convite por username)."
                      : "Jogador contra jogador."}
                  </Text>
                </View>
                <Switch
                  isDisabled={isDisabled}
                  isSelected={isEnabled}
                  pointerEvents="none"
                />
              </PressableFeedback>

              {isEnabled && category ? (
                <RuleExpandableContent>
                  <NumberField
                    formatOptions={{
                      currency: "BRL",
                      style: "currency",
                    }}
                    isDisabled={isDisabled}
                    isRequired
                    minValue={0}
                    onChange={(nextValue) => {
                      updateCategory(preset.value, {
                        entryFeeCents: Math.max(0, Math.round(nextValue * 100)),
                      });
                    }}
                    step={5}
                    value={category.entryFeeCents / 100}
                  >
                    <Text weight="medium">Taxa de inscrição</Text>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input
                        keyboardType="decimal-pad"
                        variant="secondary"
                      />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    <Text color="muted" variant="description">
                      Deixe em R$ 0,00 para inscrição gratuita.
                    </Text>
                  </NumberField>

                  <View className="flex-row items-center gap-3">
                    <View className="min-w-0 flex-1">
                      <Text weight="medium">Limitar vagas</Text>
                      <Text color="muted" variant="description">
                        Limite a quantidade de inscrições nessa categoria
                      </Text>
                    </View>
                    <Switch
                      isDisabled={isDisabled}
                      isSelected={category.maxEntries !== null}
                      onSelectedChange={(nextValue) => {
                        updateCategory(preset.value, {
                          maxEntries: nextValue ? 8 : null,
                        });
                      }}
                    />
                  </View>

                  {category.maxEntries === null ? null : (
                    <TextField isRequired>
                      <Label>Vagas</Label>
                      <NumberStepper
                        className="self-start"
                        isDisabled={isDisabled}
                        maxValue={128}
                        minValue={2}
                        onValueChange={(nextValue) => {
                          updateCategory(preset.value, {
                            maxEntries: Math.round(nextValue),
                          });
                        }}
                        step={1}
                        value={category.maxEntries}
                      >
                        <NumberStepper.DecrementButton />
                        <NumberStepper.Value />
                        <NumberStepper.IncrementButton />
                      </NumberStepper>
                      <FieldError>{""}</FieldError>
                    </TextField>
                  )}
                </RuleExpandableContent>
              ) : null}
            </RuleCard>
          );
        })}

        {typeof categoriesError === "string" ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            layout={AccordionLayoutTransition}
          >
            <FieldError isInvalid>{categoriesError}</FieldError>
          </Animated.View>
        ) : null}
      </Page.ScrollView>
    </Page>
  );
}
