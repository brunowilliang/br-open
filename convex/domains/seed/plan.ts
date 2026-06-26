type SeedPlanInput = {
  createScenarioLeagues?: boolean;
  targetLeagueId?: string;
};

type ExistingRankingMembership = {
  rankingPosition?: null | number;
};

type TargetLeagueMembership<UserId> = {
  rankingPosition: null | number;
  status: "active" | "pending" | "rejected";
  userId: UserId;
};

type TargetLeagueChallengeStatus =
  | "confirmed"
  | "finished"
  | "pending_admin_decision"
  | "pending_admin_result_validation"
  | "pending_opponent_response"
  | "pending_result_confirmation"
  | "pending_result_submission";

type TargetLeagueChallengeMembership<MembershipId> = {
  id: MembershipId;
  rankingPosition?: null | number;
};

type TargetLeagueChallengeParticipant<MembershipId> = {
  id: MembershipId;
  rankingPosition: number;
};

type TargetLeagueChallengeResultSide = "challenged" | "challenger";

type TargetLeagueChallengeScenario = {
  challengedIndex: number;
  challengerIndex: number;
  dayOffset: number;
  endMinute: number;
  key: string;
  result?: {
    confirmedBy?: TargetLeagueChallengeResultSide;
    submittedBy: TargetLeagueChallengeResultSide;
    winner: TargetLeagueChallengeResultSide;
  };
  resultValidationMode?: "automatic" | "manual";
  startMinute: number;
  status: TargetLeagueChallengeStatus;
};

export type TargetLeagueChallengePlan<MembershipId> = {
  challenged: TargetLeagueChallengeParticipant<MembershipId>;
  challenger: TargetLeagueChallengeParticipant<MembershipId>;
  dayOffset: number;
  endMinute: number;
  key: string;
  result?: {
    confirmedBy?: TargetLeagueChallengeResultSide;
    submittedBy: TargetLeagueChallengeResultSide;
    winner: TargetLeagueChallengeResultSide;
  };
  resultValidationMode?: "automatic" | "manual";
  startMinute: number;
  status: TargetLeagueChallengeStatus;
};

const TARGET_ACTIVE_USER_INDEXES = [
  0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 16, 17,
] as const;
const TARGET_PENDING_USER_INDEXES = [6, 7, 8, 18] as const;
const TARGET_REJECTED_USER_INDEXES = [9, 19] as const;
const TARGET_CHALLENGE_SCENARIOS = [
  {
    challengedIndex: 1,
    challengerIndex: 3,
    dayOffset: 2,
    endMinute: 630,
    key: "opponent-response",
    startMinute: 540,
    status: "pending_opponent_response",
  },
  {
    challengedIndex: 5,
    challengerIndex: 7,
    dayOffset: 3,
    endMinute: 750,
    key: "confirmed",
    startMinute: 660,
    status: "confirmed",
  },
  {
    challengedIndex: 6,
    challengerIndex: 9,
    dayOffset: -1,
    endMinute: 810,
    key: "result-submission",
    startMinute: 720,
    status: "pending_result_submission",
  },
  {
    challengedIndex: 8,
    challengerIndex: 11,
    dayOffset: -2,
    endMinute: 870,
    key: "result-confirmation",
    result: {
      submittedBy: "challenger",
      winner: "challenger",
    },
    startMinute: 780,
    status: "pending_result_confirmation",
  },
  {
    challengedIndex: 2,
    challengerIndex: 4,
    dayOffset: -3,
    endMinute: 930,
    key: "admin-result-validation",
    result: {
      confirmedBy: "challenged",
      submittedBy: "challenger",
      winner: "challenger",
    },
    resultValidationMode: "manual",
    startMinute: 840,
    status: "pending_admin_result_validation",
  },
  {
    challengedIndex: 10,
    challengerIndex: 13,
    dayOffset: -4,
    endMinute: 990,
    key: "admin-decision",
    startMinute: 900,
    status: "pending_admin_decision",
  },
  {
    challengedIndex: 10,
    challengerIndex: 12,
    dayOffset: -7,
    endMinute: 1050,
    key: "finished",
    result: {
      confirmedBy: "challenged",
      submittedBy: "challenger",
      winner: "challenged",
    },
    startMinute: 960,
    status: "finished",
  },
  // ---- Agendas de teste: desafios confirmados espalhados por 7 dias ----
  // Hoje (offset 0): manhã, tarde e noite.
  {
    challengedIndex: 0,
    challengerIndex: 2,
    dayOffset: 0,
    endMinute: 510,
    key: "schedule-today-morning-1",
    startMinute: 420,
    status: "confirmed",
  },
  {
    challengedIndex: 3,
    challengerIndex: 6,
    dayOffset: 0,
    endMinute: 630,
    key: "schedule-today-morning-2",
    startMinute: 540,
    status: "confirmed",
  },
  {
    challengedIndex: 1,
    challengerIndex: 5,
    dayOffset: 0,
    endMinute: 810,
    key: "schedule-today-afternoon-1",
    startMinute: 720,
    status: "confirmed",
  },
  {
    challengedIndex: 4,
    challengerIndex: 8,
    dayOffset: 0,
    endMinute: 960,
    key: "schedule-today-evening-1",
    startMinute: 870,
    status: "confirmed",
  },
  // Amanhã (offset 1): manhã e tarde.
  {
    challengedIndex: 2,
    challengerIndex: 7,
    dayOffset: 1,
    endMinute: 480,
    key: "schedule-tomorrow-morning-1",
    startMinute: 390,
    status: "confirmed",
  },
  {
    challengedIndex: 5,
    challengerIndex: 9,
    dayOffset: 1,
    endMinute: 780,
    key: "schedule-tomorrow-afternoon-1",
    startMinute: 690,
    status: "confirmed",
  },
  {
    challengedIndex: 6,
    challengerIndex: 11,
    dayOffset: 1,
    endMinute: 1080,
    key: "schedule-tomorrow-evening-1",
    startMinute: 990,
    status: "confirmed",
  },
  // +2 dias: tarde.
  {
    challengedIndex: 7,
    challengerIndex: 10,
    dayOffset: 2,
    endMinute: 750,
    key: "schedule-day2-afternoon-1",
    startMinute: 660,
    status: "confirmed",
  },
  {
    challengedIndex: 0,
    challengerIndex: 4,
    dayOffset: 2,
    endMinute: 1140,
    key: "schedule-day2-evening-1",
    startMinute: 1050,
    status: "confirmed",
  },
  // +3 dias: manhã.
  {
    challengedIndex: 1,
    challengerIndex: 8,
    dayOffset: 3,
    endMinute: 540,
    key: "schedule-day3-morning-1",
    startMinute: 450,
    status: "confirmed",
  },
  // +4 dias: tarde e noite.
  {
    challengedIndex: 3,
    challengerIndex: 12,
    dayOffset: 4,
    endMinute: 840,
    key: "schedule-day4-afternoon-1",
    startMinute: 750,
    status: "confirmed",
  },
  {
    challengedIndex: 9,
    challengerIndex: 13,
    dayOffset: 4,
    endMinute: 1170,
    key: "schedule-day4-evening-1",
    startMinute: 1080,
    status: "confirmed",
  },
  // +5 dias: manhã.
  {
    challengedIndex: 2,
    challengerIndex: 10,
    dayOffset: 5,
    endMinute: 570,
    key: "schedule-day5-morning-1",
    startMinute: 480,
    status: "confirmed",
  },
  // +6 dias: tarde.
  {
    challengedIndex: 4,
    challengerIndex: 11,
    dayOffset: 6,
    endMinute: 900,
    key: "schedule-day6-afternoon-1",
    startMinute: 810,
    status: "confirmed",
  },
] satisfies TargetLeagueChallengeScenario[];

