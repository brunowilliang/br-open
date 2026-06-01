import { z } from "zod";

import {
  enumField,
  requiredNumber,
  requiredString,
} from "../../utils/contract.zod";

export const LeagueVisibilityOptions = [
  "public",
  "private",
  "invite_only",
] as const;

export const LeagueWinBehaviorOptions = [
  "take_opponent_position",
  "climb_one_position",
] as const;

export const LeagueLossBehaviorOptions = [
  "stay_put",
  "drop_one_position",
] as const;

export const LeagueWalkoverBehaviorOptions = [
  "automatic_loss",
  "automatic_loss_and_move_to_end",
  "cancel_challenge",
] as const;

export const LeagueNewPlayerPlacementOptions = ["end_of_ranking"] as const;

export const LeagueInactivityPenaltyTypeOptions = [
  "drop_one_position",
  "move_to_ranking_end",
] as const;

export const LeagueChallengeValidationModeOptions = [
  "automatic",
  "manual",
] as const;

export const LeagueResultValidationModeOptions = [
  "automatic",
  "manual",
] as const;

export const DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE = "automatic" as const;
export const DEFAULT_LEAGUE_RESULT_VALIDATION_MODE = "automatic" as const;

export const LeagueScoringModeOptions = ["advantage", "no_ad"] as const;

export const LeagueFinalSetModeOptions = [
  "same_as_previous",
  "custom_set",
  "super_tiebreak",
] as const;

export const LeagueMembershipStatusOptions = [
  "pending",
  "active",
  "rejected",
  "removed",
  "left",
  "suspended",
] as const;

export const LeagueChallengeStatusOptions = [
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
  "finished",
  "declined",
  "cancelled",
  "invalidated",
] as const;

export const LeagueChallengeProposalStatusOptions = [
  "active",
  "accepted",
  "replaced",
  "declined",
  "cancelled",
] as const;

export const LeagueChallengeScoreSetKindOptions = [
  "set",
  "super_tiebreak",
] as const;

export const LeagueChallengeResultReviewActionOptions = [
  "approved",
  "correction_requested",
  "invalidated",
] as const;

export const LeagueChallengeAdminActionOptions = [
  "cancel",
  "invalidate",
  "reopen_challenge",
  "reopen_result",
] as const;

export const LeagueCourtDayKeys = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

const THIRTY_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_LEAGUE_MATCH_CONFIG = {
  bestOfSets: 3,
  defaultDurationMinutes: 90,
  finalSetGamesPerSet: 6,
  finalSetHasTieBreak: true,
  finalSetMode: "same_as_previous",
  finalSetMustWinByTwoGames: true,
  finalSetScoringMode: "advantage",
  finalSetSuperTieBreakMustWinByTwo: true,
  finalSetSuperTieBreakPoints: 10,
  finalSetTieBreakAtGamesAll: 6,
  finalSetTieBreakMustWinByTwo: true,
  finalSetTieBreakPoints: 7,
  gamesPerSet: 6,
  hasTieBreak: true,
  scoringMode: "advantage",
  setMustWinByTwoGames: true,
  tieBreakAtGamesAll: 6,
  tieBreakMustWinByTwo: true,
  tieBreakPoints: 7,
} as const;

type LeagueCourtDayKey = (typeof LeagueCourtDayKeys)[number];
type LeagueCourtRangeValue = {
  endMinute: number;
  startMinute: number;
};

function createEmptyLeagueCourtAvailability() {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  } satisfies Record<LeagueCourtDayKey, LeagueCourtRangeValue[]>;
}

export const EMPTY_LEAGUE_COURT_AVAILABILITY =
  createEmptyLeagueCourtAvailability();

function hasOverlap(ranges: LeagueCourtRangeValue[]) {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startMinute - right.startMinute
  );

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previousRange = sortedRanges[index - 1];
    const currentRange = sortedRanges[index];

    if (currentRange.startMinute < previousRange.endMinute) {
      return true;
    }
  }

  return false;
}

