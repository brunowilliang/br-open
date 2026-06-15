# League Details Route And Store Refactor Design

## Objective

Refactor the league details flow in `br-open` so that:

- the league overview remains the primary `/leagues/[leagueId]` route
- `ranking`, `challenges`, `requests`, and `rules` move into dedicated routes
- shared state and derived league-detail business rules stop flowing through
  route props and are centralized in one feature store under `src/lib`
- each file in the feature has one obvious responsibility for a junior engineer

This design applies only to the league details flow. The create/edit league
flow is intentionally unchanged.

## Scope

This refactor covers:

- `src/app/(private)/leagues/[leagueId]/*`
- the league detail presentation components under
  `src/components/pages/leagues/*`
- the league detail helpers under `src/lib/leagues/*`
- installation and usage of `Legend-State` on the v3 documentation line

This refactor does not cover:

- `src/components/pages/leagues/screen.tsx`
- `src/components/pages/leagues/details.tsx`
- `src/components/pages/leagues/rules.tsx` used by create/edit
- `src/app/(private)/settings/leagues/*`
- Convex schema changes
- new backend endpoints unless the existing detail queries prove insufficient

## Non-Goals

- Do not redesign the create/edit league forms.
- Do not rewrite unrelated league features outside the details flow.
- Do not create multiple competing detail stores.
- Do not keep the current tab query-param model as a second navigation system.
- Do not move pure formatting logic into React components.
- Do not duplicate server state manually when React Query can remain the source
  of truth.

## Current Problems

The current `src/app/(private)/leagues/[leagueId]/index.tsx` route mixes too
many concerns:

- role switching between visitor, participant, and owner
- routing state through in-screen tabs
- query orchestration for overview, membership, challenges, and requests
- mutation wiring
- derived permissions and labels
- view-model assembly for multiple screens
- rendering of multiple operational surfaces inside one route

This creates four practical issues:

1. navigation is overloaded into one route instead of explicit screens
2. business rules are split between the route, helpers, and UI components
3. components receive fragmented props because there is no feature-level shared
   state boundary
4. a junior engineer cannot quickly identify where routing, state, business
   rules, and UI rendering each belong

## Target Navigation Model

The league details feature becomes a route cluster:

- `src/app/(private)/leagues/[leagueId]/_layout.tsx`
- `src/app/(private)/leagues/[leagueId]/index.tsx`
- `src/app/(private)/leagues/[leagueId]/ranking.tsx`
- `src/app/(private)/leagues/[leagueId]/challenges.tsx`
- `src/app/(private)/leagues/[leagueId]/requests.tsx`
- `src/app/(private)/leagues/[leagueId]/rules.tsx`

### Route Responsibilities

#### `index.tsx`

The overview route becomes the normal public-facing league details page.

It must:

- render the league overview surface
- show the correct role-aware CTA and summary state
- link to the operational routes instead of embedding operational tabs

It must not:

- render ranking, challenges, requests, or rules inline as tab content
- own the full operational state of the feature

#### `ranking.tsx`

This route owns only the ranking screen.

It must:

- render ranking data for participant and owner contexts
- support owner ranking management and participant challenge entry points

It must not:

- compute challengeability rules locally
- duplicate league-role checks already derived by the store

#### `challenges.tsx`

This route owns only the challenges screen.

It must:

- render the challenge flow
- use the existing challenge dialogs and mutations
- consume shared league detail state from the store

It must not:

- re-derive global role and route-access rules locally

#### `requests.tsx`

This route owns only membership requests.

It must:

- be available only to the `owner` role in this three-role model
- render pending requests and request actions

If a non-owner reaches this route, the route should redirect or fail closed
back to the overview flow rather than partially render.

#### `rules.tsx`

This route owns the complete read-only rules surface for league details.

It must:

- gather the league rule content into one dedicated screen
- keep rules out of the main overview screen
- expose the full league rule set relevant to details consumption

This route is a presentation route, not an editor. Editing remains in the
existing settings/edit flow.

## Role Model

The detail flow must preserve the three explicit viewer roles:

- `visitor`
- `participant`
- `owner`

These roles are derived from the existing viewer and league data:

- `owner`: `league.isManagerOwner === true` and organizer capabilities allow
  league management
- `participant`: viewer membership is active and the viewer is not acting as
  the managing owner
- `visitor`: neither owner nor active participant

The route cluster must enforce this model consistently:

- all three roles can open `index.tsx`
- participant and owner can open `ranking.tsx`
- participant and owner can open `challenges.tsx`
- owner only can open `requests.tsx`
- all viewers who can open league details can open `rules.tsx`

## Shared Store Design

The refactor uses one feature store rooted in:

- `src/lib/leagues/league-details-store.ts`

The store must live under `src/lib`, per project direction.

### Legend-State Version

The current official documentation line requested for this refactor is
`Legend-State v3`.

On June 8, 2026, the latest published package on that line is:

- `@legendapp/state@3.0.0-beta.47`

