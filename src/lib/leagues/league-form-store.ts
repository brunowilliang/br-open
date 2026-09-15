import {
  createMediaFormDomain,
  type MediaFormKind,
  type MediaFormMode,
} from "@/lib/forms/media-form-store";

export type LeagueMediaKind = MediaFormKind;
export type LeagueFormMode = MediaFormMode;

export const leagueMediaFormDomain = createMediaFormDomain({
  defaultTitle: "Criar Liga",
});

export const leagueFormStore$ = leagueMediaFormDomain.store$;

export function getCreateLeagueFormSessionKey() {
  return leagueMediaFormDomain.getCreateSessionKey();
}

export function getEditLeagueFormSessionKey(leagueId: string) {
  return leagueMediaFormDomain.getEditSessionKey(leagueId);
}

export function getLeagueFormSessionKey(rawLeagueId?: string | string[]) {
  return leagueMediaFormDomain.getSessionKeyFromParam(rawLeagueId);
}

export function getLeagueFormBucket$(sessionKey: string) {
  return leagueMediaFormDomain.getBucket$(sessionKey);
}

export function useLeagueFormRoute() {
  return leagueMediaFormDomain.useMediaFormRoute();
}
