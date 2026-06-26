# Player Profile Upload Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the inlined, over-engineered upload machinery from `profile.tsx` and `league-form-controller.tsx` by extracting a single shared `uploadImageToStorage` helper, with zero UI/UX changes.

**Architecture:** A new pure helper in `src/lib/uploads/convex-storage-upload.ts` owns the "POST a cropped image to Convex Storage and return its storageId" flow, throwing plain `Error` with a PT-BR message on failure. Both consumers (`profile.tsx`, `league-form-controller.tsx`) delete their duplicate error classes, upload functions, and supporting types, then call the helper. Each consumer keeps ownership of its own toast copy.

**Tech Stack:** React Native (Expo), `expo-file-system` (File upload API), Convex Storage, React Hook Form, TanStack Query, heroui-native toasts.

**Reference spec:** `docs/superpowers/specs/2026-06-26-player-profile-upload-cleanup-design.md`

---

## File Structure

- **Create:** `src/lib/uploads/convex-storage-upload.ts` — shared helper. One responsibility: upload a `CroppedImage` to a Convex Storage upload URL and return `{ storageId }`.
- **Modify:** `src/app/(private)/settings/player/profile.tsx` — delete `PlayerAvatarUploadError` + supporting types/helpers (lines 41-227 region); rewrite `uploadPendingAvatar` and the `submitForm` catch block to use the helper.
- **Modify:** `src/lib/leagues/league-form-controller.tsx` — delete `LeagueMediaUploadError` + supporting types/helpers (lines 29-239 region); rewrite the upload loop and the `submitForm` catch block to use the helper.

No other files change. No new tests are required for this slice (the helper wraps `expo-file-system` native calls that are not unit-testable without mocking native modules; behavior is verified manually and via typecheck/lint).

---

## Task 1: Create the shared upload helper

**Files:**
- Create: `src/lib/uploads/convex-storage-upload.ts`

- [ ] **Step 1: Create the helper file**

Create `src/lib/uploads/convex-storage-upload.ts` with this exact content:

```ts
import type { CroppedImage } from "@/lib/uploads/image-crop";

const DEFAULT_UPLOAD_ERROR_MESSAGE = "Não foi possível enviar a imagem.";

/**
 * Uploads a cropped image to Convex Storage.
 *
 * Returns the `{ storageId }` returned by the storage endpoint. Throws a plain
 * `Error` whose `message` is a generic PT-BR string on any failure (file read,
 * network, non-2xx status, malformed body, missing storageId). Callers that
 * want tailored toast copy should catch and surface their own message.
 */
export async function uploadImageToStorage(input: {
  file: CroppedImage;
  uploadUrl: string;
}): Promise<{ storageId: string }> {
  const { File: ExpoFile, UploadType } = await import("expo-file-system");

  let uploadFile: InstanceType<typeof ExpoFile>;
  try {
    uploadFile = new ExpoFile(input.file.uri);
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  const contentType = input.file.mimeType || "image/jpeg";

  let uploadResponse: Awaited<ReturnType<typeof uploadFile.upload>>;
  try {
    uploadResponse = await uploadFile.upload(input.uploadUrl, {
      headers: {
        "Content-Type": contentType,
      },
      httpMethod: "POST",
      mimeType: contentType,
      uploadType: UploadType.BINARY_CONTENT,
    });
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE);
  }

  let uploadResponseBody: unknown;
  try {
    uploadResponseBody = JSON.parse(uploadResponse.body);
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  if (
    typeof uploadResponseBody === "object" &&
    uploadResponseBody !== null &&
    "storageId" in uploadResponseBody &&
    typeof uploadResponseBody.storageId === "string" &&
    uploadResponseBody.storageId.trim()
  ) {
    return { storageId: uploadResponseBody.storageId };
  }

  throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE);
}
```

- [ ] **Step 2: Run typecheck on the new file**

