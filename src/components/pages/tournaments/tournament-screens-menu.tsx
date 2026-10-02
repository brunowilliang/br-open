import {
  Calendar03Icon,
  HierarchySquare01Icon,
  MoreVerticalIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "expo-router";
import { Button, Menu } from "heroui-native";

import { HugeIcons } from "@/components/ui/huge-icons";

type TournamentScreensMenuProps = {
  canOpenBracket: boolean;
  canOpenSchedule: boolean;
  tournamentId: string;
};

/** Menu do header para quem não é organizador: as telas que o papel pode abrir,
 * empilhadas por cima da visão geral (o voltar vive no header de cada tela). */
export function TournamentScreensMenu(props: TournamentScreensMenuProps) {
  const { canOpenBracket, canOpenSchedule, tournamentId } = props;
  const router = useRouter();

  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button isIconOnly size="sm" variant="secondary">
          <HugeIcons icon={MoreVerticalIcon} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay className="bg-backdrop" />
        <Menu.Content presentation="popover" width={240}>
          <Menu.Label>Telas</Menu.Label>
          {canOpenBracket ? (
            <Menu.Item
              onPress={() => {
                router.push({
                  params: { tournamentId },
                  pathname: "/tournaments/[tournamentId]/bracket",
                });
              }}
            >
              <Menu.ItemTitle>Chaveamento</Menu.ItemTitle>
              <HugeIcons icon={HierarchySquare01Icon} />
            </Menu.Item>
          ) : null}
          {canOpenSchedule ? (
            <Menu.Item
              onPress={() => {
                router.push({
                  params: { tournamentId },
                  pathname: "/tournaments/[tournamentId]/schedule",
                });
              }}
            >
              <Menu.ItemTitle>Agenda</Menu.ItemTitle>
              <HugeIcons icon={Calendar03Icon} />
            </Menu.Item>
          ) : null}
          <Menu.Item
            onPress={() => {
              router.push({
                params: { tournamentId },
                pathname: "/tournaments/[tournamentId]/entries",
              });
            }}
          >
            <Menu.ItemTitle>Inscrições</Menu.ItemTitle>
            <HugeIcons icon={UserMultipleIcon} />
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
