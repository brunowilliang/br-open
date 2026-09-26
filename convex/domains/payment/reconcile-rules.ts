import type { PaymentChargeStatus } from "./contract";
import {
  CHARGE_CANCEL_CONFIRMED,
  CHARGE_STATUS_CANCELED,
  CHARGE_STATUS_EXPIRED,
  CHARGE_STATUS_FAILED,
  CHARGE_STATUS_PENDING,
} from "./rules";

/** PENDING mais velha que isso: o webhook de PAID/EXPIRED pode ter se perdido. */
export const RECONCILE_PENDING_AFTER_MS = 10 * 60 * 1000;

/** Janela em que uma cobranca ja terminal ainda aceita pagamento tardio. */
export const RECONCILE_TERMINAL_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Quem a reconciliacao precisa reconferir no provedor. Dinheiro so entra por
 * `applyPaidCharge`, e ele so roda com webhook entregue — entao toda cobranca
 * que AINDA pode receber pagamento precisa ser lida do provedor, nao so a
 * PENDING.
 */
export function shouldReconcileCharge(args: {
  cancelStatus: null | string;
  createdAtMs: number;
  nowMs: number;
  status: PaymentChargeStatus;
}): boolean {
  const ageMs = args.nowMs - args.createdAtMs;

  if (args.status === CHARGE_STATUS_PENDING) {
    return ageMs >= RECONCILE_PENDING_AFTER_MS;
  }
  if (ageMs > RECONCILE_TERMINAL_WINDOW_MS) {
    return false;
  }
  if (args.status === CHARGE_STATUS_CANCELED) {
    // Cancelamento NAO confirmado = o PIX pode seguir vivo no provedor.
    return args.cancelStatus !== CHARGE_CANCEL_CONFIRMED;
  }

  return (
    args.status === CHARGE_STATUS_EXPIRED ||
    args.status === CHARGE_STATUS_FAILED
  );
}
