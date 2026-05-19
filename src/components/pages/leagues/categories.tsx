import { HugeIcons } from "@/components/ui/huge-icons";
import { Text } from "@/components/ui/text";
import {
  Add01Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  ListChevronsDownUpIcon,
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
import { EmptyState } from "heroui-native-pro";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

type CategoryItem = {
  id: string;
  name: string;
};

type CategoryListItem = CategoryItem & {
  index: number;
};

type CategoriesProps = {
  categories: CategoryItem[];
  error?: string;
  isDisabled?: boolean;
  onChange: (categories: CategoryItem[]) => void;
};

export const Categories = ({
  categories,
  error,
  isDisabled,
  onChange,
}: CategoriesProps) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<
    number | null
  >(null);
  const [isOpen, setIsOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const categoryItems = useMemo(
    () =>
      categories.map((category, index) => ({
        ...category,
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

  function handleSaveCategory() {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setNameError("Digite um nome para a categoria.");
      return;
    }

    if (editingCategoryIndex !== null) {
      onChange(
        categories.map((category, index) =>
          index === editingCategoryIndex
            ? { ...category, name: trimmedName }
            : category
        )
      );
      closeDialog();
      return;
    }

    onChange([
      ...categories,
      {
        id: String(
          Math.max(
            0,
            ...categories.map((category) => Number(category.id) || 0)
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

    onChange(categories.filter((_, index) => index !== editingCategoryIndex));
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
        <EmptyState className="gap-3.5 p-2">
          <EmptyState.Media variant="icon">
            <HugeIcons icon={ListChevronsDownUpIcon} />
          </EmptyState.Media>
          <View>
            <EmptyState.Title>Nenhuma categoria criada</EmptyState.Title>
            <EmptyState.Description>
              Crie suas categorias
            </EmptyState.Description>
          </View>
          {error ? (
            <Text className="text-center" color="danger" variant="description">
              {error}
            </Text>
          ) : null}
          <EmptyState.Content className="mt-2 w-full gap-2.5">
            <Button isDisabled={isDisabled} onPress={openCreateDialog}>
              <Button.Label>Criar Categoria</Button.Label>
              <HugeIcons className="text-accent-foreground" icon={Add01Icon} />
            </Button>
          </EmptyState.Content>
        </EmptyState>
      ) : (
        <View className="flex-1 gap-2">
          <Text className="px-4 pb-1 text-muted" variant="description">
            Minhas Categorias
          </Text>
          {error ? (
            <Text className="px-4" color="danger" variant="description">
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
                onChange(
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
            className="mt-5 self-center"
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
