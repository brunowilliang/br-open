import {
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  TextArea,
  TextField,
} from "heroui-native";
import { useEffect, useState } from "react";

type ChallengeAdminActionDialogProps = {
  description: string;
  isDanger?: boolean;
  isOpen: boolean;
  isPending?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: (reason: string) => Promise<void> | void;
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
  const [errorMessage, setErrorMessage] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErrorMessage("");
    setReason("");
  }, [isOpen]);

  async function handleSubmit() {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setErrorMessage("Informe o motivo da ação administrativa.");
      return;
    }

    setErrorMessage("");
    await onSubmit(trimmedReason);
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

          <TextField isInvalid={Boolean(errorMessage)} isRequired>
            <Label>Motivo</Label>
            <TextArea
              editable={!isPending}
              onChangeText={(value) => {
                setReason(value);

                if (errorMessage) {
                  setErrorMessage("");
                }
              }}
              placeholder="Explique o motivo dessa ação."
              value={reason}
              variant="secondary"
            />
            <Description>{description}</Description>
            <FieldError>{errorMessage}</FieldError>
          </TextField>

          <Button
            className="self-end"
            isDisabled={isPending}
            onPress={handleSubmit}
            variant={isDanger ? "danger-soft" : "secondary"}
          >
            <Button.Label>{submitLabel}</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
