import {
  ORGANIZER_ATTENTION_CHALLENGE_STATUSES,
  type LeagueChallengeStatus,
} from "./challenge-status";
import type { PendingItem } from "../pendings/contract";
import {
  buildPendingItemId,
  countNoun,
  openRouteAction,
  pendingHighlight,
} from "../pendings/pendings-rules";
import { MS_PER_DAY } from "../payment/rules";

// ---------------------------------------------------------------------------
// Pendencias do dominio de LIGA (IBX-0076)
// ---------------------------------------------------------------------------
//
// Regras PURAS (dado -> item, sem ctx). Copy literal da galeria aprovada:
// cartao 8 (jogador: desafios que pedem acao DELE), 9 (risco de inatividade),
// 13 (organizador: solicitacoes de entrada) e 14 (organizador: desafios
// esperando a validacao DELE).
//
// A fonte unica de QUEM deve a acao por status continua sendo o servidor:
// `challenge-status.ts` (sets de atencao) + `resolvePlayerChallengePendingActionKind`
// abaixo, que e o espelho do `resolvePendingAction` que a casa da liga do
// jogador usava no cliente (`src/lib/leagues/player-overview-derived.ts`) e da
// regra de receptor de proposta (`functions/league/_challenges/proposals.ts`).
// O status considerado e o EFETIVO (derivado por tempo, `computeEffectiveChallengeStatus`):
// um `confirmed` cujo horario passou sem placar ja conta como pendencia de
// resultado, exatamente como a lista que a tela recebe.

/**
 * Status em que o JOGADOR deve o resultado — o conjunto que o alerta do
 * jogador conta (mesmos tres tipos de `buildPlayerPendingActionsAlert`).
 */
export const PLAYER_CHALLENGE_PENDING_ACTION_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_result_submission",
    "pending_result_confirmation",
    "pending_result_correction",
  ]);

/**
 * Status de origem cujo EFETIVO pode virar pendencia de resultado por passagem
 * de tempo (jogo agendado cujo fim ja passou e ninguem lancou placar).
 */
export const PLAYER_CHALLENGE_PENDING_ACTION_DRIFT_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>(["confirmed"]);

/**
 * Os quatro status do set de atencao do ORGANIZADOR, partidos nas duas linhas
 * aprovadas na galeria (cartao 14): resultado a validar x proposta a decidir.
 * Juntos formam EXATAMENTE `ORGANIZER_ATTENTION_CHALLENGE_STATUSES` — a
 * paridade e teste (`tests/pendings-rules.test.ts`).
 */
export const ORGANIZER_ATTENTION_VALIDATION_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_organizer_result_validation",
    "pending_result_correction",
  ]);

export const ORGANIZER_ATTENTION_PROPOSAL_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_organizer_challenge_validation",
    "pending_organizer_decision",
  ]);

/** Status a varrer no escopo da organizacao (atencao + origens que derivam por tempo). */
export const ORGANIZER_ATTENTION_SCAN_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    ...ORGANIZER_ATTENTION_CHALLENGE_STATUSES,
    "confirmed",
    "pending_opponent_response",
    "pending_creator_reapproval",
  ]);

export type PlayerChallengePendingActionKind =
  | "confirm_result"
  | "register_result"
  | "request_correction";

/**
 * O que o VIEWER (dono da membership) precisa fazer neste desafio — a fonte
 * unica da pendencia de resultado do jogador. `null` = nada a fazer (ele
 * publicou e so aguarda, ou o status nao pede acao dele).
 */
export function resolvePlayerChallengePendingActionKind(input: {
  status: string;
  submittedByMembershipId: null | string;
  viewerMembershipId: string;
}): PlayerChallengePendingActionKind | null {
  switch (input.status) {
    case "pending_result_submission":
      return "register_result";
    case "pending_result_confirmation":
      return input.submittedByMembershipId === input.viewerMembershipId
        ? null
        : "confirm_result";
    case "pending_result_correction":
      return "request_correction";
    default:
      return null;
  }
}

