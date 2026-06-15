# Active Actor Organization Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace role-login behavior with a backend-owned active actor model where `playerProfile` is the player actor and Better Auth `organization` is the organizer actor.

**Architecture:** Authentication stays user-based. Product actions are scoped by an active actor resolved on the backend: `playerProfile` for player flows and Better Auth `organization` plus `member` for organizer flows. The app receives capabilities and already-filtered data instead of recreating business rules.

**Tech Stack:** Expo Router, React Native, Better Auth, Convex, kitcn ORM, oRPC/cRPC, Zod, Bun tests.

---

## Scope Check

The spec touches four coupled subsystems: auth/viewer context, league ownership, league membership/challenges, and notifications. Execute in the order below because each task leaves the app in a type-checkable state and prevents frontend business-rule drift.

## File Structure

- Create `convex/domains/auth/actor-context.ts`: pure Zod schemas, actor types, capability builder, and validation helpers.
- Modify `convex/domains/auth/tables.ts`: replace `userPreference.preferredMode` with active actor fields.
- Modify `convex/domains/auth/relations.ts`: remove user-owned league relation and add organization-owned league relation.
- Modify `convex/domains/auth/triggers.ts`: create default viewer preference with player actor.
- Modify `convex/functions/viewer/context.ts`: backend source of truth for active actor and actor switching.
- Modify `convex/domains/league/tables.ts`: change `league.managerUserId` to `organizationId` and `leagueMembership.userId` to `playerProfileId`.
- Modify `convex/domains/league/relations.ts`: point league ownership to organization and membership to player profile.
- Modify `convex/domains/league/contract.ts`: rename serialized fields to `organizationId` and `playerProfileId`, keep compatibility only if current UI still needs `userId`.
- Modify `convex/functions/league/*.ts`: replace user-mode checks with backend actor-context checks.
- Modify `convex/domains/notification/tables.ts`: add actor recipient fields to `notificationFeed`.
- Modify `convex/functions/notification/*.ts`: list, unread, mark, remove, and delivery remain user-owned but feed visibility is actor-scoped.
- Modify `src/app/(public)/sign-in.tsx` and `src/app/(public)/sign-up.tsx`: remove login/signup role mode.
- Delete `src/lib/auth/pending-preferred-mode.ts` and `src/components/auth/preferred-mode-bootstrap.tsx`.
- Modify settings/home screens to consume `viewer.context.get.capabilities` and `activeActor`.

## Task 1: Actor Context Domain

**Files:**

- Create: `convex/domains/auth/actor-context.ts`
- Modify: `convex/domains/auth/tests/user-preference.test.ts`

- [ ] **Step 1: Replace mode tests with actor-context tests**

Replace `convex/domains/auth/tests/user-preference.test.ts` with:

```ts
import { describe, expect, it } from "bun:test";

import {
  DEFAULT_ACTOR_KIND,
  buildViewerCapabilities,
  resolveActorKind,
} from "../actor-context";

describe("actor context", () => {
  it("defaults viewers to player actor", () => {
    expect(DEFAULT_ACTOR_KIND).toBe("player");
    expect(resolveActorKind(null)).toBe("player");
    expect(resolveActorKind(undefined)).toBe("player");
    expect(resolveActorKind("invalid")).toBe("player");
  });

  it("allows player actors to browse and join leagues", () => {
    expect(buildViewerCapabilities({ actorKind: "player" })).toEqual({
      canBrowseLeagues: true,
      canCreateLeague: false,
      canJoinLeagues: true,
      canManageLeagues: false,
    });
  });

  it("allows organization actors to create and manage leagues", () => {
    expect(buildViewerCapabilities({ actorKind: "organization" })).toEqual({
      canBrowseLeagues: true,
      canCreateLeague: true,
      canJoinLeagues: false,
      canManageLeagues: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test convex/domains/auth/tests/user-preference.test.ts
```

Expected: FAIL because `convex/domains/auth/actor-context.ts` does not exist.

- [ ] **Step 3: Add actor-context domain**

Create `convex/domains/auth/actor-context.ts`:

