import { z } from "zod";

import {
  CreateLeagueSchema,
  LeagueMatchConfigSchema,
} from "@convex/domains/league/contract";

export const LeagueSchema = z.object({
  name: CreateLeagueSchema.shape.name,
  description: CreateLeagueSchema.shape.description,
  city: CreateLeagueSchema.shape.city,
  state: CreateLeagueSchema.shape.state,
  locationNotes: CreateLeagueSchema.shape.locationNotes,
  visibility: CreateLeagueSchema.shape.visibility,
  categories: CreateLeagueSchema.shape.categories,
  courts: CreateLeagueSchema.shape.courts,
  ruleConfig: CreateLeagueSchema.shape.ruleConfig.safeExtend({
    matchConfig: LeagueMatchConfigSchema,
  }),
});

export type LeagueScreenValues = z.infer<typeof LeagueSchema>;