const LeagueCourtRangeSchema = z
  .object({
    startMinute: z
      .number({
        error: "Informe um horário inicial válido.",
      })
      .int("Informe um horário inicial válido.")
      .min(0, "Informe um horário inicial válido.")
      .max(MINUTES_PER_DAY, "Informe um horário inicial válido."),
    endMinute: z
      .number({
        error: "Informe um horário final válido.",
      })
      .int("Informe um horário final válido.")
      .min(0, "Informe um horário final válido.")
      .max(MINUTES_PER_DAY, "Informe um horário final válido."),
  })
  .superRefine((value, ctx) => {
    if (value.startMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["startMinute"],
      });
    }

    if (value.endMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["endMinute"],
      });
    }

    if (value.startMinute >= value.endMinute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O horário inicial deve ser menor que o horário final.",
        path: ["endMinute"],
      });
    }
  });

const LeagueCourtAvailabilitySchema = z
  .object({
    mon: z.array(LeagueCourtRangeSchema),
    tue: z.array(LeagueCourtRangeSchema),
    wed: z.array(LeagueCourtRangeSchema),
    thu: z.array(LeagueCourtRangeSchema),
    fri: z.array(LeagueCourtRangeSchema),
    sat: z.array(LeagueCourtRangeSchema),
    sun: z.array(LeagueCourtRangeSchema),
  })
  .superRefine((value, ctx) => {
    for (const dayKey of LeagueCourtDayKeys) {
      const dayRanges = value[dayKey];

      if (!hasOverlap(dayRanges)) {
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários não podem se sobrepor no mesmo dia.",
        path: [dayKey],
      });
    }
  });

export const LeagueCourtSchema = z.object({
  id: z.string().min(1, "Quadra inválida."),
  name: requiredString("Informe o nome da quadra.").pipe(
    z.string().trim().min(1, "Informe o nome da quadra.")
  ),
  availability: LeagueCourtAvailabilitySchema,
});

export const LeagueCourtsSchema = z
  .array(LeagueCourtSchema)
  .superRefine((value, ctx) => {
    const seenCourtNames = new Map<string, number>();

    for (const [index, court] of value.entries()) {
      const normalizedName = court.name.trim().toLocaleLowerCase("pt-BR");

      if (!normalizedName) {
        continue;
      }

      const previousIndex = seenCourtNames.get(normalizedName);

      if (previousIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Já existe uma quadra com esse nome.",
          path: [index, "name"],
        });
        continue;
      }

      seenCourtNames.set(normalizedName, index);
    }
  });

export const LeagueMatchConfigSchema = z.object({
  bestOfSets: requiredNumber(
    "Informe quantos sets a partida pode ter.",
    "Informe uma quantidade de sets valida."
  ).min(1, "Informe uma quantidade de sets valida."),
  gamesPerSet: requiredNumber(
    "Informe quantos games cada set deve ter.",
    "Informe uma quantidade de games valida."
  ).min(1, "Informe uma quantidade de games valida."),
  defaultDurationMinutes: requiredNumber(
    "Informe a duracao padrao da partida.",
    "Informe uma duracao valida."
  ).min(1, "Informe uma duracao valida."),
  scoringMode: z.enum(LeagueScoringModeOptions),
  setMustWinByTwoGames: z.boolean(),
  hasTieBreak: z.boolean(),
  tieBreakAtGamesAll: requiredNumber(
    "Informe em qual placar o tie-break comeca.",
    "Informe um placar de tie-break valido."
  ).min(1, "Informe um placar de tie-break valido."),
  tieBreakPoints: requiredNumber(
    "Informe quantos pontos o tie-break deve ter.",
    "Informe uma pontuacao de tie-break valida."
  ).min(1, "Informe uma pontuacao de tie-break valida."),
  tieBreakMustWinByTwo: z.boolean(),
  finalSetMode: z.enum(LeagueFinalSetModeOptions),
  finalSetGamesPerSet: requiredNumber(
    "Informe quantos games o ultimo set deve ter.",
    "Informe uma quantidade de games valida para o ultimo set."
  ).min(1, "Informe uma quantidade de games valida para o ultimo set."),
  finalSetScoringMode: z.enum(LeagueScoringModeOptions),
  finalSetMustWinByTwoGames: z.boolean(),
  finalSetHasTieBreak: z.boolean(),
  finalSetTieBreakAtGamesAll: requiredNumber(
    "Informe em qual placar o tie-break do ultimo set comeca.",
    "Informe um placar de tie-break valido para o ultimo set."
  ).min(1, "Informe um placar de tie-break valido para o ultimo set."),
  finalSetTieBreakPoints: requiredNumber(
    "Informe quantos pontos o tie-break do ultimo set deve ter.",
    "Informe uma pontuacao de tie-break valida para o ultimo set."
  ).min(1, "Informe uma pontuacao de tie-break valida para o ultimo set."),
  finalSetTieBreakMustWinByTwo: z.boolean(),
  finalSetSuperTieBreakPoints: requiredNumber(
    "Informe quantos pontos o super tie-break deve ter.",
    "Informe uma pontuacao valida para o super tie-break."
  ).min(1, "Informe uma pontuacao valida para o super tie-break."),
  finalSetSuperTieBreakMustWinByTwo: z.boolean(),
});

