import type { PaymentChargeStatus } from "./contract";
import { CHARGE_STATUS_PAID } from "./rules";

/** `status: CANCELED` e local e imediato; so o provedor CONFIRMA que o PIX
 * morreu — qualquer outra resposta mantem `failed` para o sweep re-tentar, e
 * pagamento que apareca vai para estorno. */

/** Provedor respondeu `null`/nao encontrada, ou nao deu para perguntar. */
export const PROVIDER_PROBE_NOT_FOUND = "not_found" as const;
export const PROVIDER_PROBE_UNREACHABLE = "unreachable" as const;

export type CancelProbeStatus =
  | typeof PROVIDER_PROBE_NOT_FOUND
  | typeof PROVIDER_PROBE_UNREACHABLE
  | PaymentChargeStatus;

/** O que soubemos do provedor sobre a cobranca cancelada. */
export type ProviderCancelProbe =
  /** DELETE aceito pela Woovi: o PIX nao existe mais. */
  | { kind: "deleted" }
  /** O provedor respondeu que a cobranca NAO EXISTE la. */
  | { kind: "missing" }
  /** O provedor respondeu que a cobranca esta PAGA: entrou dinheiro. */
  | { kind: "paid" }
  /** Provedor recusou e a cobranca segue viva la, ou nao deu para saber. */
  | { kind: "unconfirmed" };

export type ChargeCancellationOutcome = "canceled" | "failed" | "late_payment";

export function resolveChargeCancellationOutcome(
  probe: ProviderCancelProbe
): ChargeCancellationOutcome {
  if (probe.kind === "deleted" || probe.kind === "missing") {
    return "canceled";
  }

  return probe.kind === "paid" ? "late_payment" : "failed";
}

/** Traduz o desfecho do comando no provedor num probe: so `deleted`/`not_found`
 * confirmam o cancelamento, e so `PAID` e dinheiro que entrou. */
export function toProviderCancelProbe(args: {
  deleted: boolean;
  providerStatus: CancelProbeStatus;
}): ProviderCancelProbe {
  if (args.deleted) {
    return { kind: "deleted" };
  }
  if (args.providerStatus === PROVIDER_PROBE_NOT_FOUND) {
    return { kind: "missing" };
  }
  return args.providerStatus === CHARGE_STATUS_PAID
    ? { kind: "paid" }
    : { kind: "unconfirmed" };
}
