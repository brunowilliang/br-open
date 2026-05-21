import { z } from "zod";

export const SEED_EMAIL_PREFIX = "seed+";
export const SEED_EMAIL_DOMAIN = "bropen.local";
export const SEED_LEAGUE_NAME_PREFIX = "SEED · ";

export const SeedPreviewSchema = z.object({
  primaryUserEmail: z.string().email().optional(),
  reset: z.boolean().optional(),
  targetLeagueId: z.string().min(1).optional(),
});

export const seedPreviewResultSchema = z.object({
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