export const ChallengeRuleConfigSchema = z
  .object({
    maxChallengeDistance: requiredNumber(
      "Informe a distancia maxima do desafio.",
      "Informe uma distancia maxima valida."
    ),
    maxActiveChallengesPerPlayer: requiredNumber(
      "Informe o limite de desafios ativos por jogador.",
      "Informe um limite de desafios ativos valido."
    ),
    maxChallengesPerMonth: requiredNumber(
      "Informe o limite mensal de desafios.",
      "Informe um limite mensal de desafios valido."
    ),
    responseDeadlineHours: requiredNumber(
      "Informe o prazo de resposta em horas.",
      "Informe um prazo de resposta valido."
    ),
    winBehavior: z.enum(LeagueWinBehaviorOptions),
    lossBehavior: z.enum(LeagueLossBehaviorOptions),
    walkoverBehavior: z.enum(LeagueWalkoverBehaviorOptions),
    newPlayerPlacement: z.enum(LeagueNewPlayerPlacementOptions),
    challengeValidationMode: z.enum(LeagueChallengeValidationModeOptions),
    resultValidationMode: z.enum(LeagueResultValidationModeOptions),
    matchConfig: LeagueMatchConfigSchema.default(
      DEFAULT_LEAGUE_MATCH_CONFIG
    ).catch(DEFAULT_LEAGUE_MATCH_CONFIG),
    hasInactivityPenalty: z.boolean(),
    inactivityPenaltyType: z
      .enum(LeagueInactivityPenaltyTypeOptions)
      .optional(),
    inactivityPenaltyDays: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.hasInactivityPenalty) {
      if (!value.inactivityPenaltyType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a penalidade por inatividade.",
          path: ["inactivityPenaltyType"],
        });
      }

      if (!value.inactivityPenaltyDays) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe em quantos dias a penalidade começa a valer.",
          path: ["inactivityPenaltyDays"],
        });
      }

      return;
    }

    if (value.inactivityPenaltyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Remova a penalidade por inatividade quando ela estiver desativada.",
        path: ["inactivityPenaltyType"],
      });
    }

    if (value.inactivityPenaltyDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Remova os dias de inatividade quando a penalidade estiver desativada.",
        path: ["inactivityPenaltyDays"],
      });
    }
  });

export const DEFAULT_LEAGUE_MODE = "challenges" as const;

export const DEFAULT_LEAGUE_STORAGE = {
  avatarStorageId: null,
  coverStorageId: null,
} as const;

export const LEGACY_DEFAULT_LEAGUE_STORAGE_IDS = [
  "DEFAULT_AVATAR_STORAGE_ID",
  "DEFAULT_COVER_STORAGE_ID",
] as const;

type LeagueMediaStorageIds = {
  avatarStorageId?: null | string;
  coverStorageId?: null | string;
};

function isDeletableLeagueStorageId(
  storageId?: null | string
): storageId is string {
  return Boolean(
    storageId &&
      !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(
        storageId
      )
  );
}

export function collectReplacedLeagueStorageIds(input: {
  next: LeagueMediaStorageIds;
  previous: LeagueMediaStorageIds;
}) {
  const nextStorageIds = new Set(
    [input.next.avatarStorageId, input.next.coverStorageId].filter(
      isDeletableLeagueStorageId
    )
  );
  const previousStorageIds = [
    input.previous.avatarStorageId,
    input.previous.coverStorageId,
  ].filter(isDeletableLeagueStorageId);

  return [...new Set(previousStorageIds)].filter(
    (storageId) => !nextStorageIds.has(storageId)
  );
}

