import { HugeIcons } from "@/components/ui/huge-icons";
import { Button, Chip, ListGroup } from "heroui-native";
import { memo, type ComponentProps } from "react";
import { View } from "react-native";

export type LinkedAccountStatus = "connected" | "disconnected";

export type LinkedAccountStatusChip = {
  color: "default" | "success";
  isLabelMuted?: boolean;
  label: string;
};

/** Chip BINÁRIO: o progresso da ação vive no botão, nunca no chip. */
export const LINKED_ACCOUNT_STATUS_CHIPS: Record<
  LinkedAccountStatus,
  LinkedAccountStatusChip
> = {
  connected: { color: "success", label: "Conectado" },
  disconnected: {
    color: "default",
    isLabelMuted: true,
    label: "Não conectado",
  },
};

type LinkedAccountAction = {
  label: string;
  variant: "danger-soft" | "secondary";
};

const STATUS_ACTIONS: Record<LinkedAccountStatus, LinkedAccountAction> = {
  connected: { label: "Desconectar", variant: "danger-soft" },
  disconnected: { label: "Conectar", variant: "secondary" },
};

const PENDING_ACTIONS: Record<"link" | "unlink", LinkedAccountAction> = {
  link: { label: "Conectando...", variant: "secondary" },
  unlink: { label: "Desconectando...", variant: "danger-soft" },
};

type LinkedAccountRowProps = {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  /** Trava a ação enquanto OUTRA linha conecta ou desconecta. */
  isActionDisabled?: boolean;
  /** Linha só informativa (e-mail e senha): sem ação. */
  isInformational?: boolean;
  onActionPress?: () => void;
  /** Ação em voo NESTA linha: o botão conta o progresso e a ação fica travada. */
  pendingAction?: "link" | "unlink";
  status: LinkedAccountStatus;
  title: string;
};

/**
 * Linha de conta vinculada no molde de `settings/index.tsx`: ícone no
 * ItemPrefix, chip em cima do título no ItemContent (posição aprovada),
 * ação no ItemSuffix. O Separator fica com quem monta a lista.
 */
function LinkedAccountRowImpl(props: LinkedAccountRowProps) {
  const chip = LINKED_ACCOUNT_STATUS_CHIPS[props.status];
  const action = props.pendingAction
    ? PENDING_ACTIONS[props.pendingAction]
    : STATUS_ACTIONS[props.status];
  const isActionPending = props.pendingAction !== undefined;
  // A linha informativa só esmaece quando não há conta, como a tela já fazia.
  const isDimmed = props.isInformational && props.status === "disconnected";

  return (
    <ListGroup.Item
      className={isDimmed ? "opacity-50" : undefined}
      disabled={props.isInformational}
    >
      <ListGroup.ItemPrefix>
        <HugeIcons icon={props.icon} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent className="gap-1">
        {/* A caixa em linha é o que impede o chip de esticar na largura. */}
        <View className="flex-row items-center">
          <Chip color={chip.color} size="sm" variant="soft">
            <Chip.Label
              className={chip.isLabelMuted ? "text-muted" : undefined}
            >
              {chip.label}
            </Chip.Label>
          </Chip>
        </View>
        <ListGroup.ItemTitle>{props.title}</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix className="items-center">
        {props.isInformational ? null : (
          <Button
            isDisabled={props.isActionDisabled || isActionPending}
            onPress={props.onActionPress}
            size="sm"
            variant={action.variant}
          >
            <Button.Label>{action.label}</Button.Label>
          </Button>
        )}
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

export const LinkedAccountRow = memo(LinkedAccountRowImpl);
