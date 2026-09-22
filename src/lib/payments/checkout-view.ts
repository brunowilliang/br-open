import type {
  CheckoutCharge,
  PaymentChargeStatus,
} from "@convex/domains/payment/contract";

import { formatShortDate } from "@/lib/format/date";
import { formatBrazilDueDayLabel } from "@/lib/payments/membership-due";

const TERMINAL_CHARGE_STATUS: Record<PaymentChargeStatus, boolean> = {
  EXPIRED: true,
  FAILED: true,
  PAID: true,
  PENDING: false,
  REFUNDED: true,
};

export type CheckoutChargeView = {
  actionLabel: null | string;
  /** Texto sem travessão no estilo dos cartões de checkout existentes. */
  description: string;
  severity: "danger" | "success" | "warning";
  title: string;
};

type CheckoutContextSignals = {
  canRenew?: boolean | null;
  membershipDueAt?: number | null;
  membershipStatus?: string | null;
  /**
   * Obrigação VIGENTE do source: a charge PENDING do próprio chamador, ou
   * `null` sem PIX utilizável. Opcional: uma resposta em cache de um bundle
   * anterior não traz o campo e a tela mantém o comportamento anterior.
   */
  pendingCharge?: CheckoutCharge | null;
  sourceType: string;
};

export type CheckoutRenewSignals = {
  canRenew: boolean;
  membershipDueAt: null | number;
  membershipStatus: null | string;
};

/**
 * O `canRenew` do contexto (estado VIVO da membership) manda; o `canRegenerate`
 * de "meus pagamentos" fica só como fallback para uma resposta em cache que
 * ainda não traga o campo.
 */
export function resolveCheckoutRenewSignals(input: {
  context: CheckoutContextSignals;
  paymentItem?: { canRegenerate: boolean } | undefined;
}): CheckoutRenewSignals {
  const canRenew =
    input.context.sourceType === "league_membership" &&
    (input.context.canRenew ?? input.paymentItem?.canRegenerate ?? false);

  return {
    canRenew,
    membershipDueAt: input.context.membershipDueAt ?? null,
    membershipStatus: input.context.membershipStatus ?? null,
  };
}

/**
 * `null` SÓ para `PENDING`: aí a tela mostra o layout de PIX/countdown. Com
 * `actionLabel` nulo nenhuma frase pode prometer ação (não há botão), e charge
 * terminal com a membership `active` vira cartão da INSCRIÇÃO, nunca de PIX.
 */
export function buildCheckoutChargeView(input: {
  canRenew: boolean;
  chargePaidAt?: null | string;
  chargeStatus: PaymentChargeStatus;
  membershipDueAt?: null | number;
  membershipStatus?: null | string;
  now: number;
}): CheckoutChargeView | null {
  if (!TERMINAL_CHARGE_STATUS[input.chargeStatus]) {
    return null;
  }

  if (input.canRenew) {
    let title = "Renove a sua mensalidade";

    if (input.membershipStatus === "payment_due") {
      title = "Mensalidade em atraso";
    } else if (input.membershipStatus === "suspended") {
      title = "Inscrição suspensa";
    } else if (input.membershipStatus === "active" && input.membershipDueAt) {
      title = `Sua mensalidade vence ${formatBrazilDueDayLabel(
        input.membershipDueAt,
        input.now
      )}`;
    }

    let description =
      "Esse pagamento não foi concluído. Gere um novo PIX para continuar.";

    if (input.chargeStatus === "PAID") {
      description = input.chargePaidAt
        ? `Último pagamento em ${formatShortDate(
            new Date(input.chargePaidAt)
          )}. Gere um novo PIX para continuar jogando.`
        : "Gere um novo PIX para continuar jogando.";
    } else if (input.chargeStatus === "EXPIRED") {
      description =
        "O tempo para pagamento esgotou. Gere um novo PIX para continuar.";
    }

    return {
      actionLabel: "Gerar novo Pix",
      description,
      severity: input.membershipStatus === "suspended" ? "danger" : "warning",
      title,
    };
  }

  if (input.chargeStatus === "PAID") {
    // Liga com aprovação manual: o pagamento leva a membership para `pending`
    // até o organizador aprovar, então a frase de acesso não pode ser afirmada.
    return {
      actionLabel: null,
      description:
        input.membershipStatus === "pending"
          ? "Aguardando a aprovação do organizador."
          : "Confirmamos o seu pagamento. Você já pode acessar a liga e começar a jogar!",
      severity: "success",
      title: "Pagamento confirmado!",
    };
  }

  // `active` sem cobrança possível: a charge do link é história (a notificação
  // antiga aponta para ela), então o cartão fala da inscrição e não promete PIX.
  if (input.membershipStatus === "active") {
    return {
      actionLabel: null,
      description: "Você não tem nenhuma cobrança pendente nessa liga.",
      severity: "success",
      title: input.membershipDueAt
        ? `Sua mensalidade vence ${formatBrazilDueDayLabel(
            input.membershipDueAt,
            input.now
          )}`
        : "Sua mensalidade está em dia",
    };
  }

  if (input.chargeStatus === "EXPIRED") {
    return {
      actionLabel: null,
      description: "O tempo para pagamento esgotou.",
      severity: "warning",
      title: "PIX expirado",
    };
  }

  // FAILED/REFUNDED fora da renovação: cartão sem ação, nunca o layout de PIX.
  if (input.chargeStatus === "FAILED") {
    return {
      actionLabel: null,
      description: "O PIX não foi aprovado.",
      severity: "warning",
      title: "Pagamento não concluído",
    };
  }

  return {
    actionLabel: null,
    description: "O valor foi devolvido.",
    severity: "warning",
    title: "Pagamento reembolsado",
  };
}