const LeagueMediaStorageIdSchema = z
  .string()
  .min(1, "Imagem inválida.")
  .nullable();

export const CreateLeagueSchema = z.object({
  name: requiredString("Informe o nome da liga.").pipe(
    z.string().min(1, "Informe o nome da liga.")
  ),
  description: z.string().trim().optional(),
  city: requiredString("Informe a cidade.").pipe(
    z.string().min(1, "Informe a cidade.")
  ),
  state: requiredString("Informe o estado.").pipe(
    z.string().min(1, "Informe o estado.")
  ),
  locationNotes: z.string().trim().optional(),
  visibility: enumField(
    LeagueVisibilityOptions,
    "Selecione a visibilidade da liga."
  ),
  categories: z
    .array(requiredString("Informe a categoria."))
    .min(1, "Informe pelo menos uma categoria."),
  courts: LeagueCourtsSchema,
  coverStorageId: LeagueMediaStorageIdSchema,
  avatarStorageId: LeagueMediaStorageIdSchema,
  ruleConfig: ChallengeRuleConfigSchema,
});

const leagueIdSchema = z.string().min(1, "Liga inválida.");
export const LeagueByIdSchema = z.object({
  leagueId: leagueIdSchema,
});

export const UpdateLeagueSchema = z.object({
  leagueId: leagueIdSchema,
  name: requiredString("Informe o nome da liga.").pipe(
    z.string().min(1, "Informe o nome da liga.")
  ),
  description: z.string().trim().optional(),
  city: requiredString("Informe a cidade.").pipe(
    z.string().min(1, "Informe a cidade.")
  ),
  state: requiredString("Informe o estado.").pipe(
    z.string().min(1, "Informe o estado.")
  ),
  locationNotes: z.string().trim().optional(),
  visibility: enumField(
    LeagueVisibilityOptions,
    "Selecione a visibilidade da liga."
  ),
  categories: z
    .array(requiredString("Informe a categoria."))
    .min(1, "Informe pelo menos uma categoria."),
  courts: LeagueCourtsSchema,
  ruleConfig: ChallengeRuleConfigSchema,
  coverStorageId: LeagueMediaStorageIdSchema,
  avatarStorageId: LeagueMediaStorageIdSchema,
});

export const DeleteLeagueSchema = z.object({
  leagueId: leagueIdSchema,
});

export const RequestLeagueJoinSchema = z.object({
  leagueId: leagueIdSchema,
});

const leagueMembershipIdSchema = z.string().min(1, "Solicitação inválida.");

export const ReviewLeagueMembershipSchema = z.object({
  leagueId: leagueIdSchema,
  membershipId: leagueMembershipIdSchema,
});

export const ReorderLeagueRankingSchema = z.object({
  leagueId: leagueIdSchema,
  membershipIds: z
    .array(leagueMembershipIdSchema)
    .min(1, "Informe pelo menos um participante."),
});

export const leagueSchema = z.object({
  id: leagueIdSchema,
  managerUserId: z.string().min(1, "Gestor inválido."),
  name: z.string(),
  description: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  locationNotes: z.string().nullable().optional(),
  visibility: z.enum(LeagueVisibilityOptions),
  categories: z.array(z.string()),
  mode: z.literal(DEFAULT_LEAGUE_MODE),
  courts: LeagueCourtsSchema.default([]).catch([]),
  ruleConfig: ChallengeRuleConfigSchema,
  coverStorageId: z.string().nullable(),
  avatarStorageId: z.string().nullable(),
  coverUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const leagueMembershipPlayerSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  fullName: z.string(),
  nickname: z.string(),
});

export const leagueMembershipSchema = z.object({
  id: leagueMembershipIdSchema,
  leagueId: leagueIdSchema,
  userId: z.string().min(1, "Usuário inválido."),
  status: z.enum(LeagueMembershipStatusOptions),
  rankingPosition: z.number().int().positive().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  reviewedAt: z.number().nullable().optional(),
  player: leagueMembershipPlayerSchema,
});

export const leagueMembershipOverviewSchema = z.object({
  pendingRequests: z.array(leagueMembershipSchema),
  ranking: z.array(leagueMembershipSchema),
});

export const leagueChallengeParticipantSchema = z.object({
  membershipId: leagueMembershipIdSchema,
  userId: z.string().min(1, "Usuário inválido."),
  rankingPosition: z.number().int().positive().nullable().optional(),
  player: leagueMembershipPlayerSchema,
});

