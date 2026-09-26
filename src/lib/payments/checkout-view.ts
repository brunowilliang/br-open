import type {
  CheckoutCharge,
  PaymentChargeStatus,
} from "@convex/domains/payment/contract";
import {
  Alert02Icon,
  ArrowTurnBackwardIcon,
  BanIcon,
  CheckmarkCircle02Icon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";
import type { ButtonVariant } from "heroui-native";

import { getPaymentStatusMeta } from "./status";

const TERMINAL_CHARGE_STATUS: Record<PaymentChargeStatus, boolean> = {
  CANCELED: true,
  EXPIRED: true,
  FAILED: true,
  PAID: true,
  PENDING: false,
  REFUNDED: true,
};

export type CheckoutChargeView = {
  /** Ação do estado: rótulo, variante do botão e o kind que a tela mapeia. */
  action: {
    kind: "back" | "new-charge";
    label: string;
    variant: ButtonVariant;
  } | null;
  /** Texto que ACRESCENTA ao título (o que houve com o dinheiro ou com a vaga). */
  description: string;
  /** Ícone do estado, acima do título (composição do empty state). */
  icon: HugeiconsProps["icon"];
  severity: "danger" | "default" | "success" | "warning";
  title: string;
};

type CheckoutContextSignals = {
  /**
   * Obrigação VIGENTE do source: a charge PENDING do próprio chamador, ou
   * `null` sem PIX utilizável. Opcional: uma resposta em cache de um bundle
   * anterior não traz o campo e a tela mantém o comportamento anterior.
   */
  pendingCharge?: CheckoutCharge | null;
};

/**
 * `null` SÓ para `PENDING`: aí a tela mostra o layout de PIX/countdown. Com
 * `actionLabel` nulo nenhuma frase pode prometer ação (não há botão).
 */
export function buildCheckoutChargeView(input: {
  chargeStatus: PaymentChargeStatus;
}): CheckoutChargeView | null {
  if (!TERMINAL_CHARGE_STATUS[input.chargeStatus]) {
    return null;
  }

  // A cor do cartão vem da MESMA tabela do chip; `FAILED` (sem linha na tabela)
  // fica na severidade de erro.
  const severity =
    getPaymentStatusMeta(input.chargeStatus)?.severity ?? "danger";

  if (input.chargeStatus === "PAID") {
    return {
      action: { kind: "back", label: "Voltar", variant: "secondary" },
      description:
        "Sua inscrição está confirmada e a vaga é sua. Não precisa fazer mais nada.",
      icon: CheckmarkCircle02Icon,
      severity,
      title: "Pagamento confirmado!",
    };
  }

  if (input.chargeStatus === "EXPIRED") {
    return {
      action: {
        kind: "new-charge",
        label: "Gerar novo PIX",
        variant: "primary",
      },
      description:
        "O prazo terminou e a vaga não ficou reservada. Gere um novo código para concluir a inscrição.",
      icon: Timer01Icon,
      severity,
      title: "PIX expirado",
    };
  }

  // FAILED/REFUNDED/CANCELED: nunca o layout de PIX.
  if (input.chargeStatus === "FAILED") {
    return {
      action: null,
      description:
        "O PIX não foi aprovado e a vaga não ficou reservada. Você pode pagar de novo pela sua inscrição.",
      icon: Alert02Icon,
      severity,
      title: "Pagamento não concluído",
    };
  }

  // Cobrança cancelada não tem PIX vivo: aqui resta sair, sem prometer
  // pagamento.
  if (input.chargeStatus === "CANCELED") {
    return {
      action: { kind: "back", label: "Voltar", variant: "secondary" },
      description:
        "A inscrição foi encerrada e a vaga voltou para a categoria. Nenhum valor foi cobrado.",
      icon: BanIcon,
      severity,
      title: "PIX cancelado",
    };
  }

  return {
    action: { kind: "back", label: "Voltar", variant: "secondary" },
    description:
      "O valor voltou para a conta que fez o pagamento e a inscrição foi desfeita.",
    icon: ArrowTurnBackwardIcon,
    severity,
    title: "Pagamento reembolsado",
  };
}

/** Do `getCheckoutContext`: charge do link FLAT, vigente aninhada em `pendingCharge`. */
export type CheckoutDisplay = {
  /** Cartão terminal; `null` = layout de PIX/countdown da `charge`. */
  card: CheckoutChargeView | null;
  charge: CheckoutCharge;
  /** Estado EFETIVO da cobrança exibida (já resolve a vigente e o relógio local). */
  status: PaymentChargeStatus;
};

/**
 * A cobrança VIGENTE decide, não o status histórico da charge do link: a
 * `pendingCharge` PENDING (validada pelo SERVIDOR) vence e o relógio local não
 * a descarta — só a charge do link PENDING fora do prazo vira terminal.
 */
export function resolveCheckoutDisplay(input: {
  context: CheckoutCharge & CheckoutContextSignals;
  now: number;
}): CheckoutDisplay {
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
    card: buildCheckoutChargeView({ chargeStatus }),
    charge,
    status: chargeStatus,
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
