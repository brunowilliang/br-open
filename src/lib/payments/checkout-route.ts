import type { Href } from "expo-router";

/**
 * Segmento de `chargeId` que abre o checkout ANTES de existir cobrança: a tela
 * cria (ou reusa) a cobrança do source e só então vira a rota da charge real.
 * Nunca colide com id do Convex (que não tem hífen/palavra reservada).
 */
export const NEW_CHARGE_PARAM = "new";

export type CheckoutRoute =
  /** Deep link normal: a cobrança já existe e a tela só a re-exibe. */
  | { chargeId: string; kind: "charge" }
  /** Sem cobrança ainda: `sourceId`/`sourceType` dizem de quem criá-la. */
  | { kind: "create"; sourceId: string; sourceType: string }
  /** `new` sem source (link digitado à mão): não há cobrança a resolver. */
  | { kind: "invalid" };

type RawParam = string | string[] | undefined;

/** Os três params desta rota têm o mesmo shape do expo-router (string | lista). */
function readRouteParam(value: RawParam): null | string {
  const single = Array.isArray(value) ? value[0] : value;

  return single ? single : null;
}

/**
 * A entrada do checkout é sempre a rota: `chargeId` manda quando existe; o
 * sentinela `new` só vale acompanhado do source que o servidor sabe cobrar.
 */
export function parseCheckoutRoute(input: {
  chargeId?: RawParam;
  sourceId?: RawParam;
  sourceType?: RawParam;
}): CheckoutRoute {
  const chargeId = readRouteParam(input.chargeId);

  if (chargeId !== NEW_CHARGE_PARAM) {
    return chargeId ? { chargeId, kind: "charge" } : { kind: "invalid" };
  }

  const sourceId = readRouteParam(input.sourceId);
  const sourceType = readRouteParam(input.sourceType);

  return sourceId && sourceType
    ? { kind: "create", sourceId, sourceType }
    : { kind: "invalid" };
}

/**
 * Href do checkout sem cobrança: o toque navega na hora e quem cria a cobrança é
 * a própria tela (o POST à Woovi não pode segurar a transição).
 */
export function buildNewChargeCheckoutHref(input: {
  sourceId: string;
  sourceType: string;
}): Href {
  return {
    params: {
      chargeId: NEW_CHARGE_PARAM,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    },
    pathname: "/checkout/[chargeId]",
  } as unknown as Href;
}