export const leagueChallengeScoreSetSchema = z.object({
  challengerGames: z.number().int().min(0),
  challengedGames: z.number().int().min(0),
  kind: z.enum(LeagueChallengeScoreSetKindOptions),
});

export const leagueChallengeScoreSchema = z.object({
  winnerMembershipId: leagueMembershipIdSchema,
  sets: z.array(leagueChallengeScoreSetSchema).min(1),
});

export const leagueChallengeProposalSchema = z.object({
  id: z.string().min(1, "Proposta inválida."),
  challengeId: z.string().min(1, "Desafio inválido."),
  proposedByMembershipId: leagueMembershipIdSchema,
  courtId: z.string().min(1, "Quadra inválida."),
  courtName: z.string().min(1, "Quadra inválida."),
  matchDate: z.string().min(1, "Data inválida."),
  startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  responseDeadlineAt: z.number(),
  revisionNumber: z.number().int().min(1),
  status: z.enum(LeagueChallengeProposalStatusOptions),
  createdAt: z.number(),
});

export const leagueChallengeResultSubmissionSchema = z.object({
  id: z.string().min(1, "Resultado inválido."),
  challengeId: z.string().min(1, "Desafio inválido."),
  submittedByMembershipId: leagueMembershipIdSchema,
  confirmedByMembershipId: leagueMembershipIdSchema.nullable().optional(),
  adminReviewedByUserId: z.string().nullable().optional(),
  reviewAction: z
    .enum(LeagueChallengeResultReviewActionOptions)
    .nullable()
    .optional(),
  score: leagueChallengeScoreSchema,
  winnerMembershipId: leagueMembershipIdSchema.nullable().optional(),
  submittedAt: z.number(),
  confirmedAt: z.number().nullable().optional(),
  reviewedAt: z.number().nullable().optional(),
});

export const leagueChallengeSchema = z.object({
  id: z.string().min(1, "Desafio inválido."),
  leagueId: leagueIdSchema,
  status: z.enum(LeagueChallengeStatusOptions),
  challengeValidationMode: z.enum(LeagueChallengeValidationModeOptions),
  resultValidationMode: z.enum(LeagueResultValidationModeOptions),
  challenger: leagueChallengeParticipantSchema,
  challenged: leagueChallengeParticipantSchema,
  matchConfigSnapshot: LeagueMatchConfigSchema,
  currentProposal: leagueChallengeProposalSchema,
  proposals: z.array(leagueChallengeProposalSchema),
  latestResultSubmission: leagueChallengeResultSubmissionSchema
    .nullable()
    .optional(),
  cancellationRequestedByMembershipId: leagueMembershipIdSchema
    .nullable()
    .optional(),
  cancellationRequestedAt: z.number().nullable().optional(),
  lockedAt: z.number().nullable().optional(),
  confirmedAt: z.number().nullable().optional(),
  finishedAt: z.number().nullable().optional(),
  cancelledAt: z.number().nullable().optional(),
  invalidatedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const leagueDiscoverySchema = leagueSchema.extend({
  isManagerOwner: z.boolean(),
  viewerMembershipStatus: z
    .enum(LeagueMembershipStatusOptions)
    .nullable()
    .optional(),
});

export const LeagueChallengeByIdSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
});

export const LeagueChallengesByLeagueSchema = z.object({
  leagueId: leagueIdSchema,
});

export const CreateLeagueChallengeSchema = z
  .object({
    leagueId: leagueIdSchema,
    challengedMembershipId: leagueMembershipIdSchema,
    courtId: z.string().min(1, "Quadra inválida."),
    matchDate: z.string().min(1, "Informe a data da partida."),
    startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
    endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  })
  .superRefine((value, ctx) => {
    if (value.startMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["startMinute"],
      });
    }

    if (value.endMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["endMinute"],
      });
    }

    if (value.startMinute >= value.endMinute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O horário inicial deve ser menor que o horário final.",
        path: ["endMinute"],
      });
    }
  });

