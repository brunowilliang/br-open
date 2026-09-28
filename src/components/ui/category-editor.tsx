import {
  MAX_TOURNAMENT_CATEGORIES,
  type TournamentGender,
  type TournamentModality,
} from "@convex/domains/tournament/contract";
import { Add01Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionLayoutTransition,
  Button,
  Description,
  Dialog,
  FieldError,
  Input,
  Label,
  Switch,
  TextField,
} from "heroui-native";
import { NumberField, NumberStepper, Segment } from "heroui-native-pro";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, View } from "react-native";
import Animated from "react-native-reanimated";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { fieldUpdateOptions } from "@/components/ui/rule-card";
import {
  buildCategoryCardSummary,
  buildCategoryCreateDefaults,
  buildCategoryId,
  buildLockedFieldsReason,
  buildRemoveBlockedReason,
  CATEGORY_NAME_DUPLICATE_MESSAGE,
  CATEGORY_NAME_REQUIRED_MESSAGE,
  collectDuplicateCategoryIds,
  isCategoryNameTaken,
  resolveCategoryGender,
  type TournamentCategoryDraft,
} from "@/lib/tournaments/category-editor-derived";

type CategoriesFormValues = {
  categories: TournamentCategoryDraft[];
};

/** Escreve no campo `categories` do RHF context do form hospedeiro: header,
 * menu "Salvar" e estados de submit ficam na rota do wizard. `liveEntryCountById`
 * vem do `management.getById` (ausente no torneio ainda não salvo). */
