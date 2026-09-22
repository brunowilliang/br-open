import { z } from "zod";

export const SEED_EMAIL_PREFIX = "seed+";
export const SEED_EMAIL_DOMAIN = "bropen.local";
export const SEED_LEAGUE_NAME_PREFIX = "SEED · ";

export const SeedPreviewSchema = z.object({
  createScenarioLeagues: z.boolean().optional(),
  primaryUserEmail: z.string().email().optional(),
  reset: z.boolean().optional(),
  targetActiveMemberships: z.number().int().min(0).max(200).optional(),
  targetChallengeCount: z.number().int().min(0).max(200).optional(),
  targetLeagueId: z.string().min(1).optional(),
  targetPendingRequests: z.number().int().min(0).max(200).optional(),
  targetRejectedRequests: z.number().int().min(0).max(200).optional(),
});

export const seedPreviewResultSchema = z.object({
  challengesCreated: z.number().int().nonnegative(),
  leaguesCreated: z.number().int().nonnegative(),
  membershipsCreated: z.number().int().nonnegative(),
  playerProfilesCreated: z.number().int().nonnegative(),
  primaryUserLinked: z.boolean(),
  resetApplied: z.boolean(),
  skipped: z.boolean(),
  targetLeagueLinked: z.boolean(),
  usersCreated: z.number().int().nonnegative(),
});

export type SeedPreviewInput = z.infer<typeof SeedPreviewSchema>;
export type SeedPreviewResult = z.infer<typeof seedPreviewResultSchema>;

export const ParticipantScenarioSchema = z.object({
  leagueName: z.string().min(1).optional(),
  playerProfileId: z.string().min(1),
});

export const participantScenarioResultSchema = z.object({
  challengesCreated: z.number().int().nonnegative(),
  membershipsCreated: z.number().int().nonnegative(),
  playerProfilesCreated: z.number().int().nonnegative(),
  usersCreated: z.number().int().nonnegative(),
});

export type ParticipantScenarioInput = z.infer<
  typeof ParticipantScenarioSchema
>;
export type ParticipantScenarioResult = z.infer<
  typeof participantScenarioResultSchema
>;

/**
 * Cenario de PENDENCIAS: cria, na conta do email informado, o estado que faz a
 * home mostrar o maximo de kinds das duas superficies. O email e obrigatorio de
 * proposito — o cenario nunca roda "na conta errada" por engano.
 */
export const PendencyScenarioSchema = z.object({
  primaryUserEmail: z.string().email(),
});

export const pendencyScenarioResultSchema = z.object({
  categoriesCreated: z.number().int().nonnegative(),
  challengesCreated: z.number().int().nonnegative(),
  chargesCreated: z.number().int().nonnegative(),
  chargesRefreshed: z.number().int().nonnegative(),
  entriesCreated: z.number().int().nonnegative(),
  leaguesCreated: z.number().int().nonnegative(),
  membershipsCreated: z.number().int().nonnegative(),
  organizationId: z.string(),
  playerProfileId: z.string(),
  playerProfilesCreated: z.number().int().nonnegative(),
  /** Plantio na organizacao que o alvo JA usa (kinds 11, 12 e 13). */
  primaryEntriesCreated: z.number().int().nonnegative(),
  primaryJoinRequestsCreated: z.number().int().nonnegative(),
  primaryOrganizationsTouched: z.number().int().nonnegative(),
  tournamentsCreated: z.number().int().nonnegative(),
  userId: z.string(),
  usersCreated: z.number().int().nonnegative(),
});

export type PendencyScenarioInput = z.infer<typeof PendencyScenarioSchema>;
export type PendencyScenarioResult = z.infer<
  typeof pendencyScenarioResultSchema
>;
