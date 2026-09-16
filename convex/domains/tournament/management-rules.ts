import type { TournamentStatus } from "./contract";
import {
  isScheduledTournamentMatch,
  type TournamentScheduledMatch,
} from "./scheduling-rules";

/**
 * Statuses the organizer may still edit through `tournament.update`. Drawn
 * and ONGOING are both adjustment phases (user decision after the drawn
 * lockdown proved too narrow); only finished events are frozen.
 */
const EDITABLE_TOURNAMENT_STATUSES: Partial<Record<TournamentStatus, true>> = {
  draft: true,
  drawn: true,
  ongoing: true,
  published: true,
};

export function validateTournamentEditStatus(
  status: TournamentStatus
): string | null {
  return EDITABLE_TOURNAMENT_STATUSES[status]
    ? null
    : "Torneios encerrados não podem ser editados.";
}

/**
 * Court safety for edits on a drawn bracket (mirrors the entry-safe category
 * sync): a court that LEFT the list may not break an existing booking. If a
 * SCHEDULED match (matchDate+startMinute+courtId present, BUG-0030-safe
 * predicate) still references a removed court, return that courtId; matches
 * without a booking never pin a court.
 */
export function findRemovedScheduledCourt(input: {
  removedCourtIds: ReadonlySet<string>;
  scheduledMatches: TournamentScheduledMatch[];
}): string | null {
  for (const match of input.scheduledMatches) {
    if (!isScheduledTournamentMatch(match)) {
      continue;
    }
    if (!input.removedCourtIds.has(match.courtId)) {
      continue;
    }
    return match.courtId;
  }
  return null;
}