```ts
import { z } from "zod";

export const actorKindOptions = ["player", "organization"] as const;
export const DEFAULT_ACTOR_KIND = "player";

export const actorKindSchema = z.enum(actorKindOptions);

export const viewerActorSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  displayName: z.string().min(1),
  id: z.string().min(1),
  kind: actorKindSchema,
  role: z.enum(["owner", "admin", "member"]).optional(),
});

export const viewerCapabilitiesSchema = z.object({
  canBrowseLeagues: z.boolean(),
  canCreateLeague: z.boolean(),
  canJoinLeagues: z.boolean(),
  canManageLeagues: z.boolean(),
});

export const setActiveActorSchema = z.discriminatedUnion("actorKind", [
  z.object({ actorKind: z.literal("player") }),
  z.object({
    actorKind: z.literal("organization"),
    organizationId: z.string().min(1),
  }),
]);

export const activateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organizacao."),
});

export const viewerContextSchema = z.object({
  activeActor: viewerActorSchema,
  availableActors: z.array(viewerActorSchema),
  capabilities: viewerCapabilitiesSchema,
});

export type ActorKind = z.infer<typeof actorKindSchema>;
export type ViewerActor = z.infer<typeof viewerActorSchema>;
export type ViewerContext = z.infer<typeof viewerContextSchema>;

export function resolveActorKind(value?: null | string): ActorKind {
  const parsedKind = actorKindSchema.safeParse(value);

  return parsedKind.success ? parsedKind.data : DEFAULT_ACTOR_KIND;
}

export function buildViewerCapabilities(input: {
  actorKind: ActorKind;
}) {
  const isOrganization = input.actorKind === "organization";

  return viewerCapabilitiesSchema.parse({
    canBrowseLeagues: true,
    canCreateLeague: isOrganization,
    canJoinLeagues: !isOrganization,
    canManageLeagues: isOrganization,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bun test convex/domains/auth/tests/user-preference.test.ts
```

Expected: PASS.

## Task 2: Viewer Preference Schema And Trigger

**Files:**

- Modify: `convex/domains/auth/tables.ts`
- Modify: `convex/domains/auth/triggers.ts`
- Modify: `convex/domains/auth/tests/triggers.test.ts`
- Modify: `convex/domains/auth/tests/delete-actions.test.ts`
- Delete: `convex/domains/auth/user-preference.ts`

- [ ] **Step 1: Update tests for active actor default**

In `convex/domains/auth/tests/triggers.test.ts`, replace the `ensureInitialUserPreference` expectation with active actor fields:

```ts
expect(insertedValues).toMatchObject({
  activeActorKind: "player",
  activeOrganizationId: null,
  userId: "user_123",
});
```

In `convex/domains/auth/tests/delete-actions.test.ts`, keep the cascade assertion but point it to the same table after the column rename:

```ts
expect(getOnDeleteAction(authTables.userPreference.userId)).toBe("cascade");
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun test convex/domains/auth/tests
```

Expected: FAIL because `userPreference` still writes `preferredMode`.

- [ ] **Step 3: Change `userPreference` table columns**

In `convex/domains/auth/tables.ts`, replace the `userPreference` definition with:

```ts
export const userPreference = convexTable(
  "userPreference",
  {
    activeActorKind: text().notNull(),
    activeOrganizationId: id("organization").references(() => organization.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (userPreference) => [
    index("activeOrganizationId").on(userPreference.activeOrganizationId),
  ]
);
```

- [ ] **Step 4: Change auth trigger default preference**

In `convex/domains/auth/triggers.ts`, update `ensureInitialUserPreference` to insert:

```ts
{
  activeActorKind: DEFAULT_ACTOR_KIND,
  activeOrganizationId: null,
  createdAt: now,
  updatedAt: now,
  userId,
}
```

Import `DEFAULT_ACTOR_KIND` from `./actor-context` and remove imports from `./user-preference`.

- [ ] **Step 5: Remove old user-preference domain file**

Delete `convex/domains/auth/user-preference.ts` after all imports have moved to `actor-context.ts`.

- [ ] **Step 6: Run tests**

Run:

```bash
bun test convex/domains/auth/tests
```

Expected: PASS.

## Task 3: Backend Viewer Context

**Files:**

- Modify: `convex/functions/viewer/context.ts`
- Modify: `convex/shared/api.ts` after codegen
- Modify: `convex/functions/generated/server.ts` after codegen
- Modify: `convex/functions/generated/viewer/context.runtime.ts` after codegen

- [ ] **Step 1: Replace viewer context functions**

Replace `convex/functions/viewer/context.ts` with an implementation that:

