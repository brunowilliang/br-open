import {
  createMediaFormDomain,
  type MediaFormKind,
  type MediaFormMode,
} from "@/lib/forms/media-form-store";

export type TournamentMediaKind = MediaFormKind;
export type TournamentFormMode = MediaFormMode;

// Draft de mídia compartilhado com o wizard da liga; só o título muda.
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
