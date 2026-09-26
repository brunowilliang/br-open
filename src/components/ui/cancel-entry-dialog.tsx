import { Button, Dialog } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";

type CancelEntryDialogProps = {
  /** Nome da categoria da inscrição, quando houver. */
  categoryLabel?: null | string;
  isOpen: boolean;
  /** Cancelamento em andamento: trava o confirmar. */
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Confirmação de cancelar inscrição: o MESMO diálogo no checkout e na lista de
 * inscrições, com uma copy só.
 */
export function CancelEntryDialog(props: CancelEntryDialogProps) {
  const { categoryLabel, isOpen, isPending, onClose, onConfirm } = props;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <DialogCloseButton className="absolute top-4 right-4 z-100" />
          <Dialog.Title>Cancelar inscrição</Dialog.Title>
          <Text color="muted" variant="description">
            {`Sua inscrição em ${
              categoryLabel ?? "torneio"
            } será cancelada, o PIX em aberto deixa de valer e a vaga volta para a categoria. Em duplas, a saída vale para os dois jogadores. Inscrição já paga recebe estorno integral.`}
          </Text>
          <View className="flex-row gap-2 self-end">
            <Button onPress={onClose} size="sm" variant="secondary">
              <Button.Label>Voltar</Button.Label>
            </Button>
            <Button
              isDisabled={isPending}
              onPress={onConfirm}
              size="sm"
              variant="danger-soft"
            >
              <Button.Label>Cancelar inscrição</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
