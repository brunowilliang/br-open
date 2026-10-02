import { Button, Dialog } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";

type CancelTournamentDialogProps = {
  isOpen: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (isOpen: boolean) => void;
};

/** Diálogo do cancelamento do torneio: o wiring (mutation, toast e invalidate)
 * fica na página, ele só pede a confirmação. */
export function CancelTournamentDialog(props: CancelTournamentDialogProps) {
  const { isOpen, isPending, onConfirm, onOpenChange } = props;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <DialogCloseButton className="absolute top-4 right-4 z-100" />
          <Dialog.Title>Cancelar torneio</Dialog.Title>
          <Text color="muted" variant="description">
            Todas as inscrições serão canceladas. Inscrições pagas serão
            estornadas automaticamente pelo valor integral.
          </Text>
          <View className="flex-row gap-2 self-end">
            <Button
              onPress={() => {
                onOpenChange(false);
              }}
              size="sm"
              variant="secondary"
            >
              <Button.Label>Voltar</Button.Label>
            </Button>
            <Button
              isDisabled={isPending}
              onPress={onConfirm}
              size="sm"
              variant="danger-soft"
            >
              <Button.Label>Cancelar torneio</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