```ts
import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";
import {
  activateOrganizationSchema,
  buildViewerCapabilities,
  resolveActorKind,
  setActiveActorSchema,
  viewerContextSchema,
  type ActorKind,
  type ViewerActor,
} from "../../domains/auth/actor-context";
import { organization, member, userPreference } from "../../domains/auth/tables";
import { authMutation, authQuery } from "../../lib/crpc";

type ViewerCtx = QueryCtx | MutationCtx;

async function getPlayerActor(ctx: ViewerCtx, userId: Id<"user">) {
  const [user, playerProfile] = await Promise.all([
    ctx.orm.query.user.findFirst({ where: { id: userId } }),
    ctx.orm.query.playerProfile.findFirst({ where: { userId } }),
  ]);

  if (!(user && playerProfile)) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Perfil de jogador nao encontrado.",
    });
  }

  return {
    avatarUrl: null,
    displayName: playerProfile.nickname?.trim() || playerProfile.fullName || user.name,
    id: playerProfile.id,
    kind: "player",
  } satisfies ViewerActor;
}
```

Continue the file with helpers that query `member` by `userId`, load organizations, validate active organization membership, and return:

```ts
return viewerContextSchema.parse({
  activeActor,
  availableActors,
  capabilities: buildViewerCapabilities({ actorKind: activeActor.kind }),
});
```

Use these public procedures:

```ts
export const get = authQuery.output(viewerContextSchema).query(({ ctx }) =>
  getViewerContext(ctx, ctx.userId)
);

export const setActiveActor = authMutation
  .input(setActiveActorSchema)
  .output(viewerContextSchema)
  .mutation(async ({ ctx, input }) => {
    await upsertViewerPreference(ctx, ctx.userId, {
      activeActorKind: input.actorKind,
      activeOrganizationId:
        input.actorKind === "organization"
          ? (input.organizationId as Id<"organization">)
          : null,
    });

    return getViewerContext(ctx, ctx.userId);
  });

export const activateOrganization = authMutation
  .input(activateOrganizationSchema)
  .output(viewerContextSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const slug = `${input.name.trim().toLowerCase().replaceAll(" ", "-")}-${Date.now()}`;
    const [createdOrganization] = await ctx.orm
      .insert(organization)
      .values({
        createdAt: now,
        metadata: {},
        name: input.name.trim(),
        slug,
        updatedAt: now,
      })
      .returning();

    await ctx.orm.insert(member).values({
      createdAt: now,
      organizationId: createdOrganization.id as Id<"organization">,
      role: "owner",
      userId: ctx.userId,
    });

    await upsertViewerPreference(ctx, ctx.userId, {
      activeActorKind: "organization",
      activeOrganizationId: createdOrganization.id as Id<"organization">,
    });

    return getViewerContext(ctx, ctx.userId);
  });
```

Use `eq(userPreference.userId, userId)` for updates and verify membership before accepting `organizationId`.

- [ ] **Step 2: Run typecheck to expose generated API drift**

Run:

```bash
bun run typecheck
```

Expected: FAIL until `bun run codegen` updates generated procedure names.

- [ ] **Step 3: Regenerate kitcn artifacts**

Run:

```bash
bun run codegen
```

Expected: generated API now exposes `viewer.context.setActiveActor` and `viewer.context.activateOrganization`.

- [ ] **Step 4: Run focused typecheck**

Run:

```bash
bun run typecheck:convex
```

Expected: PASS for backend or actionable errors only in callers still importing `setPreferredMode`.

## Task 4: League Ownership And Membership Schema

**Files:**

- Modify: `convex/domains/league/tables.ts`
- Modify: `convex/domains/league/relations.ts`
- Modify: `convex/domains/auth/relations.ts`
- Modify: `convex/domains/league/contract.ts`
- Modify: `convex/domains/auth/tests/delete-actions.test.ts`

- [ ] **Step 1: Update schema tests**

In `convex/domains/auth/tests/delete-actions.test.ts`, change league expectations:

```ts
expect(getOnDeleteAction(leagueTables.league.organizationId)).toBe("cascade");
expect(getOnDeleteAction(leagueTables.leagueMembership.playerProfileId)).toBe(
  "cascade"
);
```

- [ ] **Step 2: Change league and membership table columns**

In `convex/domains/league/tables.ts`, replace `managerUserId` and `userId` ownership with:

```ts
organizationId: id("organization")
  .notNull()
  .references(() => authTables.organization.id, { onDelete: "cascade" }),
```

