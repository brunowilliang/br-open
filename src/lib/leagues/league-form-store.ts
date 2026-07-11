import { observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";

import type { ImageCropAsset, CroppedImage } from "@/lib/uploads/image-crop";
import { normalizeRouteParam } from "@/lib/router/normalize-param";

export type LeagueMediaKind = "avatar" | "cover";
export type LeagueFormMode = "create" | "edit";

type LeagueFormCallbacks = {
  onDelete?: () => Promise<void>;
  onMediaPress?: (kind: LeagueMediaKind) => Promise<void>;
  onSubmitPress?: () => void;
};

type LeagueFormBucketConfig = {
  avatarUrl?: string | null;
  coverUrl?: string | null;
  externalPending?: boolean;
  isRulesLocked?: boolean;
  mode: LeagueFormMode;
  showDelete?: boolean;
  title: string;
};

type LeagueFormBucket = ReturnType<typeof createLeagueFormBucket>;

const CREATE_LEAGUE_FORM_SESSION_KEY = "create";
const leagueFormBuckets = new Map<string, LeagueFormBucket>();
const leagueFormCallbacks = new Map<string, LeagueFormCallbacks>();

export const leagueFormStore$ = observable({
  activeSessionKey: CREATE_LEAGUE_FORM_SESSION_KEY,
});

function createLeagueFormBucket(sessionKey: string) {
  const bucket$ = observable({
    identity: {
      isRulesLocked: false,
      mode: "create" as LeagueFormMode,
      sessionKey,
      showDelete: false,
      title: "Criar Liga",
    },
    media: {
      avatarUrl: null as string | null,
      coverUrl: null as string | null,
      pendingFiles: {
        avatar: null as CroppedImage | null,
        cover: null as CroppedImage | null,
      },
      previewUrls: {
        avatar: null as string | null,
        cover: null as string | null,
      },
    },
    crop: {
      request: null as null | {
        asset: ImageCropAsset;
        kind: LeagueMediaKind;
      },
    },
    status: {
      externalPending: false,
      formSubmitting: false,
      uploadingMediaKind: null as LeagueMediaKind | null,
    },
    derived: {
      avatarUrl: () =>
        bucket$.media.previewUrls.avatar.get() ?? bucket$.media.avatarUrl.get(),
      coverUrl: () =>
        bucket$.media.previewUrls.cover.get() ?? bucket$.media.coverUrl.get(),
      isMediaBusy: () => Boolean(bucket$.status.uploadingMediaKind.get()),
      isSubmitPending: () =>
        bucket$.status.externalPending.get() ||
        bucket$.status.formSubmitting.get() ||
        bucket$.derived.isMediaBusy.get(),
    },
    actions: {
      clearMedia: () => {
        bucket$.crop.request.set(null);
        bucket$.media.pendingFiles.assign({
          avatar: null,
          cover: null,
        });
        bucket$.media.previewUrls.assign({
          avatar: null,
          cover: null,
        });
        bucket$.status.uploadingMediaKind.set(null);
      },
      configure: (input: LeagueFormBucketConfig) => {
        leagueFormStore$.activeSessionKey.set(sessionKey);
        bucket$.identity.assign({
          isRulesLocked: Boolean(input.isRulesLocked),
          mode: input.mode,
          showDelete: input.mode === "edit" && (input.showDelete ?? true),
          title: input.title,
        });
        bucket$.media.assign({
          avatarUrl: input.avatarUrl ?? null,
          coverUrl: input.coverUrl ?? null,
        });
        bucket$.status.externalPending.set(Boolean(input.externalPending));
      },
      deleteLeague: async () => {
        await leagueFormCallbacks.get(sessionKey)?.onDelete?.();
      },
      mediaPress: async (kind: LeagueMediaKind) => {
        await leagueFormCallbacks.get(sessionKey)?.onMediaPress?.(kind);
      },
      registerCallbacks: (callbacks: LeagueFormCallbacks) => {
        leagueFormCallbacks.set(sessionKey, callbacks);
      },
      reset: () => {
        bucket$.actions.clearMedia();
        bucket$.identity.assign({
          isRulesLocked: false,
          mode: "create",
          showDelete: false,
          title: "Criar Liga",
        });
        bucket$.media.assign({
          avatarUrl: null,
          coverUrl: null,
        });
        bucket$.status.assign({
          externalPending: false,
          formSubmitting: false,
          uploadingMediaKind: null,
        });
        if (leagueFormStore$.activeSessionKey.get() === sessionKey) {
          leagueFormStore$.activeSessionKey.set(CREATE_LEAGUE_FORM_SESSION_KEY);
        }
        leagueFormCallbacks.delete(sessionKey);
      },
      // Drop this session from the module-scoped buckets/callbacks maps.
      // reset() keeps the bucket around so a remount finds it; dispose()
      // fully frees memory (callbacks capture form/toast props and would
      // otherwise leak if the screen unmounts without an explicit reset).
      dispose: () => {
        leagueFormBuckets.delete(sessionKey);
        leagueFormCallbacks.delete(sessionKey);
      },
      setCropRequest: (
        request: null | {
          asset: ImageCropAsset;
          kind: LeagueMediaKind;
        }
      ) => {
        bucket$.crop.request.set(request);
      },
      setFormSubmitting: (value: boolean) => {
        bucket$.status.formSubmitting.set(value);
      },
      setMediaPreviewUrl: (kind: LeagueMediaKind, value: string | null) => {
        bucket$.media.previewUrls[kind].set(value);
      },
      setPendingMediaFile: (
        kind: LeagueMediaKind,
        value: CroppedImage | null
      ) => {
        bucket$.media.pendingFiles[kind].set(value);
      },
      setUploadingMediaKind: (kind: LeagueMediaKind | null) => {
        bucket$.status.uploadingMediaKind.set(kind);
      },
      submit: () => {
        leagueFormCallbacks.get(sessionKey)?.onSubmitPress?.();
      },
      unregisterCallbacks: () => {
        leagueFormCallbacks.delete(sessionKey);
      },
    },
  });

  return bucket$;
}

export function getCreateLeagueFormSessionKey() {
  return CREATE_LEAGUE_FORM_SESSION_KEY;
}

export function getEditLeagueFormSessionKey(leagueId: string) {
  return `edit:${leagueId}`;
}

export function getLeagueFormSessionKey(rawLeagueId?: string | string[]) {
  const leagueId = normalizeRouteParam(rawLeagueId);

  return leagueId
    ? getEditLeagueFormSessionKey(leagueId)
    : getCreateLeagueFormSessionKey();
}

export function getLeagueFormBucket$(sessionKey: string) {
  const existing = leagueFormBuckets.get(sessionKey);

  if (existing) {
    return existing;
  }

  const bucket$ = createLeagueFormBucket(sessionKey);
  leagueFormBuckets.set(sessionKey, bucket$);

  return bucket$;
}

export function useLeagueFormRoute() {
  const activeSessionKey = useValue(leagueFormStore$.activeSessionKey);
  const bucket$ = getLeagueFormBucket$(activeSessionKey);

  return {
    avatarUrl: useValue(bucket$.derived.avatarUrl),
    coverUrl: useValue(bucket$.derived.coverUrl),
    isMediaBusy: useValue(bucket$.derived.isMediaBusy),
    isRulesLocked: useValue(bucket$.identity.isRulesLocked),
    isSubmitPending: useValue(bucket$.derived.isSubmitPending),
    mode: useValue(bucket$.identity.mode),
    onDelete: bucket$.actions.deleteLeague,
    onMediaPress: bucket$.actions.mediaPress,
    onSubmitPress: bucket$.actions.submit,
    showDelete: useValue(bucket$.identity.showDelete),
    title: useValue(bucket$.identity.title),
  };
}