Run: `bun run typecheck`
Expected: PASS (no errors referencing `convex-storage-upload.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/uploads/convex-storage-upload.ts
git commit -m "feat(uploads): add shared uploadImageToStorage helper"
```

---

## Task 2: Refactor `profile.tsx` to use the helper

**Files:**
- Modify: `src/app/(private)/settings/player/profile.tsx`

- [ ] **Step 1: Delete the upload machinery block**

Delete lines 41-131 of `src/app/(private)/settings/player/profile.tsx` — the entire block containing:

- `type UploadedPlayerAvatar`
- `type PlayerAvatarUploadPhase`
- `type PlayerAvatarUploadErrorOptions`
- `class PlayerAvatarUploadError`
- `const DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE`
- `const PLAYER_AVATAR_CROP_TARGET`
- `function parseConvexUploadStorageId`
- `function formatPlayerAvatarUploadError`
- `async function buildPlayerAvatarUploadFile`
- `function readUploadErrorDetails`
- `async function uploadPlayerAvatar`

Keep `PLAYER_AVATAR_CROP_TARGET` only if it is still referenced after the rewrite (it is used at line 368 inside `handleCropConfirm` as the `target`). **Re-add it** above the component if you removed it, because Task 2 still needs it:

```ts
const PLAYER_AVATAR_CROP_TARGET = {
  width: 900,
} as const;
```

- [ ] **Step 2: Update imports**

In the import block at the top of the file, the helper imports for upload are no longer needed locally. Ensure the import from `@/lib/uploads/image-crop` still brings in what `handleCropConfirm` uses (`cropImage`, `CroppedImage`, `ImageCropArea`, `ImageCropAsset`, `ImageCropper`, `pickImageCropAsset`) and add the new helper import.

Replace the existing `@/lib/uploads/image-crop` import block (lines 26-33) with:

```ts
import {
  cropImage,
  type CroppedImage,
  type ImageCropArea,
  type ImageCropAsset,
  ImageCropper,
  pickImageCropAsset,
} from "@/lib/uploads/image-crop";
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
```

Note: `CroppedImage` is still needed for the `pendingAvatarFile` state type at the component.

- [ ] **Step 3: Rewrite `uploadPendingAvatar`**

Replace the entire `uploadPendingAvatar` function (lines 398-432) with:

```ts
  async function uploadPendingAvatar(input: PlayerProfileValues) {
    if (!pendingAvatarFile) {
      return input;
    }

    setIsAvatarProcessing(true);

    try {
      const uploadUrl = await generateUploadUrl.mutateAsync({});
      const uploadedAvatar = await uploadImageToStorage({
        file: pendingAvatarFile,
        uploadUrl,
      });
      const nextValues = {
        ...input,
        avatarStorageId: uploadedAvatar.storageId,
      };

      form.setValue("avatarStorageId", uploadedAvatar.storageId, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue("avatarDraftUri", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      setPendingAvatarFile(null);

      return nextValues;
    } finally {
      setIsAvatarProcessing(false);
    }
  }
```

- [ ] **Step 4: Update the `submitForm` catch block**

Replace the `catch (error)` block in `submitForm` (lines 317-325) so it uses the profile-specific toast copy directly instead of `formatPlayerAvatarUploadError`:

Old:
```ts
    } catch (error) {
      toast.show({
        description: formatPlayerAvatarUploadError(error),
        id: "player-avatar-submit-upload-error",
        label: "Erro no upload",
        variant: "danger",
      });
      return;
    }
```

New:
```ts
    } catch {
      toast.show({
        description: "Não foi possível enviar o avatar.",
        id: "player-avatar-submit-upload-error",
        label: "Erro no upload",
        variant: "danger",
      });
      return;
    }
```

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS. If it fails, the most likely cause is a leftover reference to a deleted symbol (`PlayerAvatarUploadError`, `formatPlayerAvatarUploadError`, `uploadPlayerAvatar`, `UploadedPlayerAvatar`, `parseConvexUploadStorageId`, `DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE`). Grep the file for those names and remove any remaining references.

- [ ] **Step 6: Run lint/format**

Run: `bun x ultracite fix`
Expected: completes with no errors in `profile.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/app/(private)/settings/player/profile.tsx
git commit -m "refactor(player): use shared upload helper in profile screen"
```

---

## Task 3: Refactor `league-form-controller.tsx` to use the helper

**Files:**
- Modify: `src/lib/leagues/league-form-controller.tsx`

- [ ] **Step 1: Delete the upload machinery block**

Delete lines 35-239 of `src/lib/leagues/league-form-controller.tsx` — the entire block containing:

- `type UploadedLeagueMedia`
- `type LeagueMediaUploadPhase`
- `type LeagueMediaUploadErrorOptions`
- `class LeagueMediaUploadError`
- `const DEFAULT_UPLOAD_ERROR_MESSAGE`
- `function parseConvexUploadStorageId`
- `function formatLeagueMediaUploadError`
- `async function buildLeagueMediaUploadFile`
- `function readUploadErrorDetails`
- `async function uploadLeagueMedia`

**Keep** `LEAGUE_MEDIA_CROP_CONFIG`, `LEAGUE_MEDIA_KINDS`, `buildLeagueMediaCropConfig`, and the `LeagueMediaCropConfig` type (lines 99-119 region) — these are still used by the crop flow.

- [ ] **Step 2: Update imports**

Add the helper import. The existing `@/lib/uploads/image-crop` import (lines 19-26) stays as-is because the controller still uses `cropImage`, `ImageCropper`, `ImageCropArea`, `pickImageCropAsset`, and `CroppedImage`.

Add after the existing image-crop import:

```ts
import { uploadImageToStorage } from "@/lib/uploads/convex-storage-upload";
```

- [ ] **Step 3: Rewrite the upload loop in `uploadPendingMedia`**

Replace the body of the `try` block inside the `for (const kind of LEAGUE_MEDIA_KINDS)` loop (lines 332-348) so it calls the shared helper. The full updated `uploadPendingMedia` callback (lines 316-357) becomes:

```ts
  const uploadPendingMedia = useCallback(
    async (input: LeagueScreenValues): Promise<LeagueScreenValues> => {
      let nextValues = input;

      for (const kind of LEAGUE_MEDIA_KINDS) {
        const pendingFile = bucket$.media.pendingFiles[kind].get();

        if (!pendingFile) {
          continue;
        }

        const formField =
          kind === "avatar" ? "avatarStorageId" : "coverStorageId";

        bucket$.actions.setUploadingMediaKind(kind);

        try {
          const uploadUrl = await generateUploadUrl.mutateAsync({});
          const uploadedMedia = await uploadImageToStorage({
            file: pendingFile,
            uploadUrl,
          });

          nextValues = {
            ...nextValues,
            [formField]: uploadedMedia.storageId,
          };
          form.setValue(formField, uploadedMedia.storageId, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
          bucket$.actions.setPendingMediaFile(kind, null);
        } finally {
          bucket$.actions.setUploadingMediaKind(null);
        }
      }

      return nextValues;
    },
    [bucket$, form, generateUploadUrl]
  );
```

- [ ] **Step 4: Update the `submitForm` catch block**

Replace the `catch (error)` block in `submitForm` (lines 365-373) so it uses the league-specific toast copy directly instead of `formatLeagueMediaUploadError`:

Old:
```ts
      } catch (error) {
        toast.show({
          description: formatLeagueMediaUploadError(error),
          id: "league-media-submit-upload-error",
          label: "Erro no upload",
          variant: "danger",
        });
        return;
      }
```

New:
```ts
      } catch {
        toast.show({
          description: "Não foi possível enviar a imagem.",
          id: "league-media-submit-upload-error",
          label: "Erro no upload",
          variant: "danger",
        });
        return;
      }
```

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS. If it fails, grep the file for deleted symbols (`LeagueMediaUploadError`, `formatLeagueMediaUploadError`, `uploadLeagueMedia`, `UploadedLeagueMedia`, `parseConvexUploadStorageId`, `DEFAULT_UPLOAD_ERROR_MESSAGE`) and remove leftover references.

- [ ] **Step 6: Run lint/format**

Run: `bun x ultracite fix`
Expected: completes with no errors in `league-form-controller.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/leagues/league-form-controller.tsx
git commit -m "refactor(leagues): use shared upload helper in form controller"
```

---

## Task 4: Final validation

**Files:** none (verification only)

- [ ] **Step 1: Run the full check suite**

Run: `bun run check`
Expected: PASS (runs typecheck + convex typecheck).

- [ ] **Step 2: Run tests**

Run: `bun test`
Expected: all existing tests pass (no new tests added; upload helper wraps native modules).

- [ ] **Step 3: Confirm no stale references remain**

Run a search across `src/` for each removed symbol and confirm zero hits:
- `PlayerAvatarUploadError`
- `LeagueMediaUploadError`
- `formatPlayerAvatarUploadError`
- `formatLeagueMediaUploadError`
- `uploadPlayerAvatar`
- `uploadLeagueMedia`

Expected: no matches.

- [ ] **Step 4: Manual smoke test (when a device/simulator is available)**

Confirm on the profile screen:
- Picking + cropping an avatar still shows the "Avatar pronto" success toast.
- Saving still uploads and shows "Perfil atualizado com sucesso."
- An upload failure still shows "Não foi possível enviar o avatar."

Confirm on the league create/edit flow:
- Picking + cropping avatar/cover still shows the "Avatar pronto" / "Banner pronto" toast.
- Saving still uploads both media kinds.
- An upload failure still shows "Não foi possível enviar a imagem."
