import { useState } from "react";
import { View } from "react-native";

import {
  VariantSection,
  buildGalleryCategory,
} from "@/components/pages/settings/shared";
import { CategorySelect } from "@/components/ui/category-select";
import type { TournamentCategoryDraft } from "@/lib/tournaments/category-editor-derived";

type CategorySelectGalleryVariant = {
  categories: TournamentCategoryDraft[];
  note: string;
  tabMode?: "active" | "type";
  title: string;
  value: string;
};

const GALLERY_CATEGORY_SELECT_FOUR_TYPES: TournamentCategoryDraft[] = [
  buildGalleryCategory({ id: "gallery-a", name: "Categoria A" }),
  buildGalleryCategory({ id: "gallery-b", name: "Categoria B" }),
  buildGalleryCategory({
    gender: "female",
    id: "gallery-c",
    name: "Categoria A",
  }),
  buildGalleryCategory({
    gender: "female",
    id: "gallery-d",
    name: "Categoria B",
  }),
  buildGalleryCategory({
    id: "gallery-e",
    modality: "doubles",
    name: "Categoria A",
  }),
  buildGalleryCategory({
    gender: "mixed",
    id: "gallery-f",
    modality: "doubles",
    name: "Categoria A",
  }),
];

const galleryCategorySelectVariants: CategorySelectGalleryVariant[] = [
  {
    categories: [
      buildGalleryCategory({ id: "gallery-a", name: "Categoria A" }),
      buildGalleryCategory({ id: "gallery-b", name: "Categoria B" }),
    ],
    note: "Uma aba ocupa a barra inteira; o toque abre a lista do grupo.",
    tabMode: "type",
    title: "Seletor 1 | 1 item",
    value: "gallery-a",
  },
  {
    categories: [
      buildGalleryCategory({ id: "gallery-a", name: "Categoria A" }),
      buildGalleryCategory({
        gender: "female",
        id: "gallery-b",
        name: "Categoria A",
      }),
    ],
    note: "Duas abas dividem a barra em metades.",
    tabMode: "type",
    title: "Seletor 2 | 2 itens",
    value: "gallery-b",
  },
  {
    categories: [
      buildGalleryCategory({ id: "gallery-a", name: "Categoria A" }),
      buildGalleryCategory({
        gender: "female",
        id: "gallery-b",
        name: "Categoria A",
      }),
      buildGalleryCategory({
        id: "gallery-c",
        modality: "doubles",
        name: "Categoria A",
      }),
    ],
    note: "Três abas: entra a rolagem horizontal, sem divisão.",
    tabMode: "type",
    title: "Seletor 3 | 3 itens",
    value: "gallery-c",
  },
  {
    categories: GALLERY_CATEGORY_SELECT_FOUR_TYPES,
    note: "Quatro abas: a rolagem horizontal continua igual.",
    tabMode: "type",
    title: "Seletor 4 | 4 itens (rolagem)",
    value: "gallery-a",
  },
  {
    categories: [
      buildGalleryCategory({ id: "gallery-single-a", name: "Categoria A" }),
      buildGalleryCategory({ id: "gallery-single-b", name: "Categoria B" }),
      buildGalleryCategory({
        gender: "female",
        id: "gallery-single-c",
        name: "Categoria A",
      }),
      buildGalleryCategory({
        gender: "mixed",
        id: "gallery-single-d",
        modality: "doubles",
        name: "Categoria A",
      }),
    ],
    note: "Uma aba com a seleção: o toque abre a lista inteira.",
    tabMode: "active",
    title: "Seletor 5 | uma aba",
    value: "gallery-single-b",
  },
];

function CategorySelectFixture(props: {
  categories: TournamentCategoryDraft[];
  tabMode?: "active" | "type";
  value: string;
}) {
  const [selectedId, setSelectedId] = useState(props.value);

  return (
    <CategorySelect
      categories={props.categories}
      onChange={setSelectedId}
      tabMode={props.tabMode}
      value={selectedId}
    />
  );
}

export function CategorySelectVariantsSection() {
  return (
    <View className="gap-6">
      {galleryCategorySelectVariants.map((variant) => (
        <VariantSection
          key={variant.title}
          note={variant.note}
          title={variant.title}
        >
          <CategorySelectFixture
            categories={variant.categories}
            tabMode={variant.tabMode}
            value={variant.value}
          />
        </VariantSection>
      ))}
    </View>
  );
}
