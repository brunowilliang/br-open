import { LEAGUE_MEMBERSHIP_STATUSES } from "../league/contract";
import type { PendingItem } from "../pendings/contract";
import {
  buildPendingItemId,
  openRouteAction,
  pendingHighlight,
} from "../pendings/pendings-rules";
import {
  BRAZIL_UTC_OFFSET_MS,
  renewalDaysLeft,
  shouldSendRenewalReminder,
} from "./rules";

// ---------------------------------------------------------------------------
// Pendencias do dominio de PAGAMENTO (IBX-0076)
// ---------------------------------------------------------------------------
//
// Regras PURAS (dado -> item, sem ctx). A copy e literal da galeria aprovada
// (`AlertsVariantsSection`, cartoes 1, 2, 3 e 10) — que por sua vez veio do
// builder real do app (`src/lib/leagues/league-details-derived.ts`), com o CTA
// reduzido a UMA palavra pela regra aprovada.
//
// O vinculo mensalidade -> vencimento e o do dominio (`membershipDueMsFromCharge`
// em `./membership-billing.ts`): quem chama resolve o `dueAtMs` e passa aqui.

/**
 * Rotulo pt-BR do vencimento no CALENDARIO DO BRASIL (UTC-3), sem ICU: a
 * mensagem do servidor tem de sair identica ao que o app mostrava com
 * `Intl.DateTimeFormat` no aparelho — "23 de set. de 2026".
 */
const BRAZIL_MONTH_ABBREVIATIONS = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

function formatBrazilShortDate(ms: number) {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  return `${shifted.getUTCDate()} de ${BRAZIL_MONTH_ABBREVIATIONS[shifted.getUTCMonth()]} de ${shifted.getUTCFullYear()}`;
}

/**
 * Dias que faltam para o vencimento no calendario do Brasil: "hoje", "amanha"
 * ou "em N dias" — mesma conta e mesmo texto do app
 * (`src/lib/payments/membership-due.ts`, sobre `renewalDaysLeft`).
 */
function formatBrazilDueDayLabel(dueAtMs: number, nowMs: number) {
  const daysLeft = renewalDaysLeft({ nextDueMs: dueAtMs, nowMs });

  if (daysLeft <= 0) {
    return "hoje";
  }

  if (daysLeft === 1) {
    return "amanhã";
  }

  return `em ${daysLeft} dias`;
}

export type MembershipPaymentPendingInput = {
  dueAtMs: null | number;
  /** `LeagueMembershipStatus` da inscricao do jogador na liga. */
  membershipStatus: string;
  membershipId: string;
  monthlyPriceCents: null | number;
  nowMs: number;
  reminderDaysBefore: number;
};

/**
 * Pendencia de pagamento da MENSALIDADE da liga (cartoes 1, 2 e 3): atrasada
 * (`payment_due`, warning), a vencer dentro da janela de lembrete da liga
 * (`active`, warning) e suspensa por falta de pagamento (`suspended`, danger).
 * `null` nos demais status (a liga gratis nao gera pendencia de pagamento).
 */
export function buildMembershipPaymentPending(
  input: MembershipPaymentPendingInput
): PendingItem | null {
  const base = {
    action: { params: null, type: "pay_league_membership" as const },
    count: null,
    domain: "payment" as const,
    moneyCents: input.monthlyPriceCents,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    source: { id: input.membershipId, type: "league_membership" as const },
  };

  if (input.membershipStatus === LEAGUE_MEMBERSHIP_STATUSES.PAYMENT_DUE) {
    return {
      ...base,
      actionLabel: "Pagar",
      deadlineAt: input.dueAtMs,
      description:
        "O pagamento da sua mensalidade venceu. Pague para não ser suspenso.",
      id: buildPendingItemId(
        "player_league_membership_payment_due",
        input.membershipId
      ),
      kind: "player_league_membership_payment_due",
      severity: "warning",
      title: "Pagamento atrasado",
    };
  }

  if (input.membershipStatus === LEAGUE_MEMBERSHIP_STATUSES.SUSPENDED) {
    // O CTA vive no PROPRIO item (decisao de 21-09, IBX-0084): o MESMO item e
    // renderizado pelo `PendingAlerts` em 6 superficies e so a CASA da liga tem
    // rodape de entrada — na home o alerta era beco sem saida (a copy manda
    // renovar sem afordancia). `Renovar` e a MESMA acao dos kinds 1 e 2
    // (`canMembershipBeCharged` aceita `suspended`), entao nao nasce caminho de
    // pagamento novo. O motivo do BUG-0042 (dois botoes de pagamento para a
    // mesma membership na MESMA tela) segue valendo e passa a ser resolvido do
    // lado da TELA: a casa da liga nao renderiza mais o pagamento no rodape.
    return {
      ...base,
      actionLabel: "Renovar",
      deadlineAt: input.dueAtMs,
      description:
        "Sua inscrição foi suspensa por falta de pagamento. Renove para voltar a jogar.",
      id: buildPendingItemId(
        "player_league_membership_suspended",
        input.membershipId
      ),
      kind: "player_league_membership_suspended",
      severity: "danger",
      title: "Inscrição suspensa",
    };
  }

  if (
    input.membershipStatus !== LEAGUE_MEMBERSHIP_STATUSES.ACTIVE ||
    input.dueAtMs === null
  ) {
    return null;
  }

  // Janela de lembrete da liga: a MESMA regra do lembrete de renovacao
  // (`shouldSendRenewalReminder`), que e o corte por duracao do builder do app
  // (vencimento no futuro e a no maximo `reminderDaysBefore` dias).
  if (
    !shouldSendRenewalReminder({
      nextDueMs: input.dueAtMs,
      nowMs: input.nowMs,
      reminderDaysBefore: input.reminderDaysBefore,
    })
  ) {
    return null;
  }

  return {
    ...base,
    actionLabel: "Renovar",
    deadlineAt: input.dueAtMs,
    description: [
      {
        parts: [
          { text: "Renove até " },
          pendingHighlight(formatBrazilShortDate(input.dueAtMs)),
          { text: " para continuar jogando sem interrupção." },
        ],
      },
    ],
    id: buildPendingItemId(
      "player_league_membership_payment_due_soon",
      input.membershipId
    ),
    kind: "player_league_membership_payment_due_soon",
    severity: "warning",
    title: `Mensalidade vence ${formatBrazilDueDayLabel(input.dueAtMs, input.nowMs)}`,
  };
}

/**
 * Pendencia da CONTA DE PAGAMENTO da organizacao (cartao 10): a liga paga que
 * nao consegue cobrar porque a conta Woovi da organizacao nao esta ativa. A
 * regra real exige liga com mensalidade (`hasPaidPrice`) — quem chama so passa
 * ligas com preco; o CTA leva aos ajustes DAQUELA liga, onde a conexao vive.
 */
export function buildLeaguePaymentAccountPending(input: {
  leagueId: string;
  monthlyPriceCents: null | number;
}): PendingItem {
  return {
    action: openRouteAction(),
    actionLabel: "Conectar",
    count: null,
    deadlineAt: null,
    description:
      "Conecte a conta para os jogadores conseguirem pagar a mensalidade.",
    domain: "payment",
    id: buildPendingItemId(
      "organization_league_payment_account_missing",
      input.leagueId
    ),
    kind: "organization_league_payment_account_missing",
    moneyCents: input.monthlyPriceCents,
    params: { leagueId: input.leagueId, mode: "edit" },
    route: "/settings/leagues/[mode]/settings",
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: input.leagueId, type: "league" },
    title: "Conta de pagamento não conectada",
  };
}
