# Active Actor Architecture Design

## Objective

Refactor the app around explicit actors before payments are added.

The current model uses `userId` for too many responsibilities: authentication,
player identity, organizer identity, league ownership, membership, permissions,
and notification recipient. That makes "login as player/organizer" confusing
and will become fragile when paid organizer plans and player participation
payments are introduced.

The app already has the Better Auth organization plugin installed. We should use
that plugin as the organizer/business actor instead of creating a parallel
organizer table.

The new model separates authentication from business actors:

- `user`: authentication identity only.
- `playerProfile`: player actor.
- `organization`: organizer/business actor from Better Auth.
- `activeActor`: current app context selected by the user.

Business rules must live in the backend. The mobile app should render backend
decisions, not recreate permission or notification rules locally.

## Non-Goals

- Do not implement multi-account login like Twitter in this refactor.
- Do not add another organizer table parallel to Better Auth organization.
- Do not implement payments in this refactor.
- Do not keep "login as player" or "login as organizer".

## Core Principles

1. Login authenticates a person, not a role.
2. Player and organizer are separate business actors under one authenticated
   user.
3. League ownership belongs to a Better Auth `organization`.
4. League participation belongs to `playerProfile`.
5. Notifications are addressed to an actor and delivered to the owning user's
   devices.
6. The backend decides what the active actor can see and do.
7. The frontend must not decide business permissions from raw ownership fields.
8. Payment rules must attach to the correct actor or business record from day
   one.

## Target Data Model

### `user`

Owned by Better Auth. It remains the authentication root.

Responsibilities:

- Email/password/social login identity.
- Apple/Google provider accounts.
- Session ownership.
- Device ownership for push delivery.

Not responsibilities:

- Direct league ownership.
- Direct league participation.
- Direct role permission decisions.

### `playerProfile`

The player actor for a user.

Current table already exists. It should remain one-to-one with `user` for now.

Responsibilities:

- Public player identity.
- Player profile data: name, nickname, gender, avatar, phone.
- League participation through `leagueMembership.playerProfileId`.
- Player-side payments in the future.

Backend creation rule:

- Always create on user signup/sign-in trigger.
- Keep using backend trigger. Do not create this from the app.

### `organization`

The organizer/business actor.

This table already exists because of Better Auth organization plugin. It should
become the owner of organizer-side resources.

Responsibilities:

- Organizer identity.
- League ownership through `league.organizationId`.
- Organization members, roles, invitations, and teams through Better Auth.
- Organizer-side paid plan in the future.

Why use Better Auth organization:

- It already provides `organization`, `member`, `team`, and `invitation`.
- It supports `owner`, `admin`, and `member` roles.
- It supports inviting other users to help manage organizer resources.
- It is the natural billing owner for organizer subscriptions.

Backend creation rule:

- Create a Better Auth organization when the user activates organizer mode or
  starts creating the first league.
- The app calls a backend mutation, but backend owns organization creation and
  membership setup.

### `viewerPreference`

Replace `userPreference` with `viewerPreference`.

Meaning:

- Stores only active actor preference.
- Does not by itself grant permissions.

Suggested fields:

```ts
userId: Id<"user">;
activeActorKind: "player" | "organization";
activeOrganizationId?: Id<"organization"> | null;
createdAt: Date;
updatedAt: Date;
```

Rules:

- `activeActorKind: "player"` means backend scopes the app to
  `playerProfile`.
- `activeActorKind: "organization"` requires `activeOrganizationId`.
- Backend must verify the user is a member of `activeOrganizationId`.
- If verification fails, backend falls back to player actor.

Because the app is still in development, do not preserve the old
`preferredMode` naming. Delete the old concept and use `activeActorKind`
everywhere.

## League Model

### `league`

Change ownership from:

```ts
managerUserId: Id<"user">
```

to:

```ts
organizationId: Id<"organization">
```

Backend rules:

- Creating a league requires active actor `organization`.
- Creating a league requires the active organization member to have permission
  to create/manage leagues.
- Free/paid plan limits are checked against `organizationId`.
- Management queries only return leagues owned by the active organization.

Frontend rule:

