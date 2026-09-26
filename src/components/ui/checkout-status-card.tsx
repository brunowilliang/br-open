import { cn } from "better-styled";

import { EmptyState } from "@/components/ui/empty-state";
import type { CheckoutChargeView } from "@/lib/payments/checkout-view";

/**
 * Tinta e bolha da severidade: sem fundo no cartão, a cor vive no ícone, no
 * título e na bolha do Media. Classes literais porque o Uniwind só extrai o
 * className do código.
 */
const SEVERITY_STYLE: Record<
  CheckoutChargeView["severity"],
  { ink: string; media: string }
> = {
  danger: { ink: "text-danger", media: "bg-danger-soft" },
  default: { ink: "text-foreground", media: "bg-default-soft" },
  success: { ink: "text-success", media: "bg-success-soft" },
  warning: { ink: "text-warning", media: "bg-warning-soft" },
};

type CheckoutStatusCardProps = {
  /** Ação do estado desabilitada (ex.: criação de cobrança em andamento). */
  isActionDisabled?: boolean;
  /** Handler da ação do estado: o cartão não navega nem muta por conta própria. */
  onAction?: () => void;
  /** View do estado (texto em `lib/payments/checkout-view`) ou do cartão de falha. */
  view: CheckoutChargeView;
};

/** Cartão de estado da cobrança: molde do empty state, sem fundo. */
export function CheckoutStatusCard(props: CheckoutStatusCardProps) {
  const { isActionDisabled, onAction, view } = props;
  const style = SEVERITY_STYLE[view.severity];

  return (
    <EmptyState
      buttonIcon={null}
      buttonIsDisabled={isActionDisabled}
      buttonLabel={view.action?.label}
      buttonOnPress={onAction}
      buttonVariant={view.action?.variant}
      className="w-full"
      description={view.description}
      descriptionClassName="text-base"
      icon={view.icon}
      iconClassName={style.ink}
      mediaClassName={style.media}
      title={view.title}
      titleClassName={cn(style.ink, "text-lg")}
    />
  );
}