The current stable package line is still `2.1.15`, but that is not the line
requested for this refactor. The implementation should intentionally target
`@legendapp/state@3.0.0-beta.47` and its documented React bindings under
`@legendapp/state/react`.

### Store Shape

There must be one root store instance for the feature. To avoid cross-league
state collisions while still honoring the “single store” rule, the store should
organize state by `leagueId`.

Target shape:

```ts
type LeagueDetailsRole = "visitor" | "participant" | "owner";

type LeagueDetailsRoute =
  | "overview"
  | "ranking"
  | "challenges"
  | "requests"
  | "rules";

type LeagueDetailsFeatureState = {
  identity: {
    leagueId: string;
    activeRoute: LeagueDetailsRoute;
    bootstrapStatus: "idle" | "bootstrapping" | "ready" | "error";
  };
  viewer: {
    actorKind: "player" | "organization" | null;
    actorId: string | null;
    membershipStatus: string | null;
    role: LeagueDetailsRole;
  };
  data: {
    league: unknown | null;
    membershipOverview: unknown | null;
    challenges: unknown[];
    occupiedSlots: unknown[];
  };
  derived: {
    canManageLeague: boolean;
    canAccessMemberContext: boolean;
    canOpenRanking: boolean;
    canOpenChallenges: boolean;
    canOpenRequests: boolean;
    joinActionLabel: string;
    rankingItems: unknown[];
    requestItems: unknown[];
    viewerPosition: number | null;
    challengeCounts: {
      main: number;
      mine: number;
      admin: number;
    };
    rulesView: unknown;
  };
  actions: {
    bootstrap: () => void;
    hydrateOverview: () => void;
    hydrateMembershipOverview: () => void;
    hydrateChallenges: () => void;
    hydrateOccupiedSlots: () => void;
    setActiveRoute: (route: LeagueDetailsRoute) => void;
    resetLeague: () => void;
  };
};
```

The actual implementation types must use the real API output shapes from the
existing CRPC/Convex contracts, not `unknown`.

The implementation should use this as one imported feature store, not a React
Context tree plus a second store layer. The root store is singular; the
per-`leagueId` bucket is an internal organization detail.

### Store Responsibilities

The store owns:

- feature identity for the active `leagueId`
- resolved viewer role inside the league details experience
- derived permissions for each route
- derived labels, counts, lists, and rule sections
- shared view-model state that should survive navigation within the league
  detail cluster

The store does not own:

- raw fetching lifecycle for server state
- mutation execution
- one-off modal toggles that are purely local to one screen and do not need to
  survive route changes

### React Query Boundary

React Query remains the source of truth for server state:

- queries
- mutations
- invalidation
- refetching

Legend-State becomes the source of truth for feature-level shared state and
derived presentation/business state:

- viewer role
- route access
- CTA labels
- ranking/request view models
- challenge counters
- rules sections ready to render

The mutation flow must stay disciplined:

1. route triggers mutation
2. mutation invalidates the relevant React Query data
3. fresh query data rehydrates the store
4. observer-driven screens rerender from store changes

This avoids building a fragile second data cache by hand.

## Data Loading Strategy

The refactor should not preload every dataset just because all routes belong to
one feature.

### `_layout.tsx` bootstrap

The layout should bootstrap only the common feature state:

- `leagueId`
- viewer context
- league overview payload from `league.discovery.getById`

This is enough to resolve:

- role
- high-level route permissions
- overview rendering
- rules-route baseline data

### Route-level hydration

Each operational route hydrates the additional data it actually needs:

- `ranking.tsx`: membership overview
- `challenges.tsx`: challenges + occupied slots
- `requests.tsx`: membership overview if not already current
- `rules.tsx`: no extra fetch if the overview payload already contains the full
  rule configuration needed for display

This keeps the overview route light and avoids paying the cost of the entire
feature on first open.

## File-by-File Responsibility Map

### Routes

- `src/app/(private)/leagues/[leagueId]/_layout.tsx`
  - feature boundary
  - bootstrap entrypoint
  - route-level access coordination
- `src/app/(private)/leagues/[leagueId]/index.tsx`
  - overview route only
- `src/app/(private)/leagues/[leagueId]/ranking.tsx`
  - ranking route only
- `src/app/(private)/leagues/[leagueId]/challenges.tsx`
  - challenges route only
- `src/app/(private)/leagues/[leagueId]/requests.tsx`
  - owner-only membership requests route
- `src/app/(private)/leagues/[leagueId]/rules.tsx`
  - rules route only

### Store and Pure Lib

- `src/lib/leagues/league-details-store.ts`
  - one root store instance
  - per-league buckets
  - actions for bootstrap and hydration
  - derived state for all league detail screens
- `src/lib/leagues/*`
  - pure calculators, formatters, and guards only
  - no route rendering
  - no prop orchestration

### UI Components

- `src/components/pages/leagues/preview.tsx`
  - overview presentation
  - no broad route orchestration
- `src/components/pages/leagues/ranking.tsx`
  - ranking UI
  - minimal local interaction state only
