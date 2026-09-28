import { ViewIcon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";
import { ListGroup, Separator } from "heroui-native";
import { Fragment } from "react";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";

import { HugeIcons } from "@/components/ui/huge-icons";
import { isComponentGalleryEnabled } from "@/lib/dev/component-gallery-flag";
import { COMPONENT_GALLERY_ENTRIES } from "@/lib/dev/component-registry";

/** Gated pela marca da galeria (`EXPO_PUBLIC_COMPONENT_GALLERY`), não pelo
 * `EXPO_PUBLIC_IS_DEV` dos atalhos de desenvolvimento. */
export default function ComponentGalleryListingRoute() {
  if (!isComponentGalleryEnabled) {
    return null;
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Componentes</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-2 px-4 pb-safe-offset-4">
        <Text color="muted" variant="description">
          Galeria para aprovação de componentes, variante por variante.
        </Text>
        <ListGroup>
          {COMPONENT_GALLERY_ENTRIES.map((entry, index) => (
            <Fragment key={entry.id}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <ListGroup.Item
                onPress={() => {
                  router.navigate({
                    params: { component: entry.id },
                    pathname: "/settings/components/[component]",
                  });
                }}
              >
                <ListGroup.ItemPrefix>
                  <HugeIcons icon={ViewIcon} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{entry.title}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {entry.description}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
              </ListGroup.Item>
            </Fragment>
          ))}
        </ListGroup>
      </Page.ScrollView>
    </Page>
  );
}
