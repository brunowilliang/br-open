import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import {
  DEFAULT_ALLOW_MULTIPLE_ENTRIES_PER_TYPE,
  DEFAULT_TOURNAMENT_APPROVAL_MODE,
} from "@convex/domains/tournament/contract";
import { DEFAULT_MATCH_CONFIG } from "@convex/domains/match/contract";

export function buildCreateTournamentDefaultValues(): TournamentScreenValues {
  return {
    allowMultipleEntriesPerType: DEFAULT_ALLOW_MULTIPLE_ENTRIES_PER_TYPE,
    approvalMode: DEFAULT_TOURNAMENT_APPROVAL_MODE,
    avatarStorageId: null,
    bracketReleaseAt: "",
    categories: [],
    city: "",
    courts: [],
    coverStorageId: null,
    description: "",
    endDate: "",
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
