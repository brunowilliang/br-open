import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";

import {
  VariantSection,
  buildGalleryCategory,
} from "@/components/pages/settings/shared";
import { CategoryEditor } from "@/components/ui/category-editor";
import type { TournamentCategoryDraft } from "@/lib/tournaments/category-editor-derived";

type CategoryEditorGalleryVariant = {
  categories: TournamentCategoryDraft[];
  /** Fixture abre o card direto: a expansão do editor é estado interno. */
  expandedCategoryId?: string;
  note: string;
  title: string;
};

const galleryCategoryEditorVariants: CategoryEditorGalleryVariant[] = [
  {
    categories: [],
    note: "Sem categoria: o vazio abre o mesmo dialog de criação.",
    title: "Categorias 1 | vazio",
  },
  {
    categories: [
      buildGalleryCategory({
        entryFeeCents: 3000,
        id: "gallery-a",
        maxEntries: 8,
        name: "Categoria A",
      }),
    ],
    note: "Nome livre carrega o nível; o resumo traz tipo, taxa e vagas.",
    title: "Categorias 2 | uma colapsada",
  },
  {
    categories: [
      buildGalleryCategory({
        entryFeeCents: 3000,
        gender: "female",
        id: "gallery-a",
        maxEntries: 8,
        name: "Categoria A",
      }),
    ],
    expandedCategoryId: "gallery-a",
    note: "Card aberto: modalidade, gênero, taxa e vagas.",
    title: "Categorias 3 | aberta",
  },
  {
    categories: [
      buildGalleryCategory({ id: "gallery-a", name: "Categoria A" }),
      buildGalleryCategory({ id: "gallery-b", name: "categoria a" }),
    ],
    expandedCategoryId: "gallery-a",
    note: "Nome repetido no mesmo tipo: o FieldError marca a linha aberta e o salvar fica bloqueado.",
    title: "Categorias 4 | duplicado",
  },
  {
    categories: [
      buildGalleryCategory({
        id: "gallery-c",
        liveEntryCount: 3,
        name: "Categoria B",
      }),
    ],
    expandedCategoryId: "gallery-c",
    note: "Com inscrição viva, modalidade e gênero ficam travados e o Remover fica bloqueado com o motivo ANTES do toque.",
    title: "Categorias 5 | travada",
  },
];

function CategoryEditorFixture(props: {
  categories: TournamentCategoryDraft[];
  expandedCategoryId?: string;
}) {
  const form = useForm<{ categories: TournamentCategoryDraft[] }>({
    defaultValues: { categories: props.categories },
  });

  return (
    <FormProvider {...form}>
      <CategoryEditor
        initialExpandedCategoryId={props.expandedCategoryId}
        isDisabled={false}
      />
    </FormProvider>
  );
}

export function CategoryEditorVariantsSection() {
  return (
    <View className="gap-6">
      {galleryCategoryEditorVariants.map((variant) => (
        <VariantSection
          key={variant.title}
          note={variant.note}
          title={variant.title}
        >
          <CategoryEditorFixture
            categories={variant.categories}
            expandedCategoryId={variant.expandedCategoryId}
          />
        </VariantSection>
      ))}
    </View>
  );
}
