import { HugeIcons } from "@/components/ui/huge-icons";
import { Page } from "@/components/ui/page";
import { useSignOutMutationOptions } from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  BellDotIcon,
  ChampionIcon,
  Logout03Icon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import { useMutation } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { Description, ListGroup, Separator, useToast } from "heroui-native";
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
  const { toast } = useToast();
  const signOut = useMutation(
    useSignOutMutationOptions({
      onSuccess: () => {
        router.replace("/sign-in");
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível encerrar sua sessão."
          ),
          id: "settings-sign-out-error",
          label: "Erro ao sair",
          variant: "danger",
        });
      },
    })
  );

  function handleSignOutPress() {
    if (signOut.isPending) {
      return;
    }

    signOut.reset();
    signOut.mutate();
  }

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
        <Description>Conta</Description>
        <ListGroup>
          <ListGroup.Item
            className={signOut.isPending ? "opacity-50" : undefined}
            disabled={signOut.isPending}
            onPress={handleSignOutPress}
          >
            <ListGroup.ItemPrefix>
              <HugeIcons className="text-danger" icon={Logout03Icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle className="text-danger">
                {signOut.isPending ? "Saindo..." : "Sair"}
              </ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                Encerrar sessão neste dispositivo
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
        </ListGroup>
      </Page.ScrollView>
    </Page>
  );
}
