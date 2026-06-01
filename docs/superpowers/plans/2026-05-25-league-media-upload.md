# League Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Convex-backed upload for league banner and avatar with reliable cross-platform crop ratios.

**Architecture:** Reuse the existing league `coverStorageId` and `avatarStorageId` fields, add a cRPC upload URL mutation, and resolve read-side URLs in the league management/discovery procedures. The React Native form stores storage IDs; the picker only selects the image, a local crop surface locks the desired ratio, and `expo-image-manipulator` writes the cropped file before upload.

**Tech Stack:** Expo Router, React Native, Expo Image Picker, Expo Image Manipulator, HeroUI Native, React Hook Form, Convex, kitcn cRPC, Zod, Bun test.

---

## File Structure

- Modify: `package.json`
  - Add `expo-image-picker`.
- Modify: `convex/domains/league/contract.ts`
  - Add media ID inputs and media URL outputs.
- Modify: `convex/functions/league/management.ts`
  - Add `generateUploadUrl`, persist create media IDs, and resolve media URLs.
- Modify: `convex/functions/league/discovery.ts`
  - Resolve media URLs for public/read screens.
- Modify: `src/components/pages/leagues/form-schema.ts`
  - Add media fields to the shared form schema.
- Modify: `src/components/pages/leagues/form-defaults.ts`
  - Add default storage IDs for create.
- Modify: `src/components/pages/leagues/form-schema.test.ts`
  - Test media fields in defaults and valid payload parsing.
- Create: `src/lib/uploads/league-media.ts`
  - Define media picker options, crop config, image manipulation, and Convex upload helpers.
- Create: `src/lib/uploads/league-media.test.ts`
  - Test media crop config, picker behavior, and upload response parsing.
- Create: `src/components/pages/leagues/media-cropper.tsx`
  - Render the in-app crop preview and confirm/cancel controls.
- Modify: `src/components/pages/leagues/details.tsx`
  - Make banner/avatar previews tappable upload controls.
- Modify: `src/components/pages/leagues/screen.tsx`
  - Wire media upload callback and preview URLs into the details tab.
- Modify: `src/app/(private)/settings/leagues/new.tsx`
  - Send media fields on create.
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`
  - Prefill, preview, and send media fields on edit.
- Modify: `src/components/pages/home/league-card.tsx`
  - Render league cover URLs when available.
- Modify: `src/app/(private)/index.tsx`
  - Pass cover URLs to league cards.
- Modify: `src/app/(private)/settings/leagues/index.tsx`
  - Pass cover URLs to league cards.
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`
  - Render cover/avatar URLs on the league detail screen.

## Tasks

- [ ] Write RED tests for league media form fields and media upload helper behavior.
- [ ] Run the targeted tests and confirm they fail for missing media support.
- [ ] Add media fields to league contracts and frontend form schema/defaults.
- [ ] Add `generateUploadUrl` and read-side media URL resolution to league procedures.
- [ ] Implement the upload helper using `expo-image-picker`, `expo-image-manipulator`, and Convex upload URLs.
- [ ] Implement the local crop surface for banner/avatar aspect ratios.
- [ ] Wire details-tab banner/avatar controls into create/edit forms.
- [ ] Render resolved cover/avatar URLs in cards and public league details.
- [ ] Run targeted tests and fix until green.
- [ ] Run `bun run codegen`.
- [ ] Run `bun run typecheck`.
- [ ] Run `git diff --check`.
