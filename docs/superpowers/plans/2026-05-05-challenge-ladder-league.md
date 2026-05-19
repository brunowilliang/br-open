# Challenge Ladder League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first BR Open league template as a configurable challenge ladder, with public league routes under `/leagues` and league management routes under `/settings/leagues`.

**Architecture:** The first delivery treats league as its own domain, separate from tournaments. League state is split into five layers: league metadata, memberships, challenge rules, challenge lifecycle, and ranking ledger. Public/player flows live in `src/app/(private)/leagues`, while manager CRUD and operational screens live in `src/app/(private)/settings/leagues`.

**Tech Stack:** Expo Router, React Native, HeroUI Native, Convex, kitcn, Zod, TanStack Query, Bun test.

---

## Domain Convention

- Domain source:
  `convex/domains/league`
- Shared contract:
  `convex/domains/league/contract.ts`
- Table builders:
  `convex/domains/league/tables.ts`
- Pure league rules:
  `convex/domains/league/rules.ts`
- Domain tests:
  `convex/domains/league/tests`

## Route Convention

- Public/player surface:
  `src/app/(private)/leagues`
- Management surface:
  `src/app/(private)/settings/leagues`
- Deployable backend functions:
  `convex/functions/league/*`

## Default Challenge Ladder Config

```ts
{
  maxChallengeDistance: 3,
  maxActiveChallengesPerPlayer: 2,
  maxChallengesPerMonth: 4,
  responseDeadlineHours: 48,
  matchDeadlineDays: 5,
  inactivityDropDays: 15,
  inactivityBottomDays: 30,
  resetLimitsMonthly: true,
  winBehavior: "swap_positions",
  lossBehavior: "keep_positions",
  walkoverBehavior: "automatic_loss"
}
```

### Task 1: Schema and Shared Validation

**Files:**
- Modify: `convex/functions/schema.ts`
- Create: `convex/domains/league/contract.ts`
- Create: `convex/domains/league/tables.ts`
- Modify: `convex/shared/api.ts`

- [ ] Add `league`, `leagueMembership`, `leagueSeason`, `leagueChallenge`, and `leagueRankingEvent` tables to [schema.ts](/Users/brunogarcia/Documents/Dev/projects/br-open/convex/functions/schema.ts).
- [ ] Keep `league.type` constrained to `challenge_ladder` for the first release, but store `ruleVersion` and `ruleConfig` so new templates can be added later without schema churn.
- [ ] Add indexes for `slug`, `managerUserId`, `status`, `leagueId + status`, `leagueId + currentPosition`, `leagueId + challengerUserId`, and `leagueId + challengedUserId`.
- [ ] Create [contract.ts](/Users/brunogarcia/Documents/Dev/projects/br-open/convex/domains/league/contract.ts) with schemas for `ChallengeLadderRuleConfigSchema`, `CreateLeagueSchema`, `UpdateLeagueSchema`, `JoinLeagueSchema`, `ApproveLeagueMembershipSchema`, `CreateLeagueChallengeSchema`, and `SubmitLeagueChallengeResultSchema`.
- [ ] Create [tables.ts](/Users/brunogarcia/Documents/Dev/projects/br-open/convex/domains/league/tables.ts) with the league table builders used by [schema.ts](/Users/brunogarcia/Documents/Dev/projects/br-open/convex/functions/schema.ts).
- [ ] Run `bun run codegen`.
- [ ] Run `bun run typecheck`.

### Task 2: Pure League Rules

**Files:**
- Create: `convex/domains/league/rules.ts`
- Create: `convex/domains/league/tests/rules.test.ts`

- [ ] Implement pure helpers for `canCreateChallenge`, `buildChallengeDeadlines`, `resolveChallengeResult`, `applyInactivityPenalty`, and `getNextMonthlyWindow`.
- [ ] Keep the helpers free of Convex context so they only consume typed inputs and return typed outputs.
- [ ] Cover the base rules in [rules.test.ts](/Users/brunogarcia/Documents/Dev/projects/br-open/convex/domains/league/tests/rules.test.ts):
  `cannot challenge more than configured distance`,
  `cannot exceed active challenges limit`,
  `cannot exceed monthly challenge limit`,
  `win swaps positions`,
  `loss keeps positions`,
  `walkover becomes automatic loss`,
  `15 day inactivity drops one position`,
  `30 day inactivity moves member to the end`.
- [ ] Run `bun test convex/domains/league/tests/rules.test.ts`.

### Task 3: League Management and Membership API

**Files:**
- Create: `convex/functions/league/management.ts`
- Create: `convex/functions/league/memberships.ts`
- Modify: `convex/shared/api.ts`

- [ ] Add management queries and mutations for create, update, list managed leagues, and get manager detail.
- [ ] Add membership mutations for join request, approve, reject, remove, leave, and set initial ranking position.
- [ ] Enforce that only the league manager can mutate management routes.
- [ ] When a member becomes active, guarantee a deterministic ranking position:
  new approved member enters at the end unless the manager explicitly places them.
