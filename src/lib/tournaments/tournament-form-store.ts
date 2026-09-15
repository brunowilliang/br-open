import {
  createMediaFormDomain,
  type MediaFormKind,
  type MediaFormMode,
} from "@/lib/forms/media-form-store";

export type TournamentMediaKind = MediaFormKind;
export type TournamentFormMode = MediaFormMode;

// Shared media-form draft machinery (RUL-0005) — same backing as the league
// wizard; only the default title is tournament-specific.
export const tournamentMediaFormDomain = createMediaFormDomain({
  defaultTitle: "Criar Torneio",
});

export const tournamentFormStore$ = tournamentMediaFormDomain.store$;

export function getCreateTournamentFormSessionKey() {
  return tournamentMediaFormDomain.getCreateSessionKey();
}

export function getEditTournamentFormSessionKey(tournamentId: string) {
  return tournamentMediaFormDomain.getEditSessionKey(tournamentId);
}

export function getTournamentFormSessionKey(
  rawTournamentId?: string | string[]
) {
  return tournamentMediaFormDomain.getSessionKeyFromParam(rawTournamentId);
}

export function getTournamentFormBucket$(sessionKey: string) {
  return tournamentMediaFormDomain.getBucket$(sessionKey);
}

export function useTournamentFormRoute() {
  return tournamentMediaFormDomain.useMediaFormRoute();
}