export type PlayerChallengePendingCounts = {
  confirmResult: number;
  registerResult: number;
  requestCorrection: number;
};

/**
 * Pendencia agregada dos desafios que pedem a acao do jogador (cartao 8): UMA
 * linha por tipo, na ordem da tela real (registrar, confirmar, corrigir), com
 * o destaque na EXPRESSAO da pendencia (`2 resultados`), nunca no numero solto.
 * Titulo e CTA sao os da tela/cartao aprovados.
 */
export function buildPlayerChallengePendingItem(input: {
  counts: PlayerChallengePendingCounts;
  leagueId: string;
}): PendingItem | null {
  const total =
    input.counts.registerResult +
    input.counts.confirmResult +
    input.counts.requestCorrection;

  if (total === 0) {
    return null;
  }

  const lines: { parts: { isHighlighted?: boolean; text: string }[] }[] = [];

  if (input.counts.registerResult > 0) {
    lines.push({
      parts: [
        pendingHighlight(
          countNoun(input.counts.registerResult, "resultado", "resultados")
        ),
        { text: " para registrar" },
      ],
    });
  }

  if (input.counts.confirmResult > 0) {
    lines.push({
      parts: [
        pendingHighlight(
          countNoun(input.counts.confirmResult, "resultado", "resultados")
        ),
        { text: " para confirmar" },
      ],
    });
  }

  if (input.counts.requestCorrection > 0) {
    lines.push({
      parts: [
        pendingHighlight(
          countNoun(input.counts.requestCorrection, "resultado", "resultados")
        ),
        { text: " para corrigir" },
      ],
    });
  }

  return {
    action: openRouteAction(),
    actionLabel: "Ver",
    count: total,
    deadlineAt: null,
    description: lines,
    domain: "league",
    id: buildPendingItemId(
      "player_league_challenges_pending_actions",
      input.leagueId
    ),
    kind: "player_league_challenges_pending_actions",
    moneyCents: null,
    params: { leagueId: input.leagueId },
    route: "/leagues/[leagueId]/challenges",
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: input.leagueId, type: "league" },
    title: countNoun(
      total,
      "desafio precisando de atenção",
      "desafios precisando de atenção"
    ),
  };
}

/**
 * Pendencia agregada dos desafios que esperam a validacao do ORGANIZADOR
 * (cartao 14), somando as ligas dele: uma linha de resultados a validar e uma
 * de propostas a decidir. Sem CTA (a decisao acontece na tela do desafio, que
 * ainda nao tem destino unico a partir do alerta) e sem rota — por isso o item
 * e da ORGANIZACAO, nao de uma liga.
 */
export function buildOrganizerChallengePendingItem(input: {
  organizationId: string;
  proposals: number;
  results: number;
}): PendingItem | null {
  const total = input.results + input.proposals;

  if (total === 0) {
    return null;
  }

  const lines: { parts: { isHighlighted?: boolean; text: string }[] }[] = [];

  if (input.results > 0) {
    lines.push({
      parts: [
        pendingHighlight(countNoun(input.results, "resultado", "resultados")),
        { text: " para validar" },
      ],
    });
  }

  if (input.proposals > 0) {
    lines.push({
      parts: [
        pendingHighlight(countNoun(input.proposals, "proposta", "propostas")),
        { text: " para decidir" },
      ],
    });
  }

  return {
    action: null,
    actionLabel: null,
    count: total,
    deadlineAt: null,
    description: lines,
    domain: "league",
    id: buildPendingItemId(
      "organization_league_challenges_awaiting_validation",
      input.organizationId
    ),
    kind: "organization_league_challenges_awaiting_validation",
    moneyCents: null,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: input.organizationId, type: "organization" },
    title: countNoun(
      total,
      "desafio esperando sua validação",
      "desafios esperando sua validação"
    ),
  };
}

