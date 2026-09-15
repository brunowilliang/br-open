import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button, useDialog } from "heroui-native";

import { HugeIcons } from "@/components/ui/huge-icons";

type DialogCloseButtonProps = {
  /** Posição do botão (ex.: o `absolute top-4 right-4 z-100` do header). */
  className?: string;
  /** Trava o fechamento enquanto uma ação do dialog está pendente. */
  isDisabled?: boolean;
};

/**
 * Botão de fechar GLOBAL dos dialogs (RUL-0005): renderiza um `Button` puro
 * icon-only `tertiary` `size="sm"` com o `Cancel01Icon` do HugeIcons. O
 * fechamento usa o MESMO mecanismo interno do dialog — o contexto do root
 * (`useDialog().onOpenChange(false)`, exportado pela lib) —, sem envolver o
 * `Dialog.Close`. Não precisa receber callback: mantém a posição passada em
 * `className` (RUL-0008: absoluto ancora no pai direto, que segue sendo o
 * `Dialog.Content`).
 */
export function DialogCloseButton(props: DialogCloseButtonProps) {
  const { onOpenChange } = useDialog();

  return (
    <Button
      className={props.className}
      isDisabled={props.isDisabled}
      isIconOnly
      onPress={() => {
        onOpenChange(false);
      }}
      size="sm"
      variant="tertiary"
    >
      <HugeIcons className="size-5" icon={Cancel01Icon} />
    </Button>
  );
}
