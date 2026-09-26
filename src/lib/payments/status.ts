import type { PaymentChargeStatus } from "@convex/domains/payment/contract";

type PaymentStatusMeta = {
  /** Cor do chip do hub. */
  color: "danger" | "default" | "success" | "warning";
  label: string;
  /** Severidade do cartão de estado do checkout, na mesma família de cor. */
  severity: "danger" | "default" | "success" | "warning";
};

/** Fonte ÚNICA de rótulo/cor do estado da cobrança (hub e cartões do checkout). */
export const PAYMENT_STATUS_META: Record<
  PaymentChargeStatus,
  PaymentStatusMeta
> = {
  CANCELED: { color: "default", label: "Cancelado", severity: "default" },
  EXPIRED: { color: "danger", label: "Expirado", severity: "danger" },
  FAILED: { color: "danger", label: "Não concluído", severity: "danger" },
  PAID: { color: "success", label: "Pago", severity: "success" },
  PENDING: { color: "warning", label: "Pendente", severity: "warning" },
  REFUNDED: { color: "default", label: "Reembolsado", severity: "default" },
};

/**
 * `null` = valor fora do enum do app (bundle antigo ou servidor mais novo). Todo
 * estado do enum tem apresentação, então o `null` não chega ao chip do hub.
 */
export function getPaymentStatusMeta(
  status: PaymentChargeStatus | string
): PaymentStatusMeta | null {
  return PAYMENT_STATUS_META[status as PaymentChargeStatus] ?? null;
}

/** Sem apresentação o chip diz que não identificou o estado, nunca o enum cru. */
export function formatPaymentStatus(status: PaymentChargeStatus): string {
  return getPaymentStatusMeta(status)?.label ?? "Não identificado";
}

export function getPaymentStatusColor(
  status: PaymentChargeStatus
): "danger" | "default" | "success" | "warning" {
  return getPaymentStatusMeta(status)?.color ?? "default";
}