and:

```ts
playerProfileId: id("playerProfile")
  .notNull()
  .references(() => playerTables.playerProfile.id, { onDelete: "cascade" }),
```

Import `* as playerTables from "../player/tables";`.

Update indexes:

```ts
(league) => [index("organizationId").on(league.organizationId)]
```

and:

```ts
index("leagueId_playerProfileId").on(
  leagueMembership.leagueId,
  leagueMembership.playerProfileId
),
index("playerProfileId_status").on(
  leagueMembership.playerProfileId,
  leagueMembership.status
),
```

- [ ] **Step 3: Update relations**

In `convex/domains/league/relations.ts`, change:

```ts
organization: r.one.organization({
  from: r.league.organizationId,
  to: r.organization.id,
}),
```

and:

```ts
playerProfile: r.one.playerProfile({
  from: r.leagueMembership.playerProfileId,
  to: r.playerProfile.id,
}),
```

In `convex/domains/auth/relations.ts`, move `managedLeagues` from `user` to `organization`:

```ts
managedLeagues: r.many.league({
  from: r.organization.id,
  to: r.league.organizationId,
}),
```

- [ ] **Step 4: Update serialized contract names**

In `convex/domains/league/contract.ts`, change:

```ts
organizationId: z.string().min(1, "Organizacao invalida."),
```

inside `leagueSchema`, and:

```ts
playerProfileId: z.string().min(1, "Jogador invalido."),
```

inside `leagueMembershipSchema` and `leagueChallengeParticipantSchema`.

- [ ] **Step 5: Regenerate and typecheck**

Run:

```bash
bun run codegen
bun run typecheck:convex
```

Expected: generated data model points league ownership to organization and membership ownership to player profile.

## Task 5: Backend League Authorization

**Files:**

- Create: `convex/functions/viewer/actor-context.ts`
- Modify: `convex/functions/league/management.ts`
- Modify: `convex/functions/league/discovery.ts`
- Modify: `convex/functions/league/membership.ts`
- Modify: `convex/functions/league/challenges.ts`

- [ ] **Step 1: Create backend actor resolver for functions**

Create `convex/functions/viewer/actor-context.ts` with exported helpers:

```ts
export async function requireActiveOrganization(ctx: AuthenticatedCtx<QueryCtx | MutationCtx>) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);

  if (viewerContext.activeActor.kind !== "organization") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Ative uma organizacao para gerenciar ligas.",
    });
  }

  return viewerContext.activeActor.id as Id<"organization">;
}

export async function requireActivePlayerProfile(ctx: AuthenticatedCtx<QueryCtx | MutationCtx>) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);

  if (viewerContext.activeActor.kind !== "player") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Ative seu perfil de jogador para participar.",
    });
  }

  return viewerContext.activeActor.id as Id<"playerProfile">;
}
```

Export `getViewerContext` from `convex/functions/viewer/context.ts` so these helpers reuse exactly the same backend decision.

- [ ] **Step 2: Update management functions**

In `convex/functions/league/management.ts`:

- Replace `requireOrganizerMode(ctx)` calls with `const organizationId = await requireActiveOrganization(ctx)`.
- Replace `where: { managerUserId: ctx.userId }` with `where: { organizationId }`.
- Insert `organizationId` on create.
- Replace update/delete `eq(league.managerUserId, currentLeague.managerUserId)` with `eq(league.organizationId, currentLeague.organizationId)`.

- [ ] **Step 3: Update discovery functions**

In `convex/functions/league/discovery.ts`:

- Resolve viewer context once per query.
- `isManagerOwner` becomes true only when active actor is organization and `currentLeague.organizationId === activeActor.id`.
- Viewer membership queries use active player profile id and `playerProfileId`.
- `listParticipating` queries by `playerProfileId` when active actor is player and returns `[]` when active actor is organization.

- [ ] **Step 4: Update membership functions**

In `convex/functions/league/membership.ts`:

- Replace `getMembershipByLeagueAndUser` with `getMembershipByLeagueAndPlayerProfile`.
- `requestJoin` requires active player profile unless active organization owns the league and is adding itself through an explicit admin path later.
- Approval/reject/remove/reorder require active organization and `league.organizationId === activeOrganizationId`.
- Player summaries load from `playerProfileId` directly.
- Notification recipients for membership request target `organizationId`; membership review target `playerProfileId`.

