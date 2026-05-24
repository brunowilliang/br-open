import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  Add01Icon,
  DragDropVerticalIcon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Description,
  Dialog,
  FieldError,
  Input,
  Label,
  ListGroup,
  Separator,
  TextField,
} from "heroui-native";
import { useMemo, useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";

type CategoryItem = {
  id: string;
  name: string;
};

type CategoryListItem = CategoryItem & {
  index: number;
};

type CategoriesProps = {
  isDisabled?: boolean;
};

export const Categories = ({ isDisabled }: CategoriesProps) => {
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: "categories",
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<
    number | null
  >(null);
  const [isOpen, setIsOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const categories = useWatch({
    control,
    name: "categories",
    defaultValue: getValues("categories"),
  });
  const error =
    typeof errors.categories?.message === "string"
      ? errors.categories.message
      : undefined;
  const categoryItems = useMemo(
    () =>
      categories.map((category, index) => ({
        id: String(index + 1),
        name: category,
        index,
      })),
    [categories]
  );

  const editingCategory =
    editingCategoryIndex === null
      ? null
      : (categories[editingCategoryIndex] ?? null);
  const isEditing = editingCategory !== null;

  function resetDialogState() {
    setDraftName("");
    setEditingCategoryIndex(null);
    setNameError(null);
  }

  function closeDialog() {
    setIsOpen(false);
    resetDialogState();
  }

  function openCreateDialog() {
    resetDialogState();
    setIsOpen(true);
  }

  function openEditDialog(category: CategoryListItem) {
    setDraftName(category.name);
    setEditingCategoryIndex(category.index);
    setNameError(null);
    setIsOpen(true);
  }

  function handleDraftNameChange(value: string) {
    setDraftName(value);

    if (nameError && value.trim()) {
      setNameError(null);
    }
  }

  function updateCategories(nextCategories: CategoryItem[]) {
    setValue(
      "categories",
      nextCategories.map((category) => category.name),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }
    );
  }

  function handleSaveCategory() {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setNameError("Digite um nome para a categoria.");
      return;
    }

    if (editingCategoryIndex !== null) {
      updateCategories(
        categoryItems.map((category, index) =>
          index === editingCategoryIndex
            ? { ...category, name: trimmedName }
            : category
        )
      );
      closeDialog();
      return;
    }

    updateCategories([
      ...categoryItems,
      {
        id: String(
          Math.max(
            0,
            ...categoryItems.map((category) => Number(category.id) || 0)
          ) + 1
        ),
        name: trimmedName,
      },
    ]);
    closeDialog();
  }

  function handleRemoveCategory() {
    if (editingCategoryIndex === null) {
      return;
    }

    updateCategories(
      categoryItems.filter((_, index) => index !== editingCategoryIndex)
    );
    closeDialog();
  }

  function renderCategoryItem({
    drag,
    isActive,
    item,
  }: RenderItemParams<CategoryListItem>) {
    return (
      <ScaleDecorator activeScale={1.02}>
        <ListGroup.Item className={isActive ? "opacity-90" : undefined}>
          <ListGroup.ItemPrefix>
            <Button
              isDisabled={isActive || isDisabled}
              isIconOnly
              onLongPress={drag}
              size="sm"
              variant="ghost"
            >
              <HugeIcons className="text-muted" icon={DragDropVerticalIcon} />
            </Button>
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>{item.name}</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <Button
              isDisabled={isActive || isDisabled}
              isIconOnly
              onPress={() => openEditDialog(item)}
              size="sm"
              variant="ghost"
            >
              <HugeIcons className="size-4.5" icon={Edit02Icon} />
            </Button>
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ScaleDecorator>
    );
  }

  function renderItemSeparator({
    leadingItem,
  }: {
    leadingItem?: CategoryListItem | null;
  }) {
    if (leadingItem?.id === activeCategoryId) {
      return null;
    }

    return <Separator className="mx-10" />;
  }

  return (
    <>
      {categories.length === 0 ? (
        <EmptyState
          buttonIsDisabled={isDisabled}
          buttonLabel="Criar Categoria"
          buttonOnPress={openCreateDialog}
          description="Crie suas categorias"
          title="Nenhuma categoria criada"
        >
          {error ? (
            <Text className="text-center" color="danger" variant="description">
              {error}
            </Text>
          ) : null}
        </EmptyState>
      ) : (
        <View className="gap-5">
          {error ? (
            <Text
              className="px-4 text-center"
              color="danger"
              variant="description"
            >
              {error}
            </Text>
          ) : null}
          <ListGroup className="overflow-hidden">
            <DraggableFlatList
              data={categoryItems}
              ItemSeparatorComponent={renderItemSeparator}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              onDragBegin={(index) => {
                setActiveCategoryId(categoryItems[index]?.id ?? null);
              }}
              onDragEnd={({ data }) => {
                updateCategories(
                  data.map(({ id, name }) => ({
                    id,
                    name,
                  }))
                );
                setActiveCategoryId(null);
              }}
              renderItem={renderCategoryItem}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </ListGroup>

          <Button
            className="self-center"
            isDisabled={isDisabled}
            onPress={openCreateDialog}
            variant="secondary"
          >
            <Button.Label>Adicionar Nova Categoria</Button.Label>
            <HugeIcons className="text-accent" icon={Add01Icon} />
          </Button>
        </View>
      )}

      <Dialog
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);

          if (!nextOpen) {
            resetDialogState();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <KeyboardAvoidingView behavior="padding">
            <Dialog.Content className="gap-4 p-5">
              <Dialog.Close className="absolute top-4 right-4 z-100" />
              <Dialog.Title>
                {isEditing ? "Editar Categoria" : "Criar Categoria"}
              </Dialog.Title>

              <TextField isInvalid={Boolean(nameError)} isRequired>
                <Label>Nome da categoria</Label>
                <Input
                  autoCapitalize="words"
                  editable={!isDisabled}
                  onChangeText={handleDraftNameChange}
                  onSubmitEditing={handleSaveCategory}
                  placeholder="Ex: Especial"
                  returnKeyType="done"
                  value={draftName}
                  variant="secondary"
                />
                <Description>
                  {isEditing
                    ? "Atualize o nome da categoria para testar a ediçao local."
                    : "Essa categoria agora alimenta o formulário principal."}
                </Description>
                <FieldError>{nameError ?? ""}</FieldError>
              </TextField>

              <View className="flex-row gap-2 self-end">
                {isEditing ? (
                  <Button
                    isDisabled={isDisabled}
                    onPress={handleRemoveCategory}
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
                    {isEditing ? "Salvar" : "Adicionar"}
                  </Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </KeyboardAvoidingView>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};