- Frontend never checks raw `organizationId` for permission.
- Frontend uses backend response fields like `canManage`, `availableActions`,
  or route-specific payloads.

### `leagueMembership`

Change participation from:

```ts
userId: Id<"user">
```

to:

```ts
playerProfileId: Id<"playerProfile">
```

Backend rules:

- Requesting to join a league uses active actor `player`.
- An organization actor cannot join as a player.
- Player payment to participate will attach to `leagueMembership`.
- Ranking, challenges, and membership requests serialize player data from
  `playerProfile`.

Frontend rule:

- Frontend receives already-filtered player lists and actions.
- Frontend does not infer player access from `userId`.

## Viewer Context API

Replace the current `viewer.context.get` shape with an actor-oriented response.

Suggested output:

```ts
{
  activeActor: {
    kind: "player" | "organization";
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  availableActors: Array<{
    kind: "player" | "organization";
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: "owner" | "admin" | "member";
    badgeCount: number;
  }>;
  capabilities: {
    canCreateLeague: boolean;
    canManageLeagues: boolean;
    canBrowseLeagues: boolean;
    canJoinLeagues: boolean;
  };
}
```

Rules:

- `player` is always available after auth because `playerProfile` is created by
  trigger.
- Organization actors are available from Better Auth `member` rows.
- Backend returns capabilities for the active actor.
- Capabilities are for rendering; backend still enforces every mutation/query.

Mutations:

- `viewer.context.setActiveActor({ actorKind: "player" })`
- `viewer.context.setActiveActor({ actorKind: "organization", organizationId })`
- `viewer.context.activateOrganization({ name })`

`activateOrganization` creates a Better Auth organization and makes the current
user the owner. If a user already has an organization, the backend should return
the existing organization or require the caller to choose one explicitly.

## Authentication UI

Remove:

- Login tabs for player/organizer.
- Signup mode param.
- `pendingPreferredMode`.
- `PreferredModeBootstrap`.

Keep:

- Email/password login.
- Apple login.
- Google login.
- Signup.

New flow:

1. User signs in.
2. App loads `viewer.context.get`.
3. Backend returns active actor and available actors.
4. Home renders according to active actor.
5. User can switch actor from a backend-backed actor switcher inside the app.

## App Navigation

The app should have a context switcher, not account switcher.

Suggested UX:

- Header/avatar opens a small menu or sheet.
- It shows "Jogador" and each available organization.
- If no organization exists, show "Ativar organizador".
- Switching calls backend mutation and invalidates context queries.

Player context:

- Home: participating leagues.
- Search: discover leagues/tournaments.
- League details: player view, request join, ranking, challenges.
- Notifications: player notifications only.

Organization context:

- Home: managed leagues and organization actions.
- Search can remain available, but it should not show player-only join actions
  unless backend allows them.
- League details: admin view for leagues owned by the active organization.
- Notifications: organization notifications only.

## Notification Model

Current problem:

- `notificationFeed` only has `recipientUserId`, so organization notifications
  appear while the user is using the player context.

Target:

```ts
recipientUserId: Id<"user">;
recipientActorKind: "player" | "organization";
recipientPlayerProfileId?: Id<"playerProfile"> | null;
recipientOrganizationId?: Id<"organization"> | null;
```

Rules:

- `recipientUserId` is for push delivery only.
- Actor fields decide feed visibility.
- `notification.feed.list` filters by active actor in backend.
- `notification.settings.status` unread count should default to active actor
  unread count.
- Push can still be delivered to the user's device even if the app is currently
  in another actor, but opening the notification should route into the matching
  actor context first.

Event mapping:

- `league.membership.requested`: organization recipient.
- `league.membership.approved`: player recipient.
- `league.membership.rejected`: player recipient.
- `league.membership.removed`: player recipient.
- Challenge events: player recipients.
- Admin validation events, if sent to league owner: organization recipient.

Backend rule:

- Callers should schedule notification recipients by actor where possible.
- If a legacy function still passes user ids, the orchestrator must resolve the
  correct actor from event type and league context before creating feed rows.

## Payment Readiness

Organization payments:

- Paid organizer plan attaches to `organization`.
- Free tier limits use `organizationId`.
- Example future tables: `organizationSubscription`,
  `organizationEntitlement`.

