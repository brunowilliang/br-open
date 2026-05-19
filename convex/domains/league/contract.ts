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

export const LeagueMembershipStatusOptions = [
  "pending",
  "active",
  "rejected",
  "removed",
  "left",
  "suspended",
] as const;

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
  regulation: z.string().trim().optional(),
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
  regulation: z.string().trim().optional(),
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
  regulation: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  locationNotes: z.string().nullable().optional(),
  visibility: z.enum(LeagueVisibilityOptions),
  categories: z.array(z.string()),
  mode: z.literal(DEFAULT_LEAGUE_MODE),
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
export type LeagueDiscovery = z.infer<typeof leagueDiscoverySchema>;
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
