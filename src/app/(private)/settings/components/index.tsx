import { ViewIcon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";
import { ListGroup, Separator } from "heroui-native";
import { Fragment } from "react";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";

import { HugeIcons } from "@/components/ui/huge-icons";
import { COMPONENT_GALLERY_ENTRIES } from "@/lib/dev/component-registry";

/**
 * Listagem da galeria dev (IBX-0072): um item por componente no registro
 * (`COMPONENT_GALLERY_ENTRIES`). DEV ONLY: gated por `EXPO_PUBLIC_IS_DEV`
 * (mesmo mecanismo do simulatePayment, checkout [chargeId]/index.tsx:365-370)
 * — perfil dev de conta não existe no app; usuário final não vê a entrada.
 */
export default function ComponentGalleryListingRoute() {
  if (process.env.EXPO_PUBLIC_IS_DEV !== "true") {
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