export const CounterProposeLeagueChallengeSchema = z
  .object({
    challengeId: z.string().min(1, "Desafio inválido."),
    courtId: z.string().min(1, "Quadra inválida."),
    matchDate: z.string().min(1, "Informe a data da partida."),
    startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
    endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  })
  .superRefine((value, ctx) => {
    if (value.startMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["startMinute"],
      });
    }

    if (value.endMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["endMinute"],
      });
    }

    if (value.startMinute >= value.endMinute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O horário inicial deve ser menor que o horário final.",
        path: ["endMinute"],
      });
    }
  });

export const SubmitLeagueChallengeResultSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
  score: leagueChallengeScoreSchema,
});

export const RequestLeagueChallengeCancellationSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
});

export const RespondLeagueChallengeCancellationSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
  action: z.enum(["accept", "reject"]),
});

export const ReviewLeagueChallengeSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
  action: z.enum(["approve", "reject"]),
});

export const ReviewLeagueChallengeResultSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
  resultSubmissionId: z.string().min(1, "Resultado inválido."),
  action: z.enum(["approve", "request_correction", "invalidate"]),
});

export const AdminManageLeagueChallengeSchema = z.object({
  challengeId: z.string().min(1, "Desafio inválido."),
  action: z.enum(LeagueChallengeAdminActionOptions),
  reason: z.string().trim().min(1, "Informe o motivo da ação administrativa."),
});

export type CreateLeagueInput = z.infer<typeof CreateLeagueSchema>;
export type ChallengeRuleConfig = z.infer<typeof ChallengeRuleConfigSchema>;
export type CreateLeagueChallengeInput = z.infer<
  typeof CreateLeagueChallengeSchema
>;
export type CounterProposeLeagueChallengeInput = z.infer<
  typeof CounterProposeLeagueChallengeSchema
>;
export type DeleteLeagueInput = z.infer<typeof DeleteLeagueSchema>;
export type LeagueByIdInput = z.infer<typeof LeagueByIdSchema>;
export type League = z.infer<typeof leagueSchema>;
export type LeagueChallenge = z.infer<typeof leagueChallengeSchema>;
export type LeagueChallengeParticipant = z.infer<
  typeof leagueChallengeParticipantSchema
>;
export type LeagueChallengeProposal = z.infer<
  typeof leagueChallengeProposalSchema
>;
export type LeagueChallengeResultSubmission = z.infer<
  typeof leagueChallengeResultSubmissionSchema
>;
export type LeagueChallengeScore = z.infer<typeof leagueChallengeScoreSchema>;
export type LeagueCourt = z.infer<typeof LeagueCourtSchema>;
export type LeagueCourtAvailability = z.infer<
  typeof LeagueCourtAvailabilitySchema
>;
export type LeagueCourtDay = LeagueCourtDayKey;
export type LeagueCourtRange = z.infer<typeof LeagueCourtRangeSchema>;
export type LeagueDiscovery = z.infer<typeof leagueDiscoverySchema>;
export type LeagueMatchConfig = z.infer<typeof LeagueMatchConfigSchema>;
export type LeagueMembership = z.infer<typeof leagueMembershipSchema>;
export type LeagueMembershipOverview = z.infer<
  typeof leagueMembershipOverviewSchema
>;
export type LeagueMembershipStatus = z.infer<
  typeof leagueMembershipSchema.shape.status
>;
export type RequestLeagueChallengeCancellationInput = z.infer<
  typeof RequestLeagueChallengeCancellationSchema
>;
export type AdminManageLeagueChallengeInput = z.infer<
  typeof AdminManageLeagueChallengeSchema
>;
export type ReviewLeagueChallengeInput = z.infer<
  typeof ReviewLeagueChallengeSchema
>;
export type ReviewLeagueChallengeResultInput = z.infer<
  typeof ReviewLeagueChallengeResultSchema
>;
export type ReorderLeagueRankingInput = z.infer<
  typeof ReorderLeagueRankingSchema
>;
export type RequestLeagueJoinInput = z.infer<typeof RequestLeagueJoinSchema>;
export type RespondLeagueChallengeCancellationInput = z.infer<
  typeof RespondLeagueChallengeCancellationSchema
>;
export type ReviewLeagueMembershipInput = z.infer<
  typeof ReviewLeagueMembershipSchema
>;
export type SubmitLeagueChallengeResultInput = z.infer<
  typeof SubmitLeagueChallengeResultSchema
>;
export type UpdateLeagueInput = z.infer<typeof UpdateLeagueSchema>;
