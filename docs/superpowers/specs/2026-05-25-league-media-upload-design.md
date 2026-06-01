# League Media Upload Design

## Goal

Add working upload for league banner and avatar in the existing create/edit
league flow.

The organizer should be able to:

1. Tap the banner area and choose an image cropped as a banner.
2. Tap the avatar area and choose an image cropped as an avatar.
3. Save the league with the selected media.
4. See uploaded media on league cards and the public league detail screen.

## Product Constraints

- Keep this scoped to league media only.
- Use the existing `coverStorageId` and `avatarStorageId` fields.
- Banner crop uses a `16:9` aspect ratio.
- Avatar crop uses a `1:1` aspect ratio.
- Create and edit continue using the current single save action.
- Use a custom in-app crop step because `expo-image-picker` only honors
  arbitrary crop aspect ratios on Android; iOS native editing is square.
- Keep `convex/functions/schema.ts` as composition-only.

## Data Flow

1. The details tab launches `expo-image-picker` without native editing.
2. The app opens a local crop surface locked to `16:9` or `1:1`.
3. `expo-image-manipulator` writes the cropped image file.
4. The client calls `league.management.generateUploadUrl`.
5. The client posts the cropped local file to the Convex upload URL.
6. Convex returns a `storageId`.
7. The form stores the new `coverStorageId` or `avatarStorageId`.
8. Create/update saves those storage IDs on the existing `league` record.
9. League read procedures resolve `coverUrl` and `avatarUrl` with
   `ctx.storage.getUrl`.

## Backend Design

- Add `coverUrl` and `avatarUrl` to `leagueSchema`.
- Keep `coverStorageId` and `avatarStorageId` as persisted required fields.
- Add an authenticated `generateUploadUrl` mutation under
  `convex/functions/league/management.ts`.
- Skip URL resolution for default placeholder IDs because they are not real
  Convex storage IDs.
- Keep old league documents compatible by retaining the existing storage ID
  fields and defaults.

## Frontend Design

- Extend `LeagueScreenValues` with `coverStorageId` and `avatarStorageId`.
- Add default media IDs to create defaults.
- Pass current media URLs into the details tab for previews.
- Add focused media helpers for:
  - media type config
  - picker options
  - crop dimensions
  - image manipulation
  - posting the selected file to Convex storage
  - parsing the returned storage ID
- Use HeroUI Native `PressableFeedback` and current image components for the
  tappable banner/avatar previews.

## Error Handling

- If the user cancels the picker, keep the current image.
- If permission, picker, or upload fails, show a danger toast and keep the
  previous storage ID.
- If Convex cannot resolve a storage URL, return `null` and let the UI fallback
  render.

## Testing

- Add form-schema tests proving media IDs are part of the form values.
- Add upload-helper tests proving banner and avatar use the right crop aspect.
- Run `bun run codegen` after Convex/cRPC changes.
- Run `bun run typecheck` and `git diff --check` before handoff.

## Success Criteria

- Banner upload produces a cropped `16:9` file.
- Avatar upload produces a cropped `1:1` file.
- Create saves custom media storage IDs.
- Edit preserves or replaces media storage IDs.
- League cards and detail screen render uploaded media when URLs are available.
