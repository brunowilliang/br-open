import type { PaymentChargeStatus } from "@convex/domains/payment/contract";

export const PAYMENT_STATUS_META: Record<
  PaymentChargeStatus,
  { color: "danger" | "default" | "success" | "warning"; label: string }
> = {
  EXPIRED: { color: "danger", label: "Expirado" },
  FAILED: { color: "danger", label: "Falhou" },
  PAID: { color: "success", label: "Pago" },
  PENDING: { color: "warning", label: "Pendente" },
  REFUNDED: { color: "default", label: "Reembolsado" },
};

export function formatPaymentStatus(status: PaymentChargeStatus): string {
  return PAYMENT_STATUS_META[status]?.label ?? "Falhou";
}

export function getPaymentStatusColor(
  status: PaymentChargeStatus
): "danger" | "default" | "success" | "warning" {
  return PAYMENT_STATUS_META[status]?.color ?? "default";
}
