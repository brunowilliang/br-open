import type { TournamentStatus } from "@convex/domains/tournament/contract";
import {
  Calendar03Icon,
  Cancel01Icon,
  ClipboardIcon,
  Edit02Icon,
  HierarchySquare01Icon,
  MoreVerticalIcon,
  PlayIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "expo-router";
import { Button, Menu } from "heroui-native";

import { HugeIcons } from "@/components/ui/huge-icons";

type OrganizerMenuProps = {
  canOpenBracket: boolean;
  canOpenSchedule: boolean;
  onCancelPress: () => void;
  onPublish: () => void;
  status: TournamentStatus;
  tournamentId: string;
};

/** Menu do header na casa do organizador: navegação das abas do torneio e as
 * ações de ciclo de vida, cujo wiring fica na página. */
export function OrganizerMenu(props: OrganizerMenuProps) {
  const {
    canOpenBracket,
    canOpenSchedule,
    onCancelPress,
    onPublish,
    status,
    tournamentId,
  } = props;
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
          <Menu.Item
            onPress={() => {
              router.navigate({
                params: { mode: "edit", tournamentId },
                pathname: "/settings/tournaments/[mode]",
              });
            }}
          >
            <Menu.ItemTitle>Editar</Menu.ItemTitle>
            <HugeIcons icon={Edit02Icon} />
          </Menu.Item>
          {canOpenBracket ? (
            <Menu.Item
              onPress={() => {
                router.navigate({
                  params: { tournamentId },
                  pathname: "/tournaments/[tournamentId]/bracket",
                });
              }}
            >
              <Menu.ItemTitle>Chave</Menu.ItemTitle>
              <HugeIcons icon={HierarchySquare01Icon} />
            </Menu.Item>
          ) : null}
          {canOpenSchedule ? (
            <Menu.Item
              onPress={() => {
                router.navigate({
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
              router.navigate({
                params: { initialTab: "pending", tournamentId },
                pathname: "/tournaments/[tournamentId]/entries",
              });
            }}
          >
            <Menu.ItemTitle>Inscrições</Menu.ItemTitle>
            <HugeIcons icon={UserMultipleIcon} />
          </Menu.Item>
          <Menu.Item
            onPress={() => {
              router.navigate({
                params: { tournamentId },
                pathname: "/tournaments/[tournamentId]/rules",
              });
            }}
          >
            <Menu.ItemTitle>Regras</Menu.ItemTitle>
            <HugeIcons icon={ClipboardIcon} />
          </Menu.Item>
          {status === "draft" ? (
            <Menu.Item onPress={onPublish}>
              <Menu.ItemTitle>Publicar</Menu.ItemTitle>
              <HugeIcons icon={PlayIcon} />
            </Menu.Item>
          ) : null}
          {/* Cancelar só antes do início: o servidor ainda aceita
              depois, e é isso que o app deixa de oferecer. */}
          {status === "published" || status === "drawn" ? (
            <Menu.Item onPress={onCancelPress} variant="danger">
              <Menu.ItemTitle>Cancelar torneio</Menu.ItemTitle>
              <HugeIcons className="text-danger" icon={Cancel01Icon} />
            </Menu.Item>
          ) : null}
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