- [ ] **Step 5: Update challenge functions**

In `convex/functions/league/challenges.ts`:

- Active player access uses `playerProfileId` -> active membership.
- Admin challenge actions require active organization and league ownership.
- Participant serialization returns `playerProfileId`.
- Challenge notifications target recipient memberships by `playerProfileId`.

- [ ] **Step 6: Run backend typecheck**

Run:

```bash
bun run typecheck:convex
```

Expected: PASS.

## Task 6: Actor-Scoped Notifications

**Files:**

- Modify: `convex/domains/notification/tables.ts`
- Modify: `convex/domains/notification/relations.ts`
- Modify: `convex/domains/notification/contract.ts`
- Modify: `convex/functions/notification/events.ts`
- Modify: `convex/functions/notification/orchestrator.ts`
- Modify: `convex/functions/notification/feed.ts`
- Modify: `convex/functions/notification/settings.ts`

- [ ] **Step 1: Add actor recipient fields**

In `notificationFeed`, add:

```ts
recipientActorKind: text().notNull(),
recipientOrganizationId: id("organization").references(
  () => authTables.organization.id,
  { onDelete: "cascade" }
),
recipientPlayerProfileId: id("playerProfile").references(
  () => playerTables.playerProfile.id,
  { onDelete: "cascade" }
),
```

Import `* as playerTables from "../player/tables";`.

Add indexes:

```ts
index("recipientUserId_actorKind_isRead").on(
  notificationFeed.recipientUserId,
  notificationFeed.recipientActorKind,
  notificationFeed.isRead
),
index("recipientUserId_actorKind_occurredAt").on(
  notificationFeed.recipientUserId,
  notificationFeed.recipientActorKind,
  notificationFeed.occurredAt
),
index("recipientPlayerProfileId_occurredAt").on(
  notificationFeed.recipientPlayerProfileId,
  notificationFeed.occurredAt
),
index("recipientOrganizationId_occurredAt").on(
  notificationFeed.recipientOrganizationId,
  notificationFeed.occurredAt
),
```

- [ ] **Step 2: Update notification contract**

Add to `notificationFeedItemSchema`:

```ts
recipientActorKind: z.enum(["player", "organization"]),
recipientOrganizationId: z.string().nullable(),
recipientPlayerProfileId: z.string().nullable(),
```

- [ ] **Step 3: Change orchestrator input**

Replace `recipientUserIds` with:

```ts
recipients: z
  .array(
    z.discriminatedUnion("actorKind", [
      z.object({
        actorKind: z.literal("player"),
        playerProfileId: z.string().min(1),
      }),
      z.object({
        actorKind: z.literal("organization"),
        organizationId: z.string().min(1),
      }),
    ])
  )
  .min(1),
```

Resolve each recipient to `recipientUserId`:

- player recipient: load `playerProfile` and use `playerProfile.userId`.
- organization recipient: load `member` rows for owner/admin members and create one feed item per member.

- [ ] **Step 4: Filter feed by active actor**

In `notification/feed.ts`, resolve active actor before list, mark-all-read, and remove-all. Query by user id and actor kind, then filter exact actor id:

```ts
const belongsToActiveActor =
  activeActor.kind === "player"
    ? notification.recipientPlayerProfileId === activeActor.id
    : notification.recipientOrganizationId === activeActor.id;
```

`markRead` and `remove` must reject notifications that do not belong to the active actor even when `recipientUserId === ctx.userId`.

- [ ] **Step 5: Filter unread count by active actor**

In `notification/settings.ts`, count unread feed rows only for the active actor. Device readiness and `pushEnabled` remain user-level because push permission is a device/user setting.

- [ ] **Step 6: Run generated checks**

Run:

```bash
bun run codegen
bun run typecheck:convex
```

Expected: PASS.

## Task 7: Auth UI Cleanup

**Files:**

- Modify: `src/app/(public)/sign-in.tsx`
- Modify: `src/app/(public)/sign-up.tsx`
- Delete: `src/lib/auth/pending-preferred-mode.ts`
- Delete: `src/components/auth/preferred-mode-bootstrap.tsx`
- Modify: any layout importing `PreferredModeBootstrap`

- [ ] **Step 1: Remove pending preferred mode imports**

In `sign-in.tsx`, remove:

