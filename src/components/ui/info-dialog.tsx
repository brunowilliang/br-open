import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Description, Dialog, PressableFeedback } from "heroui-native";
import { View } from "react-native";

import { HugeIcons } from "@/components/ui/huge-icons";

/**
 * Conteúdo de um dialog de explicação (título + descrição). Usado pelos cards
 * de regra (rule-card), pelos KPI cards e pelo card de saldo/saque.
 */
export type InfoContent = {
  description: string;
  title: string;
};

type InfoTriggerProps = {
  className?: string;
  hint?: string;
  onPress: () => void;
  title: string;
};

/**
 * Ícone de informação com feedback de toque. Não abre o dialog sozinho — o
 * card dono do estado liga o press ao {@link InfoDialog}, renderizado como
 * irmão da superfície.
 */
export function InfoTrigger(props: InfoTriggerProps) {
  return (
    <PressableFeedback
      accessibilityHint={props.hint ?? "Abre uma explicação."}
      accessibilityLabel={`Detalhes: ${props.title}`}
      accessibilityRole="button"
      className={props.className ?? "p-1"}
      onPress={props.onPress}
    >
      <HugeIcons className="size-5 text-muted" icon={InformationCircleIcon} />
    </PressableFeedback>
  );
}

type InfoDialogProps = {
  content: InfoContent;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

/**
 * Dialog de explicação somente-leitura. O root do `Dialog` do HeroUI sempre
 * reserva espaço de layout, então o dialog vive em um container absoluto
 * irmão do conteúdo — zero impacto no layout, inclusive dentro de `flex-row`
 * (grids de KPI).
 */
export function InfoDialog(props: InfoDialogProps) {
  return (
    <View className="absolute">
      <Dialog isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <Dialog.Close className="absolute top-4 right-4 z-100" />
            <Dialog.Title>{props.content.title}</Dialog.Title>
            <Description>{props.content.description}</Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
