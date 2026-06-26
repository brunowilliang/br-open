import type { ApiOutputs } from "@convex/shared/api";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

/**
 * ============================================================================
 * CHALLENGE ROUTE VIEW — TAB & ACTION RULES
 * ============================================================================
 *
 * Esta é a fonte da verdade para quais desafios aparecem em cada aba e quais
 * ações de admin são visíveis por status.
 *
 * PRINCÍPIOS:
 *
 * 1. SETS DISJUNTOS POR ABA — cada status aparece em EXATAMENTE UMA aba,
 *    nunca em duas. Isso elimina a confusão de "abro o desafio aqui e ele
 *    aparece noutra aba". (Antes, pending_result_submission aparecia tanto
 *    em "Pendentes" quanto em "Ativos", gerando inconsistência.)
 *
 * 2. AÇÃO VISÍVEL = AÇÃO EXECUTÁVEL — toda ação de admin listada aqui tem um
 *    guard correspondente no backend (em convex/functions/league/challenges.ts,
 *    sets ADMIN_*_STATUSES). Se o backend rejeita um status, a ação NÃO pode
 *    ser visível. A tabela de mapeamento está documentada em cada set abaixo.
 *
 * 3. STATUS PODE SER DERIVADO — o status exibido pode diferir do status
 *    armazenado no DB (via computeEffectiveChallengeStatus). As mutations de
 *    admin chamam syncTimeDrivenChallengeStatus antes de validar, garantindo
 *    que o status usado aqui (derivado) é o mesmo aceito pelo backend.
 *
 * ----------------------------------------------------------------------------
 * TABELA: STATUS → ABA (ADMIN)
 * ----------------------------------------------------------------------------
 * pending_admin_challenge_validation → Atenção
 * pending_admin_result_validation     → Atenção
 * pending_admin_decision              → Atenção
 * pending_result_correction           → Atenção
 * pending_opponent_response           → Em andamento
 * pending_creator_reapproval          → Em andamento
 * confirmed                           → Em andamento
 * pending_cancellation_acceptance     → Em andamento
 * pending_result_submission           → Em andamento
 * pending_result_confirmation         → Em andamento
 * finished/declined/cancelled/invalidated → Histórico
 *
 * ----------------------------------------------------------------------------
 * TABELA: STATUS → ABA (PARTICIPANTE)
 * ----------------------------------------------------------------------------
 * A lógica do participante é por AÇÃO NECESSÁRIA do viewer, não só por status
 * (ver buildParticipantAttentionChallenges). Um mesmo status pode cair em
 * "Atenção" ou "Aguardando" dependendo do papel do viewer (ex.: em
 * pending_result_confirmation, quem NÃO publicou o placar precisa confirmar
 * → Atenção; quem publicou → Aguardando).
 * ============================================================================
 */

/**
 * Status fechados: o desafio terminou (com ou sem resultado). Sempre caem na
 * aba "Histórico" de qualquer role. Nenhuma ação de criação/edição de placar
 * é primária aqui (apenas reabertura, que é ação de admin).
 */
const CLOSED_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> = new Set(
  ["finished", "declined", "cancelled", "invalidated"] as const
);

/**
 * ABA "Atenção" (ADMIN) — desafios que requerem ação do organizador.
 *
 * Inclui correções (migradas da antiga aba "Correções"), pois é o admin quem
 * precisa agir sobre elas. Antes, pending_result_correction ficava isolado e
 * invisível (aba sem badge), causando desafios perdidos.
 *
 * Ações de admin válidas por status (todas com guard no backend):
 * - pending_admin_challenge_validation: approve/reject challenge
 * - pending_admin_result_validation: approve result, request correction,
 *   submit/edit result
 * - pending_admin_decision: submit result, request reminder
 * - pending_result_correction: submit/edit result
 * E, onde aplicável: invalidar, cancelar (ver ADMIN_* sets de ações).
 */
const ADMIN_ATTENTION_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> =
  new Set([
    "pending_admin_challenge_validation",
    "pending_admin_result_validation",
    "pending_admin_decision",
    "pending_result_correction",
  ] as const);

/**
 * ABA "Em andamento" (ADMIN) — desafios vivos onde os JOGADORES estão agindo
 * (propondo, confirmando, enviando placar). O admin apenas observa.
 *
 * Disjunto de ADMIN_ATTENTION: nenhum status aparece nas duas.
 */
const ADMIN_ONGOING_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> =
  new Set([
    "pending_opponent_response",
    "pending_creator_reapproval",
    "confirmed",
    "pending_cancellation_acceptance",
    "pending_result_submission",
    "pending_result_confirmation",
  ] as const);

