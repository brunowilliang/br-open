import { Button, Checkbox, ControlField, Dialog } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ReasonField } from "@/components/pages/tournaments/reason-field";
import {
  formatUnavailabilitySpanLabel,
  type UnavailabilitySpan,
} from "@/lib/tournaments/unavailability-derived";

export type CancelMatchesDialogInput = {
  /** Fecha o período dos jogos cancelados junto (o check vem LIGADO). */
  blockPeriod: boolean;
  reason: null | string;
};

type CancelMatchesDialogProps = {
  isPending: boolean;
  /** Tamanho do lote: a copy muda no singular e no plural. */
  matchCount: number;
  onClose: () => void;
  onSubmit: (input: CancelMatchesDialogInput) => Promise<void> | void;
  /** Período que o check fecha, por dia (o primeiro início ao último fim). */
  spans: UnavailabilitySpan[];
};

/**
 * O diálogo ÚNICO do cancelamento (um jogo pelo menu do card ou vários pelo modo
 * seleção): motivo + o check que fecha o período pra ninguém remarcar pro mesmo
 * horário ruim.
 */
export function CancelMatchesDialog(props: CancelMatchesDialogProps) {
  const [reason, setReason] = useState("");
  const [blockPeriod, setBlockPeriod] = useState(true);
  const isBatch = props.matchCount > 1;
  const spansLabel = props.spans
    .map((span) => formatUnavailabilitySpanLabel(span))
    .join("; ");

  async function handleSubmit() {
    await props.onSubmit({
      blockPeriod,
      reason: reason.trim().length > 0 ? reason.trim() : null,
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView automaticOffset behavior="padding">
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>
              {isBatch ? "Cancelar jogos" : "Cancelar jogo"}
            </Dialog.Title>
            <Text color="muted" variant="description">
              {isBatch
                ? `Os ${props.matchCount} jogos voltam para A definir e os jogadores recebem o aviso.`
                : "O jogo volta para A definir e os dois jogadores recebem o aviso."}
            </Text>

            <ReasonField
              isDisabled={props.isPending}
              onChange={setReason}
              value={reason}
            />

            {props.spans.length > 0 ? (
              <ControlField
                className="gap-2"
                isDisabled={props.isPending}
                isSelected={blockPeriod}
                onSelectedChange={setBlockPeriod}
              >
                <ControlField.Indicator>
                  <Checkbox className="mt-0.5 bg-surface-secondary" />
                </ControlField.Indicator>
                <View className="flex-1 gap-1">
                  <Text weight="medium">Deixar o período indisponível</Text>
                  <Text color="muted" variant="description">
                    {`Ninguém agenda nesse horário até você reabrir: ${spansLabel}.`}
                  </Text>
                </View>
              </ControlField>
            ) : null}

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={props.isPending}
                onPress={props.onClose}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={props.isPending}
                onPress={() => {
                  handleSubmit().catch(() => undefined);
                }}
                size="sm"
                variant="danger"
              >
                <Button.Label>
                  {isBatch ? "Cancelar jogos" : "Cancelar jogo"}
                </Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
