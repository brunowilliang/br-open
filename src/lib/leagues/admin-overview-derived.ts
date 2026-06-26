import type { ApiOutputs } from "@convex/shared/api";

import {
  ADMIN_ATTENTION_STATUSES,
  ADMIN_ONGOING_STATUSES,
} from "./challenge-tab-counts";

export type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type ChallengeStatus = ChallengeItem["status"];

export type MembershipOverview =
  ApiOutputs["league"]["membership"]["getOverview"];

// ----- Alerts -----

export type AdminJoinRequestsAlert = { total: number };

export type AdminPendingActionKind =
  | "challenge_validation"
  | "decision"
  | "result_approval"
  | "result_correction";

export type AdminPendingAction = { kind: AdminPendingActionKind };

export type AdminValidationsAlert = {
  actions: AdminPendingAction[];
  total: number;
};

const ATTENTION_STATUS_TO_KIND: Record<
  Extract<
    ChallengeStatus,
    | "pending_admin_challenge_validation"
    | "pending_admin_result_validation"
    | "pending_admin_decision"
    | "pending_result_correction"
  >,
  AdminPendingActionKind
> = {
  pending_admin_challenge_validation: "challenge_validation",
  pending_admin_result_validation: "result_approval",
  pending_admin_decision: "decision",
  pending_result_correction: "result_correction",
};

export function buildAdminJoinRequestsAlert(input: {
  pendingRequestsCount: number;
}): AdminJoinRequestsAlert | null {
  if (input.pendingRequestsCount <= 0) {
    return null;
  }

  return { total: input.pendingRequestsCount };
}

export function buildAdminValidationsAlert(input: {
  challenges: ChallengeItem[];
}): AdminValidationsAlert | null {
  const actions: AdminPendingAction[] = [];

  for (const challenge of input.challenges) {
    const kind =
      ATTENTION_STATUS_TO_KIND[
        challenge.status as keyof typeof ATTENTION_STATUS_TO_KIND
      ];

    if (kind) {
      actions.push({ kind });
    }
  }

  if (actions.length === 0) {
    return null;
  }

  return { actions, total: actions.length };
}

const KIND_LABEL: Record<
  AdminPendingActionKind,
  { many: string; one: string }
> = {
  challenge_validation: {
    many: "desafios para validar",
    one: "desafio para validar",
  },
  result_approval: {
    many: "resultados para aprovar",
    one: "resultado para aprovar",
  },
  decision: { many: "disputas para decidir", one: "disputa para decidir" },
  result_correction: {
    many: "placares para corrigir",
    one: "placar para corrigir",
  },
};

// Ordem estável para o resumo, independente da ordem dos status no input.
const SUMMARY_ORDER: AdminPendingActionKind[] = [
  "challenge_validation",
  "result_approval",
  "decision",
  "result_correction",
];

export function summarizeAdminPendingActions(
  actions: AdminPendingAction[]
): string {
  const counts: Record<AdminPendingActionKind, number> = {
    challenge_validation: 0,
    decision: 0,
    result_approval: 0,
    result_correction: 0,
  };

  for (const action of actions) {
    counts[action.kind] += 1;
  }

  const parts: string[] = [];

  for (const kind of SUMMARY_ORDER) {
    const count = counts[kind];
    if (count === 0) {
      continue;
    }
    const label = count === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many;
    parts.push(`${count} ${label}`);
  }

  return parts.join(" · ");
}

// Re-export para o componente poder importar os conjuntos de um único lugar.
export { ADMIN_ATTENTION_STATUSES, ADMIN_ONGOING_STATUSES };

// ----- Metric cards -----

export type AdminOccupationCard = {
  activeCount: number;
  label: string;
};

export type AdminMonthlyMatchesCard = { finishedCount: number };

export type AdminOngoingChallengesCard = { ongoingCount: number };

export type AdminActivityRateCard = { activeCount: number; rate: number };

function getMonthStartMs(now: number) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.getTime();
}

export function buildAdminOccupationCard(input: {
  activeCount: number;
  maxPlayers: null | number;
}): AdminOccupationCard {
  if (input.maxPlayers === null) {
    return { activeCount: input.activeCount, label: "vagas ilimitadas" };
  }

  const remaining = input.maxPlayers - input.activeCount;

  if (remaining <= 0) {
    return { activeCount: input.activeCount, label: "Liga lotada" };
  }

  return {
    activeCount: input.activeCount,
    label: `${remaining} vagas restantes`,
  };
}

export function buildAdminMonthlyMatchesCard(input: {
  challenges: ChallengeItem[];
  now: number;
}): AdminMonthlyMatchesCard {
  const monthStart = getMonthStartMs(input.now);

  const finishedCount = input.challenges.filter((challenge) => {
    if (challenge.status !== "finished") {
      return false;
    }
    return (
      challenge.finishedAt !== null &&
      challenge.finishedAt !== undefined &&
      challenge.finishedAt >= monthStart
    );
  }).length;

  return { finishedCount };
}

export function buildAdminOngoingChallengesCard(input: {
  challenges: ChallengeItem[];
}): AdminOngoingChallengesCard {
  const ongoingCount = input.challenges.filter((challenge) =>
    ADMIN_ONGOING_STATUSES.has(challenge.status)
  ).length;

  return { ongoingCount };
}

export function buildAdminActivityRateCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ranking: MembershipOverview["ranking"];
}): AdminActivityRateCard {
  const activeCount = input.ranking.length;

  if (activeCount === 0) {
    return { activeCount: 0, rate: 0 };
  }

  const activeMembershipIds = new Set(input.ranking.map((member) => member.id));
  const monthStart = getMonthStartMs(input.now);
  const playedThisMonth = new Set<string>();

  for (const challenge of input.challenges) {
    if (challenge.status !== "finished") {
      continue;
    }
    if (
      challenge.finishedAt === null ||
      challenge.finishedAt === undefined ||
      challenge.finishedAt < monthStart
    ) {
      continue;
    }

    const challengerId = challenge.challenger.membershipId;
    const challengedId = challenge.challenged.membershipId;

    if (challengerId && activeMembershipIds.has(challengerId)) {
      playedThisMonth.add(challengerId);
    }
    if (challengedId && activeMembershipIds.has(challengedId)) {
      playedThisMonth.add(challengedId);
    }
  }

  const rate = playedThisMonth.size / activeCount;

  return { activeCount, rate: Math.min(1, rate) };
}