/**
 * AÇÕES DE ADMIN — Status em que cada ação é permitida.
 *
 * IMPORTANTE: estes sets DEVEM espelhar os sets do backend
 * (ADMIN_CANCELABLE_STATUSES, ADMIN_INVALIDATABLE_STATUSES,
 * ADMIN_SCORE_EDITABLE_STATUSES, ADMIN_RESULT_REMINDER_STATUSES em
 * convex/functions/league/challenges.ts). Se mudar um, mude o outro.
 *
 * Observação sobre ranking já aplicado: em statuses finished/invalidated, o
 * ranking já foi computado. O adminSubmitResult do backend chama
 * restoreChallengeRankingSnapshot antes de reaplicar, então é seguro permitir
 * editar placar nesses estados.
 */
const ADMIN_CANCELABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "pending_admin_challenge_validation",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
] as const);

const ADMIN_INVALIDATABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
  "finished",
] as const);

const ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "confirmed",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
  "finished",
  "invalidated",
] as const);

const ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_decision",
] as const);

type ChallengeAdminActionItem = {
  latestResultSubmission?: { id?: string | null } | null;
  status: ChallengeItem["status"];
};

export type ChallengeAdminMenuActionId =
  | "admin_cancel"
  | "admin_invalidate"
  | "approve_challenge"
  | "approve_result"
  | "reject_challenge"
  | "reopen_challenge"
  | "reopen_result"
  | "request_result_correction"
  | "request_result_reminder"
  | "submit_result";

function isViewerChallenge(
  challenge: ChallengeItem,
  viewerPlayerProfileId: null | string
) {
  return (
    challenge.challenger.playerProfileId === viewerPlayerProfileId ||
    challenge.challenged.playerProfileId === viewerPlayerProfileId
  );
}

/**
 * Abas disponíveis. Unificadas entre admin e participante: ambos vêem
 * "Atenção", "Aguardando" (admin: "Em andamento") e "Histórico".
 * - Participante: incoming/outgoing foram removidos (não ajudavam a saber o
 *   que fazer; "Atenção/Aguardando" é orientado a ação).
 * - Admin: corrections foi removido (fundido em "Atenção", pois o admin é quem
 *   age sobre correções). pending virou "Atenção".
 */
export type ChallengeRouteTab = "active" | "attention" | "history" | "ongoing";

/**
 * Escolhe a aba inicial ao abrir a tela de desafios.
 *
 * - Admin: se há desafios precisando de atenção, abre em "Atenção" (urgência);
 *   senão em "Em andamento".
 * - Participante: sempre abre em "Atenção" (o que ele precisa fazer agora).
 */
export function buildChallengeRouteInitialTab(input: {
  canManage: boolean;
  pendingCount: number;
}): ChallengeRouteTab {
  if (input.canManage) {
    return input.pendingCount > 0 ? "attention" : "ongoing";
  }

  return "attention";
}

export function buildChallengeRouteVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  canManage: boolean;
  challenges: readonly ChallengeItem[];
  viewerPlayerProfileId: null | string;
}) {
  if (input.canManage) {
    return buildAdminVisibleChallenges(input);
  }

  return buildParticipantVisibleChallenges(input);
}

function buildAdminVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  challenges: readonly ChallengeItem[];
}) {
  switch (input.activeTab) {
    case "attention":
      return input.challenges.filter((challenge) =>
        ADMIN_ATTENTION_CHALLENGE_STATUSES.has(challenge.status)
      );
    case "ongoing":
      return input.challenges.filter((challenge) =>
        ADMIN_ONGOING_CHALLENGE_STATUSES.has(challenge.status)
      );
    case "history":
      return input.challenges.filter((challenge) =>
        CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter((challenge) =>
        ADMIN_ATTENTION_CHALLENGE_STATUSES.has(challenge.status)
      );
  }
}

function buildParticipantVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  challenges: readonly ChallengeItem[];
  viewerPlayerProfileId: null | string;
}) {
  switch (input.activeTab) {
    case "attention":
      return input.challenges.filter((challenge) =>
        isParticipantAttentionChallenge(challenge, input.viewerPlayerProfileId)
      );
    case "ongoing":
      // Desafios do viewer que estão vivos mas NÃO precisam da ação dele:
      // ele está esperando (o outro responder, o admin validar, o dia chegar).
      return input.challenges.filter(
        (challenge) =>
          isViewerChallenge(challenge, input.viewerPlayerProfileId) &&
          !CLOSED_CHALLENGE_STATUSES.has(challenge.status) &&
          !isParticipantAttentionChallenge(
            challenge,
            input.viewerPlayerProfileId
          )
      );
    case "history":
      return input.challenges.filter(
        (challenge) =>
          isViewerChallenge(challenge, input.viewerPlayerProfileId) &&
          CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter((challenge) =>
        isParticipantAttentionChallenge(challenge, input.viewerPlayerProfileId)
      );
  }
}

/**
 * Determina se um desafio requer a ATENÇÃO do participante (viewer).
 *
 * A regra combina status + papel do viewer, pois o mesmo status pode exigir
 * ação de um lado e não do outro (ex.: pending_result_confirmation — quem
 * NÃO publicou o placar precisa confirmar; quem publicou fica em "Aguardando").
 *
 * Não participante? Nunca é atenção (nem aparece para o participante).
 */
function isParticipantAttentionChallenge(
  challenge: ChallengeItem,
  viewerPlayerProfileId: null | string
) {
  if (!isViewerChallenge(challenge, viewerPlayerProfileId)) {
    return false;
  }

  switch (challenge.status) {
    case "pending_opponent_response":
      // O desafiado precisa responder à proposta.
      return challenge.challenged.playerProfileId === viewerPlayerProfileId;
    case "pending_creator_reapproval":
      // O desafiante precisa reaprovar a contraproposta.
      return challenge.challenger.playerProfileId === viewerPlayerProfileId;
    case "pending_cancellation_acceptance":
      // O lado que NÃO pediu o cancelamento precisa responder.
      return isViewerCancellationResponderByChallenge(
        challenge,
        viewerPlayerProfileId
      );
    case "pending_result_submission":
      // Jogo acabou, ninguém lançou — qualquer lado pode lançar.
      return true;
    case "pending_result_confirmation":
      // Quem NÃO publicou o placar precisa confirmar o do adversário.
      return isViewerResultConfirmer(challenge, viewerPlayerProfileId);
    case "pending_result_correction":
      // O admin pediu correção; o jogador que lançou precisa corrigir.
      return true;
    default:
      // Status de admin (validação/decisão), confirmed, e fechados não
      // requerem ação do participante.
      return false;
  }
}

function isViewerCancellationResponderByChallenge(
  challenge: ChallengeItem,
  viewerPlayerProfileId: null | string
) {
  if (!challenge.cancellationRequestedByMembershipId) {
    return false;
  }

  if (
    challenge.cancellationRequestedByMembershipId ===
    challenge.challenger.membershipId
  ) {
    return challenge.challenged.playerProfileId === viewerPlayerProfileId;
  }

  return challenge.challenger.playerProfileId === viewerPlayerProfileId;
}

function isViewerResultConfirmer(
  challenge: ChallengeItem,
  viewerPlayerProfileId: null | string
) {
  const submittedBy = challenge.latestResultSubmission?.submittedByMembershipId;

  if (!submittedBy) {
    return false;
  }

  let viewerMembershipId: string | null = null;

  if (challenge.challenger.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenger.membershipId;
  } else if (challenge.challenged.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenged.membershipId;
  }

  return Boolean(viewerMembershipId && viewerMembershipId !== submittedBy);
}

/**
 * Constrói a lista de IDs de ações de admin para um desafio.
 *
 * Cada ação é adicionada somente se o status permite, alinhado com os guards
 * do backend. As ações de perigo (invalidar/cancelar) são sempre empilhadas
 * ao final, mantendo a ordem: [ações neutras..., ações de perigo...].
 */
export function buildChallengeAdminMenuActionIds(
  challenge: ChallengeAdminActionItem
): ChallengeAdminMenuActionId[] {
  const actionIds: ChallengeAdminMenuActionId[] = [];
  const dangerActionIds: ChallengeAdminMenuActionId[] = [];
  const hasResult = Boolean(challenge.latestResultSubmission);

  // --- Ações específicas de validação (admin gate) ---

  if (challenge.status === "pending_admin_challenge_validation") {
    actionIds.push("approve_challenge", "reject_challenge");
  }

  // Resultado enviado e esperando validação do admin.
  if (
    challenge.status === "pending_admin_result_validation" &&
    challenge.latestResultSubmission
  ) {
    actionIds.push("approve_result", "request_result_correction");
  }

  // --- Ações de placar ---

  // Admin pode lançar/editar o placar em qualquer status editável.
  // (Inclui pending_admin_decision e pending_result_correction, que antes
  // estavam ausentes e geravam o bug de "só aparece cancelar".)
  if (ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    actionIds.push("submit_result");
  }

  // Admin pode cutucar os jogadores pra registrar o placar quando o jogo
  // ocorreu (ou passou do horário) sem placar.
  if (ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES.has(challenge.status)) {
    actionIds.push("request_result_reminder");
  }

  // --- Reaberturas (status fechados) ---

  if (["declined", "cancelled"].includes(challenge.status)) {
    actionIds.push("reopen_challenge");
  }

  if (challenge.status === "invalidated") {
    actionIds.push(hasResult ? "reopen_result" : "reopen_challenge");
  }

  if (challenge.status === "finished") {
    actionIds.push("reopen_result");
  }

  // --- Ações de perigo (sempre ao final) ---

  if (ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("admin_invalidate");
  }

  if (ADMIN_CANCELABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("admin_cancel");
  }

  return [...actionIds, ...dangerActionIds];
}

export function buildChallengeRouteEmptyState(input: {
  canManage: boolean;
  hasAnyChallenges: boolean;
}) {
  if (!input.hasAnyChallenges) {
    return {
      description: input.canManage
        ? "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui."
        : "Quando você abrir ou receber desafios, eles aparecerão aqui.",
      title: "Nenhum desafio encontrado",
    };
  }

  return {
    description: "Nenhum desafio corresponde ao filtro selecionado.",
    title: "Nada por aqui",
  };
}
