import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button, useDialog } from "heroui-native";

import { HugeIcons } from "@/components/ui/huge-icons";

type DialogCloseButtonProps = {
  /** Posição do botão (ex.: o `absolute top-4 right-4 z-100` do header). */
  className?: string;
  /** Trava o fechamento enquanto uma ação do dialog está pendente. */
  isDisabled?: boolean;
};

/** Fecha pelo contexto do root (`useDialog().onOpenChange(false)`), sem passar
 * pelo `Dialog.Close` — não precisa receber callback. O `className` traz a
 * posição: absoluto em RN ancora no pai DIRETO, que aqui é o `Dialog.Content`. */
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
