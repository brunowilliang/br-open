import { Button, Description, Dialog } from "heroui-native";
import { View } from "react-native";

type ChallengeAdminActionDialogProps = {
  description: string;
  isDanger?: boolean;
  isOpen: boolean;
  isPending?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: () => Promise<void> | void;
  submitLabel: string;
  title: string;
};

export const ChallengeAdminActionDialog = (
  props: ChallengeAdminActionDialogProps
) => {
  const {
    description,
    isDanger,
    isOpen,
    isPending,
    onOpenChange,
    onSubmit,
    submitLabel,
    title,
  } = props;

  async function handleSubmit() {
    await onSubmit();
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          {isPending ? null : (
            <Dialog.Close className="absolute top-4 right-4 z-100" />
          )}
          <Dialog.Title>{title}</Dialog.Title>
          <Description>{description}</Description>

          <View className="flex-row justify-end gap-2">
            <Button
              isDisabled={isPending}
              onPress={() => {
                onOpenChange(false);
              }}
              size="sm"
              variant="secondary"
            >
              <Button.Label>Não</Button.Label>
            </Button>
            <Button
              isDisabled={isPending}
              onPress={handleSubmit}
              size="sm"
              variant={isDanger ? "danger-soft" : "secondary"}
            >
              <Button.Label>{submitLabel}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