function buildActiveMemberships<UserId>(
  userIds: UserId[],
  userIndexes: readonly number[],
  startingPosition: number
): TargetLeagueMembership<UserId>[] {
  return userIndexes.map((userIndex, index) => ({
    rankingPosition: startingPosition + index,
    status: "active",
    userId: userIds[userIndex]!,
  }));
}

function buildInactiveMemberships<UserId>(
  userIds: UserId[],
  userIndexes: readonly number[],
  status: "pending" | "rejected"
): TargetLeagueMembership<UserId>[] {
  return userIndexes.map((userIndex) => ({
    rankingPosition: null,
    status,
    userId: userIds[userIndex]!,
  }));
}

export function shouldSeedScenarioLeagues(input: SeedPlanInput) {
  return input.createScenarioLeagues === true;
}

export function getNextTargetLeagueRankingPosition(
  activeMemberships: ExistingRankingMembership[]
) {
  return (
    activeMemberships.reduce(
      (highestPosition, membership) =>
        Math.max(highestPosition, membership.rankingPosition ?? 0),
      0
    ) + 1
  );
}

export function buildTargetLeagueMemberships<UserId>(input: {
  startingPosition: number;
  userIds: UserId[];
}) {
  return [
    ...buildActiveMemberships(
      input.userIds,
      TARGET_ACTIVE_USER_INDEXES,
      input.startingPosition
    ),
    ...buildInactiveMemberships(
      input.userIds,
      TARGET_PENDING_USER_INDEXES,
      "pending"
    ),
    ...buildInactiveMemberships(
      input.userIds,
      TARGET_REJECTED_USER_INDEXES,
      "rejected"
    ),
  ];
}

export function buildTargetLeagueChallengePlans<MembershipId>(input: {
  activeMemberships: TargetLeagueChallengeMembership<MembershipId>[];
}): TargetLeagueChallengePlan<MembershipId>[] {
  const sortedMemberships = input.activeMemberships
    .filter(
      (
        membership
      ): membership is TargetLeagueChallengeParticipant<MembershipId> =>
        typeof membership.rankingPosition === "number"
    )
    .toSorted((left, right) => left.rankingPosition - right.rankingPosition);

  if (sortedMemberships.length < 14) {
    return [];
  }

  return TARGET_CHALLENGE_SCENARIOS.map((scenario) => ({
    challenged: sortedMemberships[scenario.challengedIndex]!,
    challenger: sortedMemberships[scenario.challengerIndex]!,
    dayOffset: scenario.dayOffset,
    endMinute: scenario.endMinute,
    key: scenario.key,
    result: scenario.result,
    resultValidationMode: scenario.resultValidationMode,
    startMinute: scenario.startMinute,
    status: scenario.status,
  }));
}