- [ ] Write a `leagueRankingEvent` row for membership approval, removal, manual reposition, and admin adjustment.
- [ ] Run `bun run codegen`.
- [ ] Run `bun run typecheck`.

### Task 4: Challenge Lifecycle and Ranking API

**Files:**
- Create: `convex/functions/league/challenges.ts`
- Create: `convex/functions/league/ranking.ts`
- Create: `convex/functions/league/public.ts`

- [ ] Add public/player queries for public league detail, ranking, members list, challenge history, and current player challenge state.
- [ ] Add mutations to create a challenge, accept, decline, cancel before acceptance, submit result, and mark walkover.
- [ ] Validate every mutation through the pure helpers from `convex/domains/league/rules.ts`.
- [ ] On result submission, update both members' positions and persist the change through `leagueRankingEvent` instead of silent overwrites.
- [ ] Keep challenge statuses explicit:
  `pending_response`,
  `accepted`,
  `declined`,
  `expired_response`,
  `scheduled`,
  `finished`,
  `walkover`,
  `cancelled`.
- [ ] Run `bun run codegen`.
- [ ] Run `bun run typecheck`.

### Task 5: Public League Screens

**Files:**
- Create: `src/app/(private)/leagues/index.tsx`
- Create: `src/app/(private)/leagues/[leagueId]/index.tsx`
- Create: `src/app/(private)/leagues/[leagueId]/ranking.tsx`
- Create: `src/app/(private)/leagues/[leagueId]/challenges.tsx`
- Create: `src/app/(private)/leagues/[leagueId]/members.tsx`
- Create: `src/components/leagues/league-card.tsx`
- Create: `src/components/leagues/league-ranking-list.tsx`
- Create: `src/components/leagues/league-challenge-list.tsx`

- [ ] Build the player-facing league discovery list with status, city/state, and member count.
- [ ] Build the league detail screen with join request CTA, rule summary, recent movement, and quick links to ranking and challenges.
- [ ] Build ranking and challenges screens around the public API only. Do not put management actions here.
- [ ] Reuse the existing `Page` and `Header` layout patterns already present in `src/app/(private)`.
- [ ] Run `bun run typecheck`.

### Task 6: Settings League Management Screens

**Files:**
- Create: `src/app/(private)/settings/leagues/index.tsx`
- Create: `src/app/(private)/settings/leagues/new.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/index.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/general.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/rules.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/members.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/approvals.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/ranking.tsx`
- Create: `src/app/(private)/settings/leagues/[leagueId]/challenges.tsx`
- Create: `src/components/leagues/league-form.tsx`
- Create: `src/components/leagues/league-rule-form.tsx`

- [ ] Build the manager index with leagues owned by the current user.
- [ ] Build the create/edit flows around the `challenge_ladder` template and expose only controlled fields from the default config.
- [ ] Keep all operational actions here:
  approve member,
  reject member,
  remove member,
  adjust position with reason,
  review challenge history,
  review rule config.
- [ ] Add a manager landing page at `/settings/leagues/[leagueId]` that links to general settings, rules, members, approvals, ranking, and challenges.
- [ ] Run `bun run typecheck`.

### Task 7: Scheduled Operations and Audit Guarantees

**Files:**
- Modify: `convex/functions/crons.ts` or create it if still missing
- Create: `convex/functions/league/maintenance.ts`

- [ ] Add a daily maintenance job to expire unanswered challenges, mark overdue matches as walkover when configured, and apply inactivity penalties.
- [ ] Add a monthly maintenance job to reset per-member challenge counters when `resetLimitsMonthly` is enabled.
- [ ] Make every maintenance mutation idempotent by checking current status before writing.
- [ ] Persist maintenance-driven ranking movement through `leagueRankingEvent`.
- [ ] Run `bun run typecheck`.

### Task 8: Verification Pass

**Files:**
- Modify: `project-plan.md`

- [ ] Confirm [project-plan.md](/Users/brunogarcia/Documents/Dev/projects/br-open/project-plan.md) stays aligned with the route split:
  public in `/leagues`,
  management in `/settings/leagues`.
- [ ] Verify the first release only supports `challenge_ladder`, but the stored `type`, `ruleVersion`, and `ruleConfig` are ready for later templates.
- [ ] Run `bun run typecheck`.
- [ ] Run targeted smoke checks after the routes exist:
  sign in,
  create league,
  request entry,
  approve player,
  create challenge,
  submit result,
  verify ranking swap.

## Definition of Done

- A league manager can create a `challenge_ladder` league in `/settings/leagues/new`.
- A player can discover the league in `/leagues`, request entry, and see public ranking.
- The manager can approve the player and place them in the ranking.
- A player can challenge another player within the configured distance limit.
- Result submission updates ranking positions automatically and creates ranking ledger events.
- Daily and monthly maintenance rules run without duplicating ranking updates.
