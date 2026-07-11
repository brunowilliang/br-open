import { z } from "zod";

import { getBestOfSetValidationError } from "@convex/domains/league/challenge-rules";
import {
  CreateLeagueSchema,
  LeagueMatchConfigSchema,
} from "@convex/domains/league/contract";

const LeagueMatchConfigFormSchema = LeagueMatchConfigSchema.superRefine(
  (value, ctx) => {
    const bestOfSetValidationError = getBestOfSetValidationError(
      value.bestOfSets
    );

    if (!bestOfSetValidationError) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: bestOfSetValidationError,
      path: ["bestOfSets"],
    });
  }
);

export const LeagueSchema = z.object({
  name: CreateLeagueSchema.shape.name,
  description: CreateLeagueSchema.shape.description,
  city: CreateLeagueSchema.shape.city,
  state: CreateLeagueSchema.shape.state,
  locationNotes: CreateLeagueSchema.shape.locationNotes,
  visibility: CreateLeagueSchema.shape.visibility,
  categories: CreateLeagueSchema.shape.categories,
  courts: CreateLeagueSchema.shape.courts,
  maxPlayers: CreateLeagueSchema.shape.maxPlayers,
  approvalMode: CreateLeagueSchema.shape.approvalMode,
  gracePeriodDays: CreateLeagueSchema.shape.gracePeriodDays,
  reminderDaysBefore: CreateLeagueSchema.shape.reminderDaysBefore,
  monthlyPriceCents: CreateLeagueSchema.shape.monthlyPriceCents,
  priceBillingInterval: CreateLeagueSchema.shape.priceBillingInterval,
  coverStorageId: CreateLeagueSchema.shape.coverStorageId,
  avatarStorageId: CreateLeagueSchema.shape.avatarStorageId,
  ruleConfig: CreateLeagueSchema.shape.ruleConfig.safeExtend({
    matchConfig: LeagueMatchConfigFormSchema,
  }),
});

export type LeagueScreenValues = z.infer<typeof LeagueSchema>;