/** Solicitacoes de entrada de UMA liga (cartao 13) — `null` com zero. */
export function buildLeagueJoinRequestsPending(input: {
  count: number;
  leagueId: string;
}): PendingItem | null {
  if (input.count <= 0) {
    return null;
  }

  return {
    action: openRouteAction(),
    actionLabel: "Revisar",
    count: input.count,
    deadlineAt: null,
    description: "Jogadores esperando aprovação para entrar na liga.",
    domain: "league",
    id: buildPendingItemId("organization_league_join_requests", input.leagueId),
    kind: "organization_league_join_requests",
    moneyCents: null,
    params: { leagueId: input.leagueId },
    route: "/leagues/[leagueId]/requests",
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: input.leagueId, type: "league" },
    title: countNoun(
      input.count,
      "solicitação de entrada",
      "solicitações de entrada"
    ),
  };
}

export type LeagueInactivityRisk = {
  daysSinceLastMatch: number;
  daysUntilPenalty: number;
  /** Instante EXATO em que a penalidade cai (`null` sem partida registrada). */
  penaltyAtMs: null | number;
  severity: "danger" | "warning";
};

/**
 * Janela em que o risco de inatividade vira alerta: mesma janela do app
 * (`WARNING_WINDOW_DAYS` em `src/lib/leagues/player-overview-derived.ts`).
 */
export const INACTIVITY_WARNING_WINDOW_DAYS = 7;

/**
 * Risco de inatividade do membro (cartao 9): a liga precisa aplicar a
 * penalidade, o membro precisa ter uma membership e a folga tem de estar na
 * janela. `daysSinceLastMatch` conta a partir da ultima partida FINALIZADA ou,
 * sem nenhuma, de zero (mesma leitura do app: sem historico, o relogio comeca
 * agora).
 */
export function resolveLeagueInactivityRisk(input: {
  hasInactivityPenalty: boolean;
  inactivityPenaltyDays: null | number;
  lastMatchAtMs: null | number;
  nowMs: number;
}): LeagueInactivityRisk | null {
  if (!input.hasInactivityPenalty) {
    return null;
  }

  const penaltyDays = input.inactivityPenaltyDays ?? 0;

  if (penaltyDays <= 0) {
    return null;
  }

  const daysSinceLastMatch =
    input.lastMatchAtMs === null
      ? 0
      : Math.floor((input.nowMs - input.lastMatchAtMs) / MS_PER_DAY);
  const daysUntilPenalty = penaltyDays - daysSinceLastMatch;

  if (daysUntilPenalty > INACTIVITY_WARNING_WINDOW_DAYS) {
    return null;
  }

  return {
    daysSinceLastMatch,
    daysUntilPenalty,
    penaltyAtMs:
      input.lastMatchAtMs === null
        ? null
        : input.lastMatchAtMs + penaltyDays * MS_PER_DAY,
    severity: daysUntilPenalty <= 0 ? "danger" : "warning",
  };
}

/**
 * Pendencia de risco de inatividade (cartao 9) a partir do risco ja resolvido:
 * warning pede atencao ("Faltam N dias"), danger e o prazo estourado ("Voce
 * esta inativo"). O destaque da variante warning vai no prazo; a danger nao tem
 * destaque (copy real da tela, frase unica).
 */
export function buildLeagueInactivityPending(input: {
  membershipId: string;
  risk: LeagueInactivityRisk;
}): PendingItem {
  return {
    action: null,
    actionLabel: null,
    count: null,
    deadlineAt: input.risk.penaltyAtMs,
    description:
      input.risk.severity === "danger"
        ? `Já se passaram ${countNoun(input.risk.daysSinceLastMatch, "dia", "dias")} desde sua última partida.`
        : [
            {
              parts: [
                { text: "Faltam " },
                pendingHighlight(
                  countNoun(input.risk.daysUntilPenalty, "dia", "dias")
                ),
                { text: " para você cair no ranking." },
              ],
            },
          ],
    domain: "league",
    id: buildPendingItemId("player_league_inactivity_risk", input.membershipId),
    kind: "player_league_inactivity_risk",
    moneyCents: null,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: input.risk.severity,
    source: { id: input.membershipId, type: "league_membership" },
    title:
      input.risk.severity === "danger"
        ? "Você está inativo"
        : "Risco de queda por inatividade",
  };
}
