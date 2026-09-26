import type {
  ChargeCancelStatus,
  PaymentChargeStatus,
  SplitConfig,
} from "./contract";

/** PIX validity, in seconds: the same value goes to Woovi as `expiresIn`. */
export const CHARGE_EXPIRES_IN_SECONDS = 3600; // 1 hour

export const CHARGE_STATUS_PENDING =
  "PENDING" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_PAID = "PAID" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_EXPIRED =
  "EXPIRED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_REFUNDED =
  "REFUNDED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_CANCELED =
  "CANCELED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_FAILED =
  "FAILED" as const satisfies PaymentChargeStatus;

export const CHARGE_CANCEL_PENDING =
  "pending" as const satisfies ChargeCancelStatus;
export const CHARGE_CANCEL_FAILED =
  "failed" as const satisfies ChargeCancelStatus;
export const CHARGE_CANCEL_CONFIRMED =
  "canceled" as const satisfies ChargeCancelStatus;

type ChargeLike = { status: string };

export function canChargeBePaid(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

export function canChargeBeExpired(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

/** PAID only, plus EXPIRED defensively so a late refund webhook for a
 * locally-expired charge still reconciles. */
export function canChargeBeRefunded(charge: ChargeLike): boolean {
  return (
    charge.status === CHARGE_STATUS_PAID ||
    charge.status === CHARGE_STATUS_EXPIRED
  );
}

/** Guarda PROPRIA do cancelamento: so PENDING vira CANCELED. Nao usa
 * `canChargeBeExpired` porque cancelar e uma decisao do jogador, nao um prazo. */
export function canChargeBeCanceled(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

/** Dinheiro que chegou numa cobranca que o app ja considerava morta (cancelada,
 * expirada ou falhada); PAID/REFUNDED ficam FORA. */
export function shouldRefundLatePayment(charge: ChargeLike): boolean {
  return (
    charge.status === CHARGE_STATUS_CANCELED ||
    charge.status === CHARGE_STATUS_EXPIRED ||
    charge.status === CHARGE_STATUS_FAILED
  );
}

/** "pending" (pedido em voo) e "refunded" (confirmado) nunca sao sobrescritos;
 * `null`, "failed" e o campo AUSENTE (linha gravada antes de o campo existir)
 * podem ser (re)pedidos. */
export function canRequestRefund(charge: {
  refundStatus?: null | string;
}): boolean {
  return (
    charge.refundStatus !== "pending" && charge.refundStatus !== "refunded"
  );
}

/** Campos de ciclo de vida de uma cobranca NOVA: `refundStatus` nasce GRAVADO
 * (`null`) para que "sem pedido de estorno" nunca dependa de o campo estar
 * ausente na linha. `duplicate` e a linha que nasce morta (PIX descartado). */
export function newChargeLifecycleFields(input: {
  duplicate: boolean;
  status: string;
}): { cancelStatus: string | null; refundStatus: null; status: string } {
  return {
    cancelStatus: input.duplicate ? CHARGE_CANCEL_PENDING : null,
    refundStatus: null,
    status: input.duplicate ? CHARGE_STATUS_CANCELED : input.status,
  };
}

/** Status de `refundStatus` com estorno EM ABERTO (pedido em voo ou recusado):
 * e o que o sweep reprocessa e o que a reserva de saque precisa enxergar. */
export const REFUND_OUTSTANDING_STATUSES = ["pending", "failed"] as const;

export const CHARGE_REFUNDED_FIELDS = {
  refundStatus: "refunded",
  status: CHARGE_STATUS_REFUNDED,
} as const;

/** Estorno EM ABERTO (pedido em voo ou recusado): o que o sweep reprocessa e a
 * reserva enxerga. Dinheiro ja devolvido (status REFUNDED) NUNCA esta em aberto. */
export function isRefundOutstanding(charge: {
  refundStatus: null | string;
  status: string;
}): boolean {
  return (
    charge.status !== CHARGE_STATUS_REFUNDED &&
    (REFUND_OUTSTANDING_STATUSES as readonly string[]).includes(
      charge.refundStatus ?? ""
    )
  );
}

/** Status cru do estorno no provedor -> `refundStatus`: so um CONFIRMED fecha o
 * estorno, um REJECTED libera a retentativa e IN_PROCESSING (ou desconhecido)
 * segue pendente para o sweep reconferir. */
export function resolveRefundOutcome(
  providerStatus: string
): "failed" | "pending" | "refunded" {
  if (providerStatus === "CONFIRMED") {
    return "refunded";
  }

  return providerStatus === "REJECTED" ? "failed" : "pending";
}

/** Single predicate behind both checkout ends (the charge `createCharge`
 * reuses and the screen's `pendingCharge`). A PENDING charge past `expiresAt`
 * is unusable already — the provider refuses it before the sweeper runs. */
export function hasUsablePix(args: {
  charge: { expiresAt: null | Date; status: string } | null | undefined;
  nowMs: number;
}): boolean {
  return Boolean(
    args.charge &&
      args.charge.status === CHARGE_STATUS_PENDING &&
      args.charge.expiresAt &&
      args.charge.expiresAt.getTime() > args.nowMs
  );
}

/** Unknown provider statuses fall back to PENDING, never to PAID. */
export function normalizeProviderStatus(
  raw?: null | string
): PaymentChargeStatus {
  switch (raw) {
    case "ACTIVE":
      return CHARGE_STATUS_PENDING;
    case "COMPLETED":
      return CHARGE_STATUS_PAID;
    case "EXPIRED":
      return CHARGE_STATUS_EXPIRED;
    default:
      return CHARGE_STATUS_PENDING;
  }
}

/** BR-Open platform fee percent (0-100) applied when the payable source has no
 * explicit override: the organizer receives `(100 - fee)%`, BR-Open keeps
 * `fee%`. The final per-charge fee is
 * `max(feePercent · ticket, Woovi fee + margin)` — see `computeSplit`. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

/** Floor of the BR-Open fee AFTER the Woovi fee: on cheap tickets the
 * organizer pays the difference when the percentage cut would net less. */
export const PLATFORM_FEE_MIN_MARGIN_CENTS = 100; // R$ 1,00

/** Woovi PIX-IN schedule (percentual plan): 0.80% per PIX, min R$ 0,50,
 * max R$ 5,00 — in bps + cents so the math stays exact. */
export const WOOVI_FEE_BPS = 80; // 0.80%
export const WOOVI_FEE_MIN_CENTS = 50; // R$ 0,50
export const WOOVI_FEE_MAX_CENTS = 500; // R$ 5,00

export function computeWooviFeeCents(amountCents: number): number {
  const pct = Math.round((amountCents * WOOVI_FEE_BPS) / 10_000);
  return Math.min(Math.max(pct, WOOVI_FEE_MIN_CENTS), WOOVI_FEE_MAX_CENTS);
}

export type ComputedSplit = Omit<SplitConfig, "wooviFeeCents"> & {
  wooviFeeCents: number;
};

/** BR-Open keeps `max(feePercent · amount, Woovi fee + margin)`; the organizer
 * gets the remainder, so the split always sums exactly to `amountCents`. */
export function computeSplit(args: {
  amountCents: number;
  feePercent: number;
  recipientPixKey: string;
}): ComputedSplit {
  const wooviFeeCents = computeWooviFeeCents(args.amountCents);
  // Fee capped at the ticket: the organizer share must stay >= 0, since a
  // negative split is invalid at the provider.
  const brOpenCents = Math.min(
    Math.max(
      Math.round(args.amountCents * (args.feePercent / 100)),
      wooviFeeCents + PLATFORM_FEE_MIN_MARGIN_CENTS
    ),
    args.amountCents
  );
  return {
    brOpenCents,
    feePercent: args.feePercent,
    organizerCents: args.amountCents - brOpenCents,
    recipientPixKey: args.recipientPixKey,
    wooviFeeCents,
  };
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Brazil dropped DST, so a fixed UTC-3 is exact; the app must label dates with
 * this same offset or they disagree near midnight. */
export const BRAZIL_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Month bucket on the Brazilian calendar: a charge paid 23:59 BRT on the
 * month's last day belongs to that month, not the next. */
export function buildBrazilMonthKey(ms: number): string {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fixed x-axis: every month of the window is present, so empty months render
 * as zero instead of disappearing. */
export function buildRecentMonthKeys(args: {
  months: number;
  nowMs: number;
}): string[] {
  const current = new Date(args.nowMs + BRAZIL_UTC_OFFSET_MS);
  const keys: string[] = [];
  let year = current.getUTCFullYear();
  let month = current.getUTCMonth();
  for (let index = 0; index < args.months; index += 1) {
    keys.unshift(`${year}-${String(month + 1).padStart(2, "0")}`);
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return keys;
}

export function monthKeyWindowStartMs(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1) - BRAZIL_UTC_OFFSET_MS;
}

/** Only the owner of the source (the entry payer) may create or reuse its
 * charge; a caller with no player profile never owns one. */
export function ownsPayableSource(args: {
  callerProfileId: null | string | undefined;
  ownerProfileId: null | string | undefined;
}): boolean {
  return Boolean(
    args.callerProfileId &&
      args.ownerProfileId &&
      args.callerProfileId === args.ownerProfileId
  );
}