/** Do `getCheckoutContext`: charge do link FLAT, vigente aninhada em `pendingCharge`. */
export type CheckoutDisplay = {
  /** Cartão terminal; `null` = layout de PIX/countdown da `charge`. */
  card: CheckoutChargeView | null;
  charge: CheckoutCharge;
};

/**
 * A cobrança VIGENTE decide, não o status histórico da charge do link: a
 * `pendingCharge` PENDING (validada pelo SERVIDOR) vence e o relógio local não
 * a descarta — só a charge do link PENDING fora do prazo vira terminal.
 */
export function resolveCheckoutDisplay(input: {
  context: CheckoutCharge & CheckoutContextSignals;
  now: number;
  paymentItem?: { canRegenerate: boolean; paidAt?: null | string } | undefined;
}): CheckoutDisplay {
  const signals = resolveCheckoutRenewSignals({
    context: input.context,
    paymentItem: input.paymentItem,
  });

  const { pendingCharge } = input.context;
  const livePendingCharge =
    pendingCharge?.status === "PENDING" ? pendingCharge : null;
  const charge = livePendingCharge ?? input.context;

  // O cron pode ainda não ter marcado a charge do link que estourou no aparelho.
  const chargeStatus =
    !livePendingCharge &&
    charge.status === "PENDING" &&
    !(Date.parse(charge.expiresAt ?? "") > input.now)
      ? "EXPIRED"
      : charge.status;

  return {
    card: buildCheckoutChargeView({
      canRenew: signals.canRenew,
      chargePaidAt: input.paymentItem?.paidAt ?? null,
      chargeStatus,
      membershipDueAt: signals.membershipDueAt,
      membershipStatus: signals.membershipStatus,
      now: input.now,
    }),
    charge,
  };
}

/**
 * Quando o countdown da cobrança EXIBIDA zera, quem decide é o SERVIDOR, com
 * UMA leitura por charge (sem loop). `displayedChargeId` nulo = tela sem PIX
 * (cartão terminal ou carregando), logo sem countdown para estourar.
 */
export function resolveCountdownRevalidation(input: {
  displayedChargeId: null | string;
  remainingMs: number;
  revalidatedChargeId: null | string;
}): { chargeId: null | string; shouldRefetch: boolean } {
  if (!input.displayedChargeId) {
    return { chargeId: null, shouldRefetch: false };
  }

  if (
    input.remainingMs > 0 ||
    input.displayedChargeId === input.revalidatedChargeId
  ) {
    return { chargeId: input.revalidatedChargeId, shouldRefetch: false };
  }

  return { chargeId: input.displayedChargeId, shouldRefetch: true };
}
