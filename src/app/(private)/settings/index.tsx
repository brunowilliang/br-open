import { HugeIcons } from "@/components/ui/huge-icons";
import { Page } from "@/components/ui/page";
import {
  BellDotIcon,
  ChampionIcon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import { type Href, router } from "expo-router";
import { Description, ListGroup, Separator } from "heroui-native";
import type { ComponentProps } from "react";
import { Fragment } from "react";

type SettingsItem = {
  description: string;
  href: Href;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  title: string;
};

type SettingsSection = {
  items: SettingsItem[];
  title: string;
};

const sections: SettingsSection[] = [
  {
    title: "Menus",
    items: [
      {
        title: "Perfil do jogador",
        description: "Gerencie seu perfil como jogador",
        icon: TennisRacketIcon,
        href: "/settings/player/profile",
      },
      {
        title: "Ligas",
        description: "Crie e administre suas ligas",
        icon: ChampionIcon,
        href: "/settings/leagues",
      },
      {
        title: "Notificações",
        description: "Push e central de notificações",
        icon: BellDotIcon,
        href: "/settings/notifications",
      },
    ],
  },
];

export default function Settings() {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Configurações</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-2 px-4 pb-safe-offset-4">
        {sections.map((section) => (
          <Fragment key={section.title}>
            <Description>{section.title}</Description>
            <ListGroup>
              {section.items.map((item, index) => (
                <Fragment key={item.title}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ListGroup.Item onPress={() => router.navigate(item.href)}>
                    <ListGroup.ItemPrefix>
                      <HugeIcons icon={item.icon} />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{item.title}</ListGroup.ItemTitle>
                      <ListGroup.ItemDescription>
                        {item.description}
                      </ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                  </ListGroup.Item>
                </Fragment>
              ))}
            </ListGroup>
          </Fragment>
        ))}
      </Page.ScrollView>
    </Page>
  );
}
