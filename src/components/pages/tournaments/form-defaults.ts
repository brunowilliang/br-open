import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import { DEFAULT_TOURNAMENT_APPROVAL_MODE } from "@convex/domains/tournament/contract";
import { DEFAULT_MATCH_CONFIG } from "@convex/domains/match/contract";

export function buildCreateTournamentDefaultValues(): TournamentScreenValues {
  return {
    approvalMode: DEFAULT_TOURNAMENT_APPROVAL_MODE,
    avatarStorageId: null,
    categories: [],
    city: "",
    courts: [],
    coverStorageId: null,
    description: "",
    locationNotes: "",
    matchConfig: {
      ...DEFAULT_MATCH_CONFIG,
    },
    name: "",
    registrationDeadlineAt: "",
    startDate: "",
    state: "",
    visibility: "public",
  };
}
