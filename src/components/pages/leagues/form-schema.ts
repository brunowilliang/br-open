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
  approvalMode: CreateLeagueSchema.shape.approvalMode,
  avatarStorageId: CreateLeagueSchema.shape.avatarStorageId,
  categories: CreateLeagueSchema.shape.categories,
  city: CreateLeagueSchema.shape.city,
  courts: CreateLeagueSchema.shape.courts,
  coverStorageId: CreateLeagueSchema.shape.coverStorageId,
  description: CreateLeagueSchema.shape.description,
  gracePeriodDays: CreateLeagueSchema.shape.gracePeriodDays,
  locationNotes: CreateLeagueSchema.shape.locationNotes,
  maxPlayers: CreateLeagueSchema.shape.maxPlayers,
  monthlyPriceCents: CreateLeagueSchema.shape.monthlyPriceCents,
  name: CreateLeagueSchema.shape.name,
  priceBillingInterval: CreateLeagueSchema.shape.priceBillingInterval,
  reminderDaysBefore: CreateLeagueSchema.shape.reminderDaysBefore,
  ruleConfig: CreateLeagueSchema.shape.ruleConfig.safeExtend({
    matchConfig: LeagueMatchConfigFormSchema,
  }),
  state: CreateLeagueSchema.shape.state,
  visibility: CreateLeagueSchema.shape.visibility,
});

export type LeagueScreenValues = z.infer<typeof LeagueSchema>;
