import { observable, type Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";

import type { CroppedImage, ImageCropAsset } from "@/lib/uploads/image-crop";
import { normalizeRouteParam } from "@/lib/router/normalize-param";

export type MediaFormKind = "avatar" | "cover";
export type MediaFormMode = "create" | "edit";

type MediaFormCallbacks = {
  onDelete?: () => Promise<void>;
  onMediaPress?: (kind: MediaFormKind) => Promise<void>;
  onSubmitPress?: () => void;
};

type MediaFormBucketConfig = {
  avatarUrl?: string | null;
  coverUrl?: string | null;
  externalPending?: boolean;
  mode: MediaFormMode;
  showDelete?: boolean;
  title: string;
};

/** Wiring the bucket needs from its owning domain (module-level for typing). */
type MediaFormBucketContext = {
  callbacksHolder: Map<string, MediaFormCallbacks>;
  clearCallbacks: (sessionKey: string) => void;
  createSessionKey: string;
  defaultTitle: string;
  registerCallbacks: (
    sessionKey: string,
    callbacks: MediaFormCallbacks
  ) => void;
  releaseSession: (sessionKey: string) => void;
  store$: Observable<{ activeSessionKey: string }>;
};

export type MediaFormBucket = ReturnType<typeof createMediaFormBucket>;

function createMediaFormBucket(input: {
  context: MediaFormBucketContext;
  sessionKey: string;
}) {
  const { context, sessionKey } = input;
  const bucket$ = observable({
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
      configure: (config: MediaFormBucketConfig) => {
        context.store$.activeSessionKey.set(sessionKey);
        bucket$.identity.assign({
          mode: config.mode,
          showDelete: config.mode === "edit" && (config.showDelete ?? true),
          title: config.title,
        });
        bucket$.media.assign({
          avatarUrl: config.avatarUrl ?? null,
          coverUrl: config.coverUrl ?? null,
        });
        bucket$.status.externalPending.set(Boolean(config.externalPending));
      },
      deleteEntity: async () => {
        await context.callbacksHolder.get(sessionKey)?.onDelete?.();
      },
      // reset() keeps the bucket around so a remount finds it; dispose()
      // frees it — callbacks capture form/toast props and would leak if the
      // screen unmounts without an explicit reset.
      dispose: () => {
        context.releaseSession(sessionKey);
      },
      mediaPress: async (kind: MediaFormKind) => {
        await context.callbacksHolder.get(sessionKey)?.onMediaPress?.(kind);
      },
      registerCallbacks: (callbacks: MediaFormCallbacks) => {
        context.registerCallbacks(sessionKey, callbacks);
      },
      reset: () => {
        bucket$.actions.clearMedia();
        bucket$.identity.assign({
          mode: "create",
          showDelete: false,
          title: context.defaultTitle,
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
        if (context.store$.activeSessionKey.get() === sessionKey) {
          context.store$.activeSessionKey.set(context.createSessionKey);
        }
        context.clearCallbacks(sessionKey);
      },
      setCropRequest: (
        request: null | {
          asset: ImageCropAsset;
          kind: MediaFormKind;
        }
      ) => {
        bucket$.crop.request.set(request);
      },
      setFormSubmitting: (value: boolean) => {
        bucket$.status.formSubmitting.set(value);
      },
      setMediaPreviewUrl: (kind: MediaFormKind, value: string | null) => {
        bucket$.media.previewUrls[kind].set(value);
      },
      setPendingMediaFile: (
        kind: MediaFormKind,
        value: CroppedImage | null
      ) => {
        bucket$.media.pendingFiles[kind].set(value);
      },
      setUploadingMediaKind: (kind: MediaFormKind | null) => {
        bucket$.status.uploadingMediaKind.set(kind);
      },
      submit: () => {
        context.callbacksHolder.get(sessionKey)?.onSubmitPress?.();
      },
      unregisterCallbacks: () => {
        context.clearCallbacks(sessionKey);
      },
    },
    callbacksHolder: null as null | MediaFormCallbacks,
    crop: {
      request: null as null | {
        asset: ImageCropAsset;
        kind: MediaFormKind;
      },
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
    identity: {
      mode: "create" as MediaFormMode,
      sessionKey,
      showDelete: false,
      title: "Criar",
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
    status: {
      externalPending: false,
      formSubmitting: false,
      uploadingMediaKind: null as MediaFormKind | null,
    },
  });

  return bucket$;
}

/** Named contract of `useMediaFormRoute` (media-form-store.ts). */
export type MediaFormRoute = {
  avatarUrl: null | string;
  coverUrl: null | string;
  isMediaBusy: boolean;
  isSubmitPending: boolean;
  mode: MediaFormMode;
  onDelete: () => Promise<void>;
  onMediaPress: (kind: MediaFormKind) => Promise<void>;
  onSubmitPress: () => void;
  showDelete: boolean;
  title: string;
};

/** Named contract of `createMediaFormDomain` (media-form-store.ts). */
export type MediaFormDomain = {
  getBucket$: (sessionKey: string) => MediaFormBucket;
  getCreateSessionKey: () => string;
  getEditSessionKey: (entityId: string) => string;
  getSessionKeyFromParam: (rawEntityId?: string | string[]) => string;
  store$: Observable<{ activeSessionKey: string }>;
  useMediaFormRoute: () => MediaFormRoute;
};

/** Draft store compartilhado: um domínio por wizard que precisa do padrão
 * create/edit (cover + avatar com crop, upload diferido, submit da tab bar). */
export function createMediaFormDomain(input: {
  defaultTitle: string;
}): MediaFormDomain {
  const CREATE_SESSION_KEY = "create";
  const buckets = new Map<string, MediaFormBucket>();
  const callbacks = new Map<string, MediaFormCallbacks>();

  const store$ = observable({
    activeSessionKey: CREATE_SESSION_KEY,
  });

  const context: MediaFormBucketContext = {
    callbacksHolder: callbacks,
    clearCallbacks: (sessionKey) => {
      callbacks.delete(sessionKey);
    },
    createSessionKey: CREATE_SESSION_KEY,
    defaultTitle: input.defaultTitle,
    registerCallbacks: (sessionKey, nextCallbacks) => {
      callbacks.set(sessionKey, nextCallbacks);
    },
    releaseSession: (sessionKey) => {
      buckets.delete(sessionKey);
      callbacks.delete(sessionKey);
    },
    store$,
  };

  function getBucket$(sessionKey: string): MediaFormBucket {
    const existing = buckets.get(sessionKey);

    if (existing) {
      return existing;
    }

    const bucket$ = createMediaFormBucket({ context, sessionKey });
    buckets.set(sessionKey, bucket$);

    return bucket$;
  }

  function useMediaFormRoute(): MediaFormRoute {
    const activeSessionKey = useValue(store$.activeSessionKey);
    const bucket$ = getBucket$(activeSessionKey);

    return {
      avatarUrl: useValue(bucket$.derived.avatarUrl),
      coverUrl: useValue(bucket$.derived.coverUrl),
      isMediaBusy: useValue(bucket$.derived.isMediaBusy),
      isSubmitPending: useValue(bucket$.derived.isSubmitPending),
      mode: useValue(bucket$.identity.mode),
      onDelete: bucket$.actions.deleteEntity,
      onMediaPress: bucket$.actions.mediaPress,
      onSubmitPress: bucket$.actions.submit,
      showDelete: useValue(bucket$.identity.showDelete),
      title: useValue(bucket$.identity.title),
    };
  }

  return {
    getBucket$,
    getCreateSessionKey: () => CREATE_SESSION_KEY,
    getEditSessionKey: (entityId) => `edit:${entityId}`,
    getSessionKeyFromParam: (rawEntityId) => {
      const entityId = normalizeRouteParam(rawEntityId);

      return entityId ? `edit:${entityId}` : CREATE_SESSION_KEY;
    },
    store$,
    useMediaFormRoute,
  };
}
