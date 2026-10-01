import { useLocalSearchParams } from "expo-router";

import { Page } from "@/components/core/page";
import { COMPONENT_GALLERY_SECTIONS } from "@/components/pages/settings";
import { EmptyState } from "@/components/ui/empty-state";
import { isComponentGalleryEnabled } from "@/lib/dev/component-gallery-flag";
import { findComponentGalleryEntry } from "@/lib/dev/component-registry";

/** Mesma marca da entrada da galeria (`EXPO_PUBLIC_COMPONENT_GALLERY`). */
export default function ComponentVariantsRoute() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const entry = findComponentGalleryEntry(component);
  const Section = entry ? COMPONENT_GALLERY_SECTIONS[entry.id] : undefined;

  if (!isComponentGalleryEnabled) {
    return null;
  }

  // Entrada de tela inteira: a seção desenha a própria moldura (header overlay
  // incluso) e a galeria não monta a dela.
  if (entry?.isFullscreen && Section) {
    return <Section />;
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          {entry ? (
            <>
              <Page.Header.SubTitle>Componentes</Page.Header.SubTitle>
              <Page.Header.Title>{entry.title}</Page.Header.Title>
            </>
          ) : (
            <Page.Header.Title>Componentes</Page.Header.Title>
          )}
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-6 px-4 pb-safe-offset-4">
        {entry ? (
          Section ? (
            <Section />
          ) : null
        ) : (
          <EmptyState
            description="Escolha um componente na listagem de Componentes."
            title="Componente não encontrado"
          />
        )}
      </Page.ScrollView>
    </Page>
  );
}
