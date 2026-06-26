# Player Profile Upload Cleanup Design

## Goal

Clean up the player profile screen (`src/app/(private)/settings/player/profile.tsx`)
by removing its inlined, over-engineered upload machinery and extracting a single
shared Convex Storage upload helper that it shares with the league form controller.

This is a code-quality refactor. **No UI/UX changes.** Every toast, every state,
every visual element stays identical.

## Problem

`profile.tsx` ships ~200 lines of upload-specific machinery before the component
even starts:

- `PlayerAvatarUploadError` — an `Error` subclass carrying `phase`, `status`,
  `details`, and `cause`.
- `PlayerAvatarUploadPhase`, `PlayerAvatarUploadErrorOptions`,
  `UploadedPlayerAvatar` — types that only exist to feed the error class.
- `parseConvexUploadStorageId`, `buildPlayerAvatarUploadFile`,
  `readUploadErrorDetails`, `uploadPlayerAvatar`,
  `formatPlayerAvatarUploadError`, `DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE`.

None of this delivers value:

- The error class is consumed only by `formatPlayerAvatarUploadError`, which
  returns a string for the toast. The `phase`/`status`/`details` fields are
  never logged, never reach Sentry, never drive any branching.
- The upload functions are generic "POST a file to Convex Storage" logic that
  has nothing to do with player profiles specifically.

Worse, the same ~200 lines are duplicated almost verbatim in
`src/lib/leagues/league-form-controller.tsx` as `LeagueMediaUploadError`,
`uploadLeagueMedia`, `buildLeagueMediaUploadFile`, etc. Two files reinvented the
same wheel, each with its own error hierarchy that nobody uses meaningfully.

There is no shared upload helper under `src/lib/uploads/` today — only
`image-crop.ts`. The abstraction that both files need was never extracted.

## Solution

### New shared helper: `src/lib/uploads/convex-storage-upload.ts`

A single function that both consumers call:

```ts
import type { CroppedImage } from "@/lib/uploads/image-crop";

export async function uploadImageToStorage(input: {
  file: CroppedImage;
  uploadUrl: string;
}): Promise<{ storageId: string }>;
```

Responsibilities:

1. Import `File` and `UploadType` from `expo-file-system`.
2. Build an `expo-file-system` `File` from `input.file.uri`.
3. POST the file as `UploadType.BINARY_CONTENT` to `input.uploadUrl`, with
   `Content-Type` derived from `input.file.mimeType` (falling back to
   `image/jpeg`).
4. Reject non-2xx responses.
5. Parse the JSON body and extract `storageId`.
6. Return `{ storageId }`.

On any failure (file read, network, non-2xx, malformed body, missing storageId),
it throws a plain `Error`. Its `message` is a generic user-facing PT-BR string,
`"Não foi possível enviar a imagem."`, used when a caller has no more specific
copy of its own. Callers that want a tailored message (e.g. the profile screen's
"avatar" wording) catch the error and surface their own toast text instead, so
the helper's message never reaches the user on those paths.

Why no custom error class:

- Nothing today consumes `phase`, `status`, or `details`. They are dead weight.
- A plain `Error` with a ready-to-show message keeps the code honest about what
  the UX actually needs: one string in a toast.

Why the helper returns `{ storageId }` only (no `previewUri`):

- Both current callers already hold the cropped file's `uri`
  (`pendingAvatarFile.uri` in profile, `croppedFile.uri` in league). Returning a
  preview was redundant.

### Consumer changes

#### `profile.tsx`

Removed:

- `PlayerAvatarUploadError` class and its supporting types
  (`PlayerAvatarUploadPhase`, `PlayerAvatarUploadErrorOptions`,
  `UploadedPlayerAvatar`).
- `parseConvexUploadStorageId`, `buildPlayerAvatarUploadFile`,
  `readUploadErrorDetails`, `uploadPlayerAvatar`,
  `formatPlayerAvatarUploadError`, `DEFAULT_AVATAR_UPLOAD_ERROR_MESSAGE`.

`uploadPendingAvatar` becomes a thin wrapper around `uploadImageToStorage`:

- If there is no pending avatar file, return the input unchanged.
- Otherwise, generate an upload URL, call `uploadImageToStorage`, set
  `avatarStorageId` on the form, clear the draft field, clear the pending file,
  and return the merged values.

The `submitForm` `catch` block keeps ownership of the toast message: it shows
`"Não foi possível enviar o avatar."` so the profile screen keeps its specific
tone, independent of the helper's generic message.

#### `league-form-controller.tsx`

Removed:

- `LeagueMediaUploadError` class and its supporting types
  (`LeagueMediaUploadPhase`, `LeagueMediaUploadErrorOptions`,
  `UploadedLeagueMedia`).
- `parseConvexUploadStorageId`, `buildLeagueMediaUploadFile`,
  `readUploadErrorDetails`, `uploadLeagueMedia`,
  `formatLeagueMediaUploadError`, `DEFAULT_UPLOAD_ERROR_MESSAGE`.

`uploadPendingMedia`'s per-kind loop calls `uploadImageToStorage` instead of
`uploadLeagueMedia`. The surrounding `try`/`catch` in `submitForm` keeps the
league-specific toast message (`"Não foi possível enviar a imagem."`).

## Preserved Behavior (1:1)

These must not change:

- Upload sequence: `expo-file-system` `File` → POST `BINARY_CONTENT` → validate
  2xx → parse JSON → extract `storageId`.
- Content-Type fallback (`image/jpeg`).
- All toast messages, variants, and ids on both screens.
- The crop flow, the form schema, the form lifecycle, the cropper modal, the
  success path after save, the loading/error/loaded branching in `profile.tsx`.
- The league form controller's bucket/observable state model and its callback
  registration.

## Out of Scope

- No UI/UX changes on either screen.
- No changes to the Convex `generateUploadUrl` procedures or the player/league
  contracts.
- No changes to `image-crop.ts` (crop/pick logic stays as-is).
- No new tests required for the helper as part of this slice — the behavior is
  covered by the existing manual flow. (The existing `image-crop.test.ts` is
  untouched.)

## Validation

Before declaring this done:

- `bun run typecheck`
- `bun x ultracite fix`
- `bun x ultracite check`
- `git diff --check`
- Manual confirmation that both screens still upload and save identically.
