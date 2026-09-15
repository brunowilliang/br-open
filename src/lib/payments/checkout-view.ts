import type {
  CheckoutCharge,
  PaymentChargeStatus,
} from "@convex/domains/payment/contract";

import { formatShortDate } from "@/lib/format/date";
import { formatBrazilDueDayLabel } from "@/lib/payments/membership-due";

/**
 * Estados em que a charge não tem mais PIX utilizável: a partir daqui a tela
 * precisa olhar o estado ATUAL da membership, não o status histórico da charge
 * (BUG-0024: uma notificação antiga carrega o chargeId de uma charge já paga).
 */
const TERMINAL_CHARGE_STATUS: Record<PaymentChargeStatus, boolean> = {
  EXPIRED: true,
  FAILED: true,
  PAID: true,
  PENDING: false,
  REFUNDED: true,
};

export type CheckoutChargeView = {
  /** Label do CTA da tela; null quando não há ação a oferecer. */
  actionLabel: null | string;
  /** Texto sem travessão no estilo dos cartões de checkout existentes. */
  description: string;
  /** Semântica do cartão (cor do título e do fundo). */
  severity: "danger" | "success" | "warning";
  title: string;
};

type CheckoutContextSignals = {
  canRenew?: boolean | null;
  membershipDueAt?: number | null;
  membershipStatus?: string | null;
  /**
   * Obrigação VIGENTE do source (IBX-0041): a charge PENDING do próprio
   * chamador, ou `null` quando não há PIX utilizável. Opcional como os demais
   * campos do contrato: uma resposta em cache de um bundle anterior não traz o
   * campo e a tela mantém o comportamento anterior.
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
 * Traduz o contexto do checkout nos sinais que o cartão consome.
 *
 * A fonte é o `canRenew` do próprio contexto (estado VIVO da membership,
 * IBX-0040); o `canRegenerate` de "meus pagamentos" fica só como fallback para
 * uma resposta em cache que ainda não traga o campo, e nesse intervalo a tela
 * mantém o comportamento anterior em vez de regredir.
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
 * Cartão da tela de checkout quando a charge está em estado terminal.
 *
 * - Ainda dá para renovar (`canRenew`: membership em atraso, suspensa ou
 *   `active` dentro da janela de lembrete) → NADA de "Pagamento confirmado":
 *   o cabeçalho vem do estado da membership e o CTA gera a cobrança nova.
 * - `PAID` sem renovação → pagamento de fato liquidado, cartão de sucesso
 *   (com "Aguardando a aprovação do organizador." quando a membership ficou
 *   `pending` por aprovação manual).
 * - Charge terminal sem cobrança possível e membership `active`, ou seja, em
 *   dia com o período já pago → cartão da INSCRIÇÃO (com o vencimento), sem
 *   ação: um link histórico de mensalidade já paga não pode virar "PIX
 *   expirado" (BUG-0025).
 * - Demais estados terminais → cartão sem ação, nunca o layout de PIX (não
 *   existe cobrança utilizável para mostrar).
 *
 * Invariante: `actionLabel` nulo significa que NENHUMA frase do cartão pode
 * prometer uma ação ("Gere um novo PIX"), porque não há botão para executá-la.
 *
 * Devolve `null` apenas para `PENDING`: aí sim a tela mostra o layout de
 * PIX/countdown com a cobrança que está valendo.
 *
 * `membershipStatus`/`membershipDueAt` chegam pelo `getCheckoutContext`
 * (contrato aditivo); sem eles o cabeçalho da renovação fica genérico, mas
 * nunca afirma um pagamento que não aconteceu.
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

  // Inscrição em dia: `active` sem cobrança possível é a membership cujo
  // período já está pago e cujo vencimento ainda está fora da janela de
  // renovação. A charge do link é história (a notificação antiga continua
  // apontando para ela), então o cartão fala da inscrição e não promete PIX
  // nenhum: sem este ramo, quem reabre a notificação depois de pagar via
  // "PIX expirado" com um "gere um novo PIX" que não tem botão (BUG-0025).
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

  // FAILED/REFUNDED fora da renovação: mesmo cartão sem ação do ramo EXPIRED.
  // Antes caíam no layout de PIX, que renderizava QR e "Expira em 00:00" de uma
  // cobrança que não existe mais.
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

/**
 * Cobrança que a tela mostra: o `getCheckoutContext` devolve a projeção
 * `checkoutChargeSchema` FLAT para a charge do link e aninhada em
 * `pendingCharge` para a obrigação vigente do source (IBX-0041).
 */
export type CheckoutDisplay = {
  /** Cartão terminal; `null` = layout de PIX/countdown da `charge`. */
  card: CheckoutChargeView | null;
  /** Cobrança cujo PIX a tela mostra (e cujo vencimento o countdown conta). */
  charge: CheckoutCharge;
};

/**
 * O que a tela mostra, decidido pela cobrança VIGENTE e não pelo status
 * histórico da charge que o link trouxe.
 *
 * Uma notificação antiga (renovação, PIX expirado) carrega o chargeId de uma
 * charge já terminal; quando o jogador já gerou o PIX novo, a obrigação
 * vigente vive em OUTRA charge PENDING do MESMO source e é ela que tem de
 * aparecer, com o copia-e-cola, o QR e a contagem dela (BUG-0025).
 *
 * - `pendingCharge` PENDING do contexto → PIX dela, sem cartão. Ela vem
 *   validada pelo SERVIDOR (`hasUsablePix`), então o relógio do aparelho não a
 *   descarta: com o aparelho adiantado, esconder esse PIX cairia num cartão que
 *   promete um PIX novo e um `createCharge` que devolve a MESMA charge. O
 *   countdown zerado pede UMA revalidação, e aí sim o servidor decide
 *   (`resolveCountdownRevalidation`).
 * - Sem `pendingCharge` → comportamento anterior: a charge do link decide,
 *   com cartão terminal e o CTA de gerar PIX quando `canRenew`.
 * - Charge do link PENDING fora do prazo do aparelho (o cron ainda não marcou)
 *   → cartão terminal, como se já fosse `EXPIRED`. Esta é a única charge que o
 *   relógio local rebaixa: é um payload em cache que pode estar velho.
 *
 * `Date.parse` de `null` (ou de um valor ilegível) é `NaN`, e `NaN > now` é
 * falso: prazo ausente conta como vencido, nunca como PIX vivo.
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
 * Guarda da revalidação por countdown: quando o countdown da cobrança EXIBIDA
 * zera, quem decide o próximo estado é o SERVIDOR, com UMA leitura por charge
 * (sem loop). Com o aparelho adiantado o payload do servidor continua sendo a
 * última palavra; e um payload em cache cujo PIX já morreu no servidor cai, na
 * resposta seguinte, no cartão terminal.
 *
 * `displayedChargeId` é `null` quando a tela não está mostrando PIX (cartão
 * terminal ou carregando): aí não há countdown para estourar. Devolve o id que
 * a tela deve guardar como já revalidado, mais a decisão de revalidar agora.
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
