import { Button, Dialog } from "heroui-native";
import { View } from "react-native";

import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { Text } from "@/components/core/text";

type MediaConfirmDialogProps = {
  /** Ação principal; default "Alterar" (org passa "Adicionar" sem logo). */
  confirmLabel?: string;
  description?: string;
  isOpen: boolean;
  onConfirm: () => void;
  onOpenChange: (nextOpen: boolean) => void;
  target: "avatar" | "banner" | "logo";
  title?: string;
};

type MediaConfirmCopy = {
  description: string;
  title: string;
};

const MEDIA_CONFIRM_COPY: Record<
  MediaConfirmDialogProps["target"],
  MediaConfirmCopy
> = {
  avatar: {
    description: "Quer alterar o avatar?",
    title: "Alterar avatar",
  },
  banner: {
    description: "Quer alterar o banner?",
    title: "Alterar banner",
  },
  logo: {
    description: "Quer alterar o logo?",
    title: "Alterar logo",
  },
};

/**
 * Confirmação antes de abrir a troca de avatar, banner ou logo (mesmo molde
 * dos dialogs Sair/Deletar liga). Confirmar fecha o dialog e dispara
 * {@link MediaConfirmDialogProps.onConfirm} — o fluxo de troca (picker, crop,
 * upload) fica com o caller.
 */
export function MediaConfirmDialog(props: MediaConfirmDialogProps) {
  const copy = MEDIA_CONFIRM_COPY[props.target];

  return (
    <Dialog isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <DialogCloseButton className="absolute top-4 right-4 z-100" />
          <Dialog.Title>{props.title ?? copy.title}</Dialog.Title>
          <Text color="muted" variant="description">
            {props.description ?? copy.description}
          </Text>

          <View className="flex-row gap-2 self-end">
            <Button
              onPress={() => {
                props.onOpenChange(false);
              }}
              size="sm"
              variant="secondary"
            >
              <Button.Label>Cancelar</Button.Label>
            </Button>
            <Button
              onPress={() => {
                props.onOpenChange(false);
                props.onConfirm();
              }}
              size="sm"
            >
              <Button.Label>{props.confirmLabel ?? "Alterar"}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