export function CategoryEditor(props: {
  /** Expansão inicial dos cards (a galeria abre um fixture); o wizard não passa. */
  initialExpandedCategoryIds?: string[];
  isDisabled: boolean;
}) {
  const isDisabled = props.isDisabled;
  const { control, getValues, setValue } =
    useFormContext<CategoriesFormValues>();
  const { errors: formStateErrors } = useFormState({
    control,
    name: "categories",
  });
  const value = useWatch({
    control,
    defaultValue: getValues("categories"),
    name: "categories",
  });
  const error =
    typeof formStateErrors.categories?.message === "string"
      ? formStateErrors.categories.message
      : undefined;
  const [draftName, setDraftName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<null | string>(
    null
  );
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>(
    props.initialExpandedCategoryIds ?? []
  );
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [nameError, setNameError] = useState<null | string>(null);

  const editingCategory =
    editingCategoryId === null
      ? null
      : (value.find((category) => category.id === editingCategoryId) ?? null);
  const isEditingCategory = editingCategory !== null;
  const editingLiveEntryCount = editingCategory?.liveEntryCount ?? 0;
  const isEditingCategoryLocked = editingLiveEntryCount > 0;
  const duplicateCategoryIds = collectDuplicateCategoryIds(value);
  const isAtCategoryLimit = value.length >= MAX_TOURNAMENT_CATEGORIES;

  function onChange(nextValue: TournamentCategoryDraft[]) {
    setValue("categories", nextValue, fieldUpdateOptions);
  }

  function updateCategory(
    categoryId: string,
    patch: Partial<TournamentCategoryDraft>
  ) {
    onChange(
      value.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category
      )
    );
  }

  function handleExpandedChange(nextValue: string | string[] | undefined) {
    setExpandedCategoryIds(
      Array.isArray(nextValue) ? nextValue : nextValue ? [nextValue] : []
    );
  }

  function resetCategoryDialogState() {
    setDraftName("");
    setEditingCategoryId(null);
    setNameError(null);
  }

  function closeCategoryDialog() {
    setIsCategoryDialogOpen(false);
    resetCategoryDialogState();
  }

  function openCreateCategoryDialog() {
    resetCategoryDialogState();
    setIsCategoryDialogOpen(true);
  }

  function openEditCategoryDialog(category: TournamentCategoryDraft) {
    setDraftName(category.name);
    setEditingCategoryId(category.id);
    setNameError(null);
    setIsCategoryDialogOpen(true);
  }

  function handleDraftNameChange(nextValue: string) {
    setDraftName(nextValue);

    if (nameError && nextValue.trim()) {
      setNameError(null);
    }
  }

  function handleSaveCategory() {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setNameError(CATEGORY_NAME_REQUIRED_MESSAGE);
      return;
    }

    if (editingCategory) {
      const hasDuplicateName = isCategoryNameTaken(value, {
        gender: editingCategory.gender,
        id: editingCategory.id,
        modality: editingCategory.modality,
        name: trimmedName,
      });

      if (hasDuplicateName) {
        setNameError(CATEGORY_NAME_DUPLICATE_MESSAGE);
        return;
      }

      updateCategory(editingCategory.id, { name: trimmedName });
      closeCategoryDialog();
      return;
    }

    const defaults = buildCategoryCreateDefaults();
    const hasDuplicateName = isCategoryNameTaken(value, {
      gender: defaults.gender,
      modality: defaults.modality,
      name: trimmedName,
    });

    if (hasDuplicateName) {
      setNameError(CATEGORY_NAME_DUPLICATE_MESSAGE);
      return;
    }

    const category: TournamentCategoryDraft = {
      ...defaults,
      id: buildCategoryId(),
      name: trimmedName,
    };

    onChange([...value, category]);
    setExpandedCategoryIds((currentIds) => [...currentIds, category.id]);
    closeCategoryDialog();
  }

  function handleRemoveCategory(categoryId: string) {
    onChange(value.filter((category) => category.id !== categoryId));
    setExpandedCategoryIds((currentIds) =>
      currentIds.filter((id) => id !== categoryId)
    );
    closeCategoryDialog();
  }

  return (
    <>
      {value.length === 0 && (
        <EmptyState
          buttonIsDisabled={isDisabled}
          buttonLabel="Adicionar Categoria"
          buttonOnPress={openCreateCategoryDialog}
          description="Adicione categorias com nome, modalidade e gênero para as inscrições."
          title="Nenhuma categoria cadastrada"
        />
      )}
      {error ? <ErrorMessage message={error} /> : null}

      {value.length > 0 && (
        <Animated.View className="gap-5" layout={AccordionLayoutTransition}>
          <Accordion
            classNames={{ container: "gap-3 overflow-visible" }}
            hideSeparator
            onValueChange={handleExpandedChange}
            selectionMode="multiple"
            value={expandedCategoryIds}
          >
            {value.map((category) => {
              const liveEntryCount = category.liveEntryCount ?? 0;
              const isLocked = liveEntryCount > 0;
              const hasDuplicateName = duplicateCategoryIds.includes(
                category.id
              );

              return (
                <Accordion.Item
                  className="rounded-3xl border border-surface bg-surface shadow-surface"
                  key={category.id}
                  value={category.id}
                >
                  <Accordion.Trigger className="px-3 py-3">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text pointerEvents="none" weight="medium">
                          {category.name}
                        </Text>
                        <Text color="muted" variant="description">
                          {buildCategoryCardSummary(category)}
                        </Text>
                      </View>
                      <Button
                        isDisabled={isDisabled}
                        isIconOnly
                        onPress={(event) => {
                          event.stopPropagation();
                          openEditCategoryDialog(category);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <HugeIcons className="size-4.5" icon={Edit02Icon} />
                      </Button>
                      <Accordion.Indicator />
                    </View>
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <View className="gap-4 pt-2">
                      <TextField>
                        <Label>Modalidade</Label>
                        <Segment
                          isDisabled={isDisabled || isLocked}
                          onValueChange={(nextValue) => {
                            const nextModality =
                              nextValue as TournamentModality;

                            updateCategory(category.id, {
                              gender: resolveCategoryGender(
                                nextModality,
                                category.gender
                              ),
                              modality: nextModality,
                            });
                          }}
                          value={category.modality}
                        >
                          <Segment.Group>
                            <Segment.ScrollView>
                              <Segment.Indicator />
                              <Segment.Item value="singles">
                                <Segment.Label>Simples</Segment.Label>
                              </Segment.Item>
                              <Segment.Item value="doubles">
                                <Segment.Label>Duplas</Segment.Label>
                              </Segment.Item>
                            </Segment.ScrollView>
                          </Segment.Group>
                        </Segment>
                      </TextField>

                      <TextField>
                        <Label>Gênero</Label>
                        <Segment
                          isDisabled={isDisabled || isLocked}
                          onValueChange={(nextValue) => {
                            updateCategory(category.id, {
                              gender: nextValue as TournamentGender,
                            });
                          }}
                          value={category.gender}
                        >
                          <Segment.Group>
                            <Segment.ScrollView>
                              <Segment.Indicator />
                              <Segment.Item value="male">
                                <Segment.Label>Masculino</Segment.Label>
                              </Segment.Item>
                              <Segment.Item value="female">
                                <Segment.Label>Feminino</Segment.Label>
                              </Segment.Item>
                              <Segment.Item
                                isDisabled={category.modality === "singles"}
                                value="mixed"
                              >
                                <Segment.Label>Misto</Segment.Label>
                              </Segment.Item>
                            </Segment.ScrollView>
                          </Segment.Group>
                        </Segment>
                      </TextField>

                      {isLocked ? (
                        <Text color="muted" variant="description">
                          {buildLockedFieldsReason(liveEntryCount)}
                        </Text>
                      ) : null}

                      <NumberField
                        formatOptions={{
                          currency: "BRL",
                          style: "currency",
                        }}
                        isDisabled={isDisabled}
                        isRequired
                        minValue={0}
                        onChange={(nextValue) => {
                          updateCategory(category.id, {
                            entryFeeCents: Math.max(
                              0,
                              Math.round(nextValue * 100)
                            ),
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
                            updateCategory(category.id, {
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
                              updateCategory(category.id, {
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

                      <FieldError isInvalid={hasDuplicateName}>
                        {hasDuplicateName
                          ? CATEGORY_NAME_DUPLICATE_MESSAGE
                          : ""}
                      </FieldError>
                    </View>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion>

          <Animated.View layout={AccordionLayoutTransition}>
            <Button
              className="self-center"
              isDisabled={isDisabled || isAtCategoryLimit}
              onPress={openCreateCategoryDialog}
              variant="secondary"
            >
              <Button.Label>Adicionar Nova Categoria</Button.Label>
              <HugeIcons className="text-accent" icon={Add01Icon} />
            </Button>
            {isAtCategoryLimit ? (
              <Text align="center" color="muted" variant="description">
                {`Limite de ${MAX_TOURNAMENT_CATEGORIES} categorias atingido.`}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      )}

      <Dialog
        isOpen={isCategoryDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsCategoryDialogOpen(nextOpen);

          if (!nextOpen) {
            resetCategoryDialogState();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <KeyboardAvoidingView behavior="padding">
            <Dialog.Content className="gap-4 p-5">
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
              <Dialog.Title>
                {isEditingCategory ? "Editar Categoria" : "Criar Categoria"}
              </Dialog.Title>

              <TextField isInvalid={Boolean(nameError)} isRequired>
                <Label>Nome da categoria</Label>
                <Input
                  autoCapitalize="words"
                  className="bg-surface-secondary"
                  editable={!isDisabled}
                  onChangeText={handleDraftNameChange}
                  onSubmitEditing={handleSaveCategory}
                  placeholder="Ex.: Categoria A"
                  returnKeyType="done"
                  value={draftName}
                  variant="secondary"
                />
                <Description>
                  {isEditingCategory
                    ? "Atualize o nome. Ele é o rótulo da categoria no app inteiro."
                    : "Modalidade, gênero, taxa e vagas ficam no card da categoria."}
                </Description>
                <FieldError>{nameError ?? ""}</FieldError>
              </TextField>

              {isEditingCategoryLocked ? (
                <Text color="muted" variant="description">
                  {buildRemoveBlockedReason(editingLiveEntryCount)}
                </Text>
              ) : null}

              <View className="flex-row gap-2 self-end">
                {editingCategory ? (
                  <Button
                    isDisabled={isDisabled || isEditingCategoryLocked}
                    onPress={() => {
                      handleRemoveCategory(editingCategory.id);
                    }}
                    size="sm"
                    variant="danger-soft"
                  >
                    <Button.Label>Remover</Button.Label>
                  </Button>
                ) : null}
                <Button
                  isDisabled={isDisabled}
                  onPress={handleSaveCategory}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>
                    {isEditingCategory ? "Salvar" : "Adicionar"}
                  </Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </KeyboardAvoidingView>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
