import {
  AddTeamIcon,
  ArrowLeft01Icon,
  Building02Icon,
  CalendarUserIcon,
  ChampionIcon,
  PreferenceHorizontalIcon,
  SecurityPasswordIcon,
  TennisRacketIcon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import { type Href, router } from "expo-router";
import { ListGroup, Separator } from "heroui-native";
import type { ComponentProps } from "react";
import { Fragment } from "react";
import { Text } from "react-native";

import { HugeIcons } from "@/components/huge-icons";
import { Header } from "@/components/ui/header";
import { Page } from "@/components/ui/page";

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
    title: "Conta",
    items: [
      {
        description: "Dados da conta, e-mail e telefone",
        href: "..",
        icon: UserSettings01Icon,
        title: "Minha conta",
      },
      {
        description: "Senha, recuperação de acesso e sessões",
        href: "..",
        icon: SecurityPasswordIcon,
        title: "Segurança",
      },
      {
        description: "Tema, idioma e preferências do app",
        href: "..",
        icon: PreferenceHorizontalIcon,
        title: "Preferências",
      },
    ],
  },
  {
    title: "Jogador",
    items: [
      {
        description: "Nome esportivo, categoria e dados de competição",
        href: "/settings/player/profile",
        icon: TennisRacketIcon,
        title: "Perfil de jogador",
      },
      {
        description: "Torneios, ligas e inscrições como atleta",
        href: "/settings/player/entries",
        icon: CalendarUserIcon,
        title: "Minhas inscrições",
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      {
        description: "Criar organizações e alternar contexto",
        href: "..",
        icon: Building02Icon,
        title: "Organizações",
      },
      {
        description: "Criar torneios, inscrições, categorias e resultados",
        href: "..",
        icon: TennisRacketIcon,
        title: "Torneios",
      },
      {
        description: "Temporadas, etapas, rankings e participantes",
        href: "..",
        icon: ChampionIcon,
        title: "Ligas",
      },
      {
        description: "Membros, convites e permissões da organização",
        href: "..",
        icon: AddTeamIcon,
        title: "Equipe",
      },
    ],
  },
];

export default function Settings() {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Header.Icon
            className="size-5.5 text-foreground"
            icon={ArrowLeft01Icon}
            onPress={() => router.back()}
          />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Configurações</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-2 px-4 pb-safe-offset-4">
        {sections.map((section) => (
          <Fragment key={section.title}>
            <Text className="mt-3 mb-1 ml-2 text-muted text-sm">
              {section.title}
            </Text>
            <ListGroup>
              {section.items.map((item, index) => (
                <Fragment key={item.title}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ListGroup.Item onPress={() => router.push(item.href)}>
                    <ListGroup.ItemPrefix>
                      <HugeIcons
                        className="size-5.5 text-foreground"
                        icon={item.icon}
                      />
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