```ts
import { Tabs } from "heroui-native";
import { useState } from "react";
import {
  clearPendingPreferredMode,
  savePendingPreferredMode,
} from "@/lib/auth/pending-preferred-mode";
import type { UserMode } from "@convex/domains/auth/user-preference";
```

Keep `useState` only if Apple pending state still needs it.

- [ ] **Step 2: Remove mode state and tabs**

Delete:

```ts
const [activeMode, setActiveMode] = useState<UserMode>("player");
const modeDescription = ...
const submitLabel = ...
function handleModeChange(value: string) { ... }
```

Replace submit label with:

```tsx
<Button.Label>{isSubmitPending ? "Entrando..." : "Entrar"}</Button.Label>
```

Remove the `<Tabs>` block and mode description.

- [ ] **Step 3: Remove mode persistence from auth actions**

In email, Apple, and Google handlers, remove all calls to `savePendingPreferredMode` and `clearPendingPreferredMode`.

- [ ] **Step 4: Remove signup mode params**

In `sign-up.tsx`, remove `useLocalSearchParams`, `preferredMode`, and pending mode storage. Use static copy:

```tsx
<Text className="text-center text-base text-muted">
  Crie sua conta para acompanhar ligas, torneios e resultados.
</Text>
```

Navigate to signup without params:

```ts
router.navigate("/sign-up");
```

- [ ] **Step 5: Delete obsolete files**

Delete:

```bash
src/lib/auth/pending-preferred-mode.ts
src/components/auth/preferred-mode-bootstrap.tsx
```

Remove any layout import/render of `PreferredModeBootstrap`.

- [ ] **Step 6: Typecheck app**

Run:

```bash
bun run typecheck
```

Expected: PASS or remaining errors only from frontend actor context changes in the next task.

## Task 8: Frontend Actor Context Consumption

**Files:**

- Modify: `src/app/(private)/(tabs)/index.tsx`
- Modify: `src/app/(private)/settings/index.tsx`
- Modify: `src/app/(private)/settings/leagues/index.tsx`
- Modify: `src/app/(private)/settings/leagues/new.tsx`
- Modify: `src/app/(private)/settings/leagues/[leagueId]/edit.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`

- [ ] **Step 1: Replace old capability names**

Replace:

```ts
viewerContext.data?.canCreateResources ?? false
```

with:

```ts
viewerContext.data?.capabilities.canManageLeagues ?? false
```

or:

```ts
viewerContext.data?.capabilities.canCreateLeague ?? false
```

depending on the screen.

- [ ] **Step 2: Make home active-actor aware**

In home, use:

```ts
const isOrganizationActor =
  viewerContext.data?.activeActor.kind === "organization";
```

If `isOrganizationActor`, query managed leagues. Otherwise query participating leagues. Render empty states based on backend capabilities only.

- [ ] **Step 3: Keep settings menu backend-driven**

In settings, filter Ligas by:

```ts
item.requiresOrganization && !viewerContext.data?.capabilities.canManageLeagues
```

Use `requiresOrganization` instead of `requiresOrganizer`.

- [ ] **Step 4: Do not compute admin rights in league details**

In league detail screen, replace local checks based on manager ownership with backend response fields. If the backend response does not yet expose a needed action, add that field to the backend contract first.

- [ ] **Step 5: Typecheck full app**

Run:

```bash
bun run typecheck
```

Expected: PASS.

## Task 9: Final Verification

**Files:**

- All touched files.

- [ ] **Step 1: Regenerate generated artifacts**

Run:

```bash
bun run codegen
```

Expected: no schema ownership drift in `convex/functions/schema.ts`; it remains composition-only.

- [ ] **Step 2: Run full checks**

Run:

```bash
bun run typecheck
bun run check
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Manual smoke test**

Run:

```bash
bun run convex:dev
bun run dev
```

Manual checks:

- Sign in with email, Apple, and Google without role tabs.
- Home loads as player by default.
- Player context does not show league management actions.
- Activate organization creates Better Auth organization and switches context.
- Organization context can create and manage leagues.
- Player notification feed does not show organization notifications.
- Organization notification feed does not show player notifications.

## Self-Review

- Spec coverage: auth actor model, Better Auth organization usage, league ownership, membership ownership, notification scoping, UI cleanup, and payment boundaries are all represented.
- Placeholder scan: no `TBD`, `TODO`, or unspecified "handle later" steps remain.
- Type consistency: actor kind values are consistently `"player" | "organization"`, and organizer business identity is consistently Better Auth `organization`.
