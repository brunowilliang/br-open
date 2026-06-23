import { BackButton, Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SortableCardList } from "@/components/ui/sortable-card-list";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Card,
  Description,
  Dialog,
  FieldError,
  Input,
  Label,
  Menu,
  TextField,
} from "heroui-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

type CategoryItem = {
  id: string;
  name: string;
};

type CategoryListItem = CategoryItem & {
  index: number;
};

let categoryIdCounter = 0;
function buildCategoryItemId(): string {
  // Monotonic counter + timestamp + random suffix. Avoids the collision risk
  // of Date.now()+Math.random() under fast double-tap (same millisecond +
  // short random suffix) without needing the `crypto` global, which is not
  // available in the Hermes runtime by default.
  categoryIdCounter += 1;
  return `cat-${Date.now()}-${categoryIdCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function syncCategoryItemIds(currentIds: string[], itemCount: number) {
  if (currentIds.length === itemCount) {
    return currentIds;
  }

  if (currentIds.length > itemCount) {
    return currentIds.slice(0, itemCount);
  }

  return [
    ...currentIds,
    ...Array.from({ length: itemCount - currentIds.length }, () =>
      buildCategoryItemId()
    ),
  ];
}

export default function LeagueCategoriesRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useLeagueFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: "categories",
  });
  const [categoryItemIds, setCategoryItemIds] = useState(() =>
    getValues("categories").map(() => buildCategoryItemId())
  );
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
        id: categoryItemIds[index] ?? `${category}-${index}`,
        name: category,
        index,
      })),
    [categories, categoryItemIds]
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
    setCategoryItemIds(nextCategories.map((category) => category.id));
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

  function handleOrderChange(nextCategories: CategoryListItem[]) {
    updateCategories(nextCategories);
  }

  useEffect(() => {
    setCategoryItemIds((currentIds) =>
      syncCategoryItemIds(currentIds, categories.length)
    );
  }, [categories.length]);

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
        id: buildCategoryItemId(),
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

  function renderCategoryItem(props: {
    dragHandle: (children: ReactNode) => ReactNode;
    isActive: boolean;
    item: CategoryListItem;
  }) {
    const { dragHandle, isActive, item } = props;

    return (
      <Card className={isActive ? "w-full p-3 opacity-70" : "w-full p-3"}>
        <View className="flex-row items-center gap-3">
          {dragHandle(
            <Button
              isDisabled={isActive || isDisabled}
              isIconOnly
              size="sm"
              variant="ghost"
            >
              <HugeIcons className="text-muted" icon={DragDropVerticalIcon} />
            </Button>
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base" numberOfLines={1} weight="semibold">
              {item.name}
            </Text>
            <Text color="muted" numberOfLines={1} variant="description">
              Categoria {item.index + 1}
            </Text>
          </View>
          <Button
            isDisabled={isActive || isDisabled}
            isIconOnly
            onPress={() => openEditDialog(item)}
            size="sm"
            variant="ghost"
          >
            <HugeIcons className="size-4.5" icon={Edit02Icon} />
          </Button>
        </View>
      </Card>
    );
  }

  return (
    <Page>
      <Page.Header className="pt-safe-offset-4">
        <Page.Header.Left>
          <BackButton />
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

      <Page.ScrollView contentContainerClassName="grow gap-5 px-4 pb-floating-tab-bar-offset-4">
        {categories.length === 0 && (
          <EmptyState
            buttonIsDisabled={isDisabled}
            buttonLabel="Adicionar Categoria"
            buttonOnPress={openCreateDialog}
            description="Crie suas categorias"
            title="Nenhuma categoria criada"
          />
        )}
        {error && <ErrorMessage message="Informe pelo menos uma categoria" />}

        <Animated.View className="gap-2">
          <SortableCardList
            data={categoryItems}
            onOrderChange={handleOrderChange}
            renderItem={renderCategoryItem}
          />

          {categories.length > 0 && (
            <Animated.View className="self-center" layout={LinearTransition}>
              <Button
                isDisabled={isDisabled}
                onPress={openCreateDialog}
                variant="secondary"
              >
                <Button.Label>Adicionar Nova Categoria</Button.Label>
                <HugeIcons className="text-accent" icon={Add01Icon} />
              </Button>
            </Animated.View>
          )}
        </Animated.View>
      </Page.ScrollView>
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
    </Page>
  );
}
