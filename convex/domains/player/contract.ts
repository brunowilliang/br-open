import { z } from "zod";
import { collectReplacedStorageIds } from "../../shared/media-rules";
import { enumField, requiredString } from "../../utils/contract.zod";

const playerGenderOptions = ["Feminino", "Masculino"] as const;

const phoneSchema = z
  .string()
  .trim()
  .nullish()
  .refine((value) => {
    if (!value) {
      return true;
    }

    const digits = value.replace(/\D/g, "");

    return digits.length === 10 || digits.length === 11;
  }, "Informe um telefone válido.")
  .transform((value) => value || undefined);

const playerAvatarStorageIdSchema = z
  .string()
  .min(1, "Imagem inválida.")
  .nullable();

const playerProfileFields = {
  fullName: requiredString("Informe o nome completo.").pipe(
    z.string().min(2, "Informe o nome completo.")
  ),
  gender: enumField(playerGenderOptions, "Selecione o gênero."),
  nickname: requiredString("Informe o apelido.").pipe(
    z.string().min(2, "Informe o apelido.")
  ),
  phone: phoneSchema,
};

export const upsertPlayerProfileSchema = z.object({
  ...playerProfileFields,
  avatarStorageId: playerAvatarStorageIdSchema,
});

export const playerProfileSchema = z.object({
  avatarStorageId: playerAvatarStorageIdSchema,
  avatarUrl: z.string().nullable().optional(),
  fullName: z.string().min(1),
  gender: enumField(playerGenderOptions, "Selecione o gênero.")
    .nullable()
    .optional(),
  nickname: z.string().min(1),
  phone: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Player personal dashboard — `player.dashboard.getOverview`
// ---------------------------------------------------------------------------
//
// One aggregate for the player-mode home: upcoming matches, consolidated W/L
// across leagues and tournaments, current league positions with their position
// series (ranking snapshots), active tournament entries per category and the
// most frequent doubles partner. Read-only over the existing buckets — no new
// table.

export const playerDashboardPlayerCardSchema = z.object({
  avatarUrl: z.string().nullable(),
  fullName: z.string(),
  playerProfileId: z.string(),
});

export const playerDashboardUpcomingMatchSchema = z.object({
  categoryDisplayName: z.string().nullable(),
  categoryId: z.string().nullable(),
  competitionId: z.string(),
  competitionName: z.string(),
  courtName: z.string().nullable(),
  endMinute: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .nullable(),
  id: z.string(),
  kind: z.enum(["league_challenge", "tournament_match"]),
  matchDate: z.string(),
  opponents: z.array(playerDashboardPlayerCardSchema),
  partner: playerDashboardPlayerCardSchema.nullable(),
  startMinute: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
});

export const playerDashboardResultMonthSchema = z.object({
  losses: z.number().int().nonnegative(),
  month: z.string(),
  wins: z.number().int().nonnegative(),
});

export const playerDashboardPositionPointSchema = z.object({
  at: z.number(),
  position: z.number().int().min(1),
});

export const playerDashboardLeaguePositionSchema = z.object({
  leagueId: z.string(),
  leagueName: z.string(),
  membershipId: z.string(),
  position: z.number().int().min(1).nullable(),
  rankingSize: z.number().int().min(1).nullable(),
  series: z.array(playerDashboardPositionPointSchema),
});

export const playerDashboardEntryCategorySchema = z.object({
  categoryId: z.string(),
  displayName: z.string(),
  entryCount: z.number().int().nonnegative(),
});

export const playerDashboardPartnerSchema = z.object({
  count: z.number().int().nonnegative(),
  player: playerDashboardPlayerCardSchema,
});

export const playerDashboardOverviewSchema = z.object({
  entryCategories: z.array(playerDashboardEntryCategorySchema),
  frequentPartner: playerDashboardPartnerSchema.nullable(),
  leagues: z.array(playerDashboardLeaguePositionSchema),
  performance: z.object({
    byMonth: z.array(playerDashboardResultMonthSchema),
    losses: z.number().int().nonnegative(),
    winRate: z.number().min(0).max(1),
    wins: z.number().int().nonnegative(),
  }),
  upcomingMatches: z.array(playerDashboardUpcomingMatchSchema),
});

export type PlayerDashboardPlayerCard = z.infer<
  typeof playerDashboardPlayerCardSchema
>;
export type PlayerDashboardUpcomingMatch = z.infer<
  typeof playerDashboardUpcomingMatchSchema
>;
export type PlayerDashboardLeaguePosition = z.infer<
  typeof playerDashboardLeaguePositionSchema
>;
export type PlayerDashboardOverview = z.infer<
  typeof playerDashboardOverviewSchema
>;

export function collectReplacedPlayerAvatarStorageIds(input: {
  next: { avatarStorageId?: null | string };
  previous?: { avatarStorageId?: null | string } | null;
}) {
  return collectReplacedStorageIds("avatarStorageId", {
    next: input.next,
    previous: input.previous,
  });
}
