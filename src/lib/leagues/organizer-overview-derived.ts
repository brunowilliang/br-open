import type { ApiOutputs } from "@convex/shared/api";

import { getMonthStartMs } from "@/lib/format/date";
import {
  ORGANIZER_ATTENTION_STATUSES,
  ORGANIZER_ONGOING_STATUSES,
} from "./challenge-tab-counts";

export type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type ChallengeStatus = ChallengeItem["status"];

export type MembershipOverview =
  ApiOutputs["league"]["membership"]["getOverview"];

// ----- Alerts -----

export type OrganizerJoinRequestsAlert = { total: number };

export type OrganizerPendingActionKind =
  | "challenge_validation"
  | "decision"
  | "result_approval"
  | "result_correction";

export type OrganizerPendingAction = { kind: OrganizerPendingActionKind };

export type OrganizerValidationsAlert = {
  actions: OrganizerPendingAction[];
  total: number;
};

const ATTENTION_STATUS_TO_KIND: Record<
  Extract<
    ChallengeStatus,
    | "pending_organizer_challenge_validation"
    | "pending_organizer_result_validation"
    | "pending_organizer_decision"
    | "pending_result_correction"
  >,
  OrganizerPendingActionKind
> = {
  pending_organizer_challenge_validation: "challenge_validation",
  pending_organizer_decision: "decision",
  pending_organizer_result_validation: "result_approval",
  pending_result_correction: "result_correction",
};

export function buildOrganizerJoinRequestsAlert(input: {
  pendingRequestsCount: number;
}): OrganizerJoinRequestsAlert | null {
  if (input.pendingRequestsCount <= 0) {
    return null;
  }

  return { total: input.pendingRequestsCount };
}

export function buildOrganizerValidationsAlert(input: {
  challenges: ChallengeItem[];
}): OrganizerValidationsAlert | null {
  const actions: OrganizerPendingAction[] = [];

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
  OrganizerPendingActionKind,
  { many: string; one: string }
> = {
  challenge_validation: {
    many: "desafios para validar",
    one: "desafio para validar",
  },
  decision: { many: "disputas para decidir", one: "disputa para decidir" },
  result_approval: {
    many: "resultados para aprovar",
    one: "resultado para aprovar",
  },
  result_correction: {
    many: "placares para corrigir",
    one: "placar para corrigir",
  },
};

// Ordem estável para o resumo, independente da ordem dos status no input.
const SUMMARY_ORDER: OrganizerPendingActionKind[] = [
  "challenge_validation",
  "result_approval",
  "decision",
  "result_correction",
];

export function summarizeOrganizerPendingActions(
  actions: OrganizerPendingAction[]
): string {
  const counts: Record<OrganizerPendingActionKind, number> = {
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
export { ORGANIZER_ATTENTION_STATUSES, ORGANIZER_ONGOING_STATUSES };

// ----- Metric cards -----

export type OrganizerOccupationCard = {
  activeCount: number;
  label: string;
};

export type OrganizerMonthlyMatchesCard = { finishedCount: number };

export type OrganizerOngoingChallengesCard = { ongoingCount: number };

export type OrganizerActivityRateCard = { activeCount: number; rate: number };

export function buildOrganizerOccupationCard(input: {
  activeCount: number;
  maxPlayers: null | number;
}): OrganizerOccupationCard {
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

export function buildOrganizerMonthlyMatchesCard(input: {
  challenges: ChallengeItem[];
  now: number;
}): OrganizerMonthlyMatchesCard {
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

export function buildOrganizerOngoingChallengesCard(input: {
  challenges: ChallengeItem[];
}): OrganizerOngoingChallengesCard {
  const ongoingCount = input.challenges.filter((challenge) =>
    ORGANIZER_ONGOING_STATUSES.has(challenge.status)
  ).length;

  return { ongoingCount };
}

export function buildOrganizerActivityRateCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ranking: MembershipOverview["ranking"];
}): OrganizerActivityRateCard {
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