- `src/components/pages/leagues/challenges.tsx`
  - challenges UI and dialog composition
  - no global role logic duplication
- `src/components/pages/leagues/membership-requests.tsx`
  - requests UI only

### Explicitly Out Of This Refactor

- `src/components/pages/leagues/screen.tsx`
- `src/components/pages/leagues/details.tsx`
- `src/components/pages/leagues/rules.tsx` for form editing

## Audit Rules For Existing Files

Every touched file in the league details scope must end in exactly one of these
roles:

- route coordinator
- store/shared state
- pure helper
- UI component
- dead file removed

The audit standard is:

- if a file decides permissions, role, CTA, and navigation together, that
  logic belongs in the route/store boundary, not inside UI
- if a file only formats or calculates deterministic output from inputs, it
  stays in `src/lib/leagues`
- if a file needs `leagueId`, viewer role, and multiple datasets at once, it
  should depend on the shared store instead of a fragmented prop contract
- if a file only needs temporary local state for a single interaction, that
  state may stay local

## Component-Specific Refactor Direction

### `preview.tsx`

Keep it as the overview presentation surface.

Move out:

- route access logic
- broad CTA derivation
- any league-detail state assembly that depends on multiple datasets

Keep in place:

- presentation-oriented formatting that clearly belongs to the rendered surface

### `ranking.tsx`

Reduce it to ranking UI and ranking-local interactions.

Move out:

- challengeability derivation
- viewer role decisions
- any repeated knowledge about whether the viewer can manage or challenge

Keep local:

- item selection
- drag state
- confirmation dialog visibility

### `challenges.tsx`

This is the densest file in the feature and must be simplified carefully.

Move out:

- global route-access checks
- cross-route counts
- broad challenge-filter view-model derivation when it does not need local UI
  state

Keep local only if it is truly screen-specific:

- open/close state for dialogs
- selected challenge targets
- route-local tab/filter UI state if it does not need to survive navigation

Extraction here must be responsibility-driven, not cosmetic. The goal is fewer
mixed concerns, not more tiny files for their own sake.

### `membership-requests.tsx`

This component is already close to UI-only and should remain simple.

The preferred outcome is:

- items already prepared by the store
- component renders the list
- component emits approve/reject intents

## Rules Route Design

The overview route should stop trying to explain the full ruleset inline.

Instead:

- overview links to a dedicated `rules` route
- `rules.tsx` renders the complete read-only rules breakdown
- all rules content that belongs to “how this league works” is concentrated in
  that route

The rules route should explain at least:

- ranking movement rules
- challenge limits and response deadlines
- validation modes
- walkover behavior
- inactivity penalties
- match format and scoring configuration

This route must use the overview’s `ruleConfig` snapshot where possible rather
than inventing a second rules query.

## Performance Rules

The refactor must improve readability without regressing runtime behavior.

Required performance constraints:

- no eager loading of challenges and membership data on the overview route
- no broad observer subscriptions to unrelated store branches when a screen only
  needs one slice
- no duplicate expensive derived calculations inside render paths when they can
  live as computed state or pure helpers
- no second cache layer that tries to mirror every query field manually
- keep ephemeral UI state local instead of promoting everything into the global
  store

## Testing Strategy

The refactor should shift tests toward stable units.

Preferred test coverage:

- pure helper tests stay in `src/lib/leagues/*.test.ts`
- new store-focused tests validate:
  - role derivation
  - route access derivation
  - ranking/request item mapping
  - challenge count derivation
  - rules section derivation
- route-level verification ensures:
  - overview no longer depends on in-screen tabs
  - forbidden routes fail closed for the wrong role

Required verification before handoff:

- `git diff --check`
- `bun run typecheck`
- `bun run check`

If dependency installation or codegen becomes necessary during implementation,
the implementation plan must call it out explicitly.

## Migration Strategy

This refactor is large, but the implementation should still move in a controlled
order:

1. create the route cluster structure and feature layout
2. add the single feature store under `src/lib`
3. move overview to `index.tsx` without operational tabs
4. move ranking to `ranking.tsx`
5. move challenges to `challenges.tsx`
6. move requests to `requests.tsx` with owner guard
7. add `rules.tsx`
8. audit and remove obsolete tab/query-param logic
9. audit touched `src/lib/leagues/*` and `src/components/pages/leagues/*` files
   so each ends in one clear responsibility

The final state matters more than preserving intermediate structure. The route
cluster, store boundary, and responsibility split must all be complete by the
end of the work.

## Expected End State

After this refactor, a junior engineer should be able to inspect the tree and
understand it quickly:

- overview route is in `index.tsx`
- ranking route is in `ranking.tsx`
- challenges route is in `challenges.tsx`
- requests route is in `requests.tsx`
- rules route is in `rules.tsx`
- shared feature state lives in `src/lib/leagues/league-details-store.ts`
- pure calculations live in `src/lib/leagues/*`
- page components mostly render UI

That is the primary success criterion for this refactor, together with removing
tab-based operational routing and eliminating fragmented league-detail prop
drilling.