Player payments:

- Participation payment attaches to `leagueMembership`.
- Purchase history can reference `playerProfileId`.
- Example future tables: `leagueMembershipPayment`, `playerPaymentMethod`.

This separation prevents these future bugs:

- A player payment unlocking organization features.
- An organization subscription affecting player participation fees.
- Multiple leagues sharing wrong subscription state through raw `userId`.

## Backend API Rules

Every backend function must follow this pattern:

1. Resolve `viewerContext` from `ctx.userId`.
2. Resolve active actor.
3. Apply permission rules for that actor.
4. Query data scoped to that actor.
5. Return serialized data with allowed actions.

Example response pattern:

```ts
{
  league,
  viewer: {
    actorKind: "organization",
    canManage: true,
    membershipStatus: null,
    availableActions: ["edit", "approve_membership", "reorder_ranking"],
  }
}
```

The frontend should not compute `canManage` from `league.organizationId`.

## Better Auth Organization Usage

Use Better Auth organization for:

- Creating organization records.
- Current user's organization membership.
- Owner/admin/member roles.
- Future invitations.
- Future teams.
- Future staff access.

Do not use Better Auth organization for:

- Player participation in leagues.
- Ranking positions.
- Challenge participants.
- Player payments.

Those remain product-domain data under `playerProfile`, `leagueMembership`, and
league challenge tables.

## Migration Strategy

Because the app is not in production, destructive schema changes are allowed,
but they should still be deliberate.

Preferred sequence:

1. Remove role selection from auth UI.
2. Replace viewer mode language with active actor language.
3. Add backend organization activation around Better Auth organization tables.
4. Change league ownership to `organizationId`.
5. Change membership ownership to `playerProfileId`.
6. Change notification feed to actor-scoped recipients.
7. Update backend queries/mutations to resolve active actor.
8. Update frontend to consume backend decisions only.
9. Remove compatibility helpers and old mode files.

Codegen/schema steps:

- Update domain tables first.
- Keep `convex/functions/schema.ts` as composition-only.
- Run `bun run codegen`.
- Run `bun run typecheck`.
- Run `bun run check`.
- Run focused domain tests.

## Testing Strategy

Backend tests:

- New user gets player profile.
- Organization activation creates or selects a Better Auth organization.
- Player active actor cannot create league.
- Organization active actor can create league when member permissions allow it.
- Player active actor lists player notifications only.
- Organization active actor lists organization notifications only.
- League membership uses `playerProfileId`.
- League management uses `organizationId`.
- Future payment boundary tests assert plan scope is organization-only and
  participation scope is membership/player-only when payment tables are added.

Frontend tests or manual checks:

- Login screen has no player/organizer tabs.
- Signup screen has no mode param.
- Actor switcher changes context without logging out.
- Player context does not show admin actions.
- Organization context does not show player-only challenge actions unless
  backend explicitly allows it.
- Notification page changes when actor changes.

## Cleanup List

Remove or replace:

- `src/lib/auth/pending-preferred-mode.ts`
- `src/components/auth/preferred-mode-bootstrap.tsx`
- Login mode tabs in `src/app/(public)/sign-in.tsx`
- Signup `mode` param in `src/app/(public)/sign-up.tsx`
- `preferredMode` naming in domain/API/client code
- `canCreateResources` as a frontend-facing business rule name

Rename concepts:

- `UserMode` -> `ActorKind`
- `preferredMode` -> `activeActorKind`
- `organizer` mode -> `organization` actor
- `canCreateResources` -> backend-specific capabilities such as
  `canCreateLeague`

## Organization Activation Decision

When the user has no organization and taps organization context, show a
one-screen organizer activation flow.

Reason:

- It makes the actor boundary explicit.
- It creates the Better Auth organization intentionally.
- It gives the app a place to collect organization display name.
- It gives future billing or free-plan consent a natural entry point.
- It avoids silently creating paid-capable business identity from casual
  navigation.

## Final Decision

Use Better Auth organization as the organizer/business actor.

Do not create a parallel `organizerAccount` table. The cost of changing schema
now is lower than carrying `userId` ambiguity into payments, notifications, and
admin permissions.
