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
  ruleConfig: ChallengeRuleConfigSchema,
});

export const DEFAULT_LEAGUE_MODE = "challenges" as const;

export const DEFAULT_LEAGUE_STORAGE = {
  avatarStorageId: "DEFAULT_AVATAR_STORAGE_ID",
  coverStorageId: "DEFAULT_COVER_STORAGE_ID",
} as const;

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
  coverStorageId: z.string().min(1),
  avatarStorageId: z.string().min(1),
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
  coverStorageId: z.string(),
  avatarStorageId: z.string(),
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

export const leagueDiscoverySchema = leagueSchema.extend({
  isManagerOwner: z.boolean(),
  viewerMembershipStatus: z
    .enum(LeagueMembershipStatusOptions)
    .nullable()
    .optional(),
});

export type CreateLeagueInput = z.infer<typeof CreateLeagueSchema>;
export type ChallengeRuleConfig = z.infer<typeof ChallengeRuleConfigSchema>;
export type DeleteLeagueInput = z.infer<typeof DeleteLeagueSchema>;
export type LeagueByIdInput = z.infer<typeof LeagueByIdSchema>;
export type League = z.infer<typeof leagueSchema>;
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
export type ReorderLeagueRankingInput = z.infer<
  typeof ReorderLeagueRankingSchema
>;
export type RequestLeagueJoinInput = z.infer<typeof RequestLeagueJoinSchema>;
export type ReviewLeagueMembershipInput = z.infer<
  typeof ReviewLeagueMembershipSchema
>;
export type UpdateLeagueInput = z.infer<typeof UpdateLeagueSchema>;
