# League Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first working `Desafios` flow so active league players can challenge each other with a full proposal, negotiate only `data`, `horário`, and `quadra`, and let the league/admin control challenge and result validation.

**Architecture:** Extend the existing league rule config with two validation modes, persist challenges in dedicated league tables, and keep the scheduling negotiation as a proposal-history model with a single active proposal. Reuse the public league route under `/leagues/[leagueId]`, turn the current ranking `Desafiar` button into the creation entrypoint, and centralize player/admin challenge handling in focused page components under `src/components/pages/leagues`.

**Tech Stack:** Expo Router, React Native, HeroUI Native, HeroUI Native Pro, Convex, kitcn, Zod, TanStack Query, Bun test, Ultracite.

---

## File Structure

- Modify: `convex/domains/league/contract.ts`
  - Add challenge validation mode enums, challenge/proposal/result schemas, and score payload typing.
- Modify: `convex/domains/league/tables.ts`
  - Add `leagueChallenge`, `leagueChallengeProposal`, and `leagueChallengeResultSubmission` tables with indexes for the active workflows.
- Modify: `convex/domains/league/relations.ts`
  - Add challenge/proposal/result relations back to `league` and `leagueMembership`.
- Create: `convex/domains/league/challenge-rules.ts`
  - Pure helpers for allowed actions, slot blocking, deadline resets, and lifecycle transitions.
- Create: `convex/domains/league/tests/challenge-rules.test.ts`
  - TDD coverage for negotiation, lock, blocking, expiry, and admin-review gates.
- Create: `convex/functions/league/challenges.ts`
  - Player/admin queries and mutations for create, negotiate, cancel, result submission, and admin decisions.
- Modify: `src/components/pages/leagues/rules.tsx`
  - Add `Validação do desafio` and `Validação do resultado`.
- Modify: `src/components/pages/leagues/ranking.tsx`
  - Convert the viewer-side `Desafiar` button from placeholder to callback-driven behavior.
- Create: `src/components/pages/leagues/challenges.tsx`
  - Main challenge list and action surface for players and admin.
- Create: `src/components/pages/leagues/challenge-proposal-dialog.tsx`
  - Dialog to create a challenge or send a counterproposal with `data`, `horário`, and `quadra`.
- Create: `src/components/pages/leagues/challenge-result-dialog.tsx`
  - Dialog to submit or correct the score using the challenge match-config snapshot.
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`
  - Add the `Desafios` tab and wire ranking-to-challenge flow.

## Task 1: Extend the League Rules Contract for Challenge Validation

**Files:**
- Modify: `convex/domains/league/contract.ts`
- Modify: `src/components/pages/leagues/rules.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`

- [ ] Add the new rule-config enums and defaults inside `contract.ts`.

```ts
export const LeagueChallengeValidationModeOptions = [
  "automatic",
  "manual",
] as const;

export const LeagueResultValidationModeOptions = [
  "automatic",
  "manual",
] as const;
```

- [ ] Add both fields to `ChallengeRuleConfigSchema`, with backward-compatible defaults for legacy leagues.

```ts
challengeValidationMode: z
  .enum(LeagueChallengeValidationModeOptions)
  .default("automatic")
  .catch("automatic"),
resultValidationMode: z
  .enum(LeagueResultValidationModeOptions)
  .default("automatic")
  .catch("automatic"),
```

- [ ] Add the two controls to `src/components/pages/leagues/rules.tsx` inside `Regras > Desafios`, following the existing short-label + description pattern already used on that screen.

```tsx
<Segment
  options={[
    { label: "Automática", value: "automatic" },
    { label: "Manual", value: "manual" },
  ]}
  value={value.challengeValidationMode}
/>
```

- [ ] Extend the public rule presentation in `src/app/(private)/leagues/[leagueId]/index.tsx` so the `Desafios` section shows both validation modes in readable Portuguese.

- [ ] Run code generation and typecheck after the contract changes.

Run: `bun run codegen`  
Expected: `Convex api ready!`

Run: `bun run typecheck`  
Expected: no TypeScript errors.

## Task 2: Add Dedicated Challenge Tables and Relations

**Files:**
- Modify: `convex/domains/league/tables.ts`
- Modify: `convex/domains/league/relations.ts`

- [ ] Add a `leagueChallenge` table that stores the main lifecycle state and the match snapshot.

```ts
export const leagueChallenge = convexTable(
  "leagueChallenge",
  {
    leagueId: id("league").notNull().references(() => league.id),
    challengerMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    challengedMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    status: text().notNull(),
    currentProposalId: text(),
    challengeValidationMode: text().notNull(),
    resultValidationMode: text().notNull(),
    matchConfigSnapshot: json<Record<string, unknown>>().notNull(),
    lockedAt: timestamp(),
    confirmedAt: timestamp(),
    finishedAt: timestamp(),
    cancelledAt: timestamp(),
    invalidatedAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (leagueChallenge) => [
    index("leagueId_status").on(leagueChallenge.leagueId, leagueChallenge.status),
    index("challengerMembershipId_status").on(
      leagueChallenge.challengerMembershipId,
      leagueChallenge.status
    ),
    index("challengedMembershipId_status").on(
      leagueChallenge.challengedMembershipId,
      leagueChallenge.status
    ),
  ]
);
```

- [ ] Add a `leagueChallengeProposal` table with one row per proposal/counterproposal and the active scheduling window.

```ts
export const leagueChallengeProposal = convexTable(
  "leagueChallengeProposal",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id),
    proposedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    courtId: text().notNull(),
    matchDate: text().notNull(),
    startMinute: integer().notNull(),
    endMinute: integer().notNull(),
    responseDeadlineAt: timestamp().notNull(),
    revisionNumber: integer().notNull(),
    status: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (leagueChallengeProposal) => [
    index("challengeId_revisionNumber").on(
      leagueChallengeProposal.challengeId,
      leagueChallengeProposal.revisionNumber
    ),
    index("courtId_matchDate").on(
      leagueChallengeProposal.courtId,
      leagueChallengeProposal.matchDate
    ),
  ]
);
```

- [ ] Add a `leagueChallengeResultSubmission` table with the latest result-review loop.

```ts
export const leagueChallengeResultSubmission = convexTable(
  "leagueChallengeResultSubmission",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id),
    submittedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    confirmedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id
    ),
    adminReviewedByUserId: id("user").references(() => authTables.user.id),
    reviewAction: text(),
    score: json<Record<string, unknown>>().notNull(),
    winnerMembershipId: id("leagueMembership").references(
      () => leagueMembership.id
    ),
    submittedAt: timestamp().notNull(),
    confirmedAt: timestamp(),
    reviewedAt: timestamp(),
  },
  (leagueChallengeResultSubmission) => [
    index("challengeId_submittedAt").on(
      leagueChallengeResultSubmission.challengeId,
      leagueChallengeResultSubmission.submittedAt
    ),
  ]
);
```

- [ ] Add relations from `league`, `leagueMembership`, `leagueChallenge`, `leagueChallengeProposal`, and `leagueChallengeResultSubmission` so the ORM can navigate the feature cleanly.

- [ ] Run code generation after schema changes.

Run: `bun run codegen`  
Expected: generated Convex artifacts updated with the new tables.

## Task 3: Add Pure Challenge Rules and Test Them First

**Files:**
- Create: `convex/domains/league/challenge-rules.ts`
- Create: `convex/domains/league/tests/challenge-rules.test.ts`

- [ ] Create status constants and active blocking states in the pure domain file.

```ts
export const ACTIVE_CHALLENGE_BLOCKING_STATUSES = new Set([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "pending_admin_challenge_validation",
  "confirmed",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
] as const);
```

- [ ] Add helpers for:
  - next response deadline
  - who can answer the active proposal
  - whether a slot is blocked
  - whether players can cancel
  - next status after acceptance
  - next status after score confirmation

- [ ] Write the first failing tests for the agreed lifecycle.

```ts
it("resets the response deadline on each counterproposal", () => {
  const nextDeadline = buildResponseDeadline({
    now: new Date("2026-05-21T12:00:00Z"),
    responseDeadlineHours: 48,
  });

  expect(nextDeadline.toISOString()).toBe("2026-05-23T12:00:00.000Z");
});

it("locks into pending admin validation when both players agree and the league is manual", () => {
  expect(
    resolveAcceptedChallengeStatus({
      challengeValidationMode: "manual",
    })
  ).toBe("pending_admin_challenge_validation");
});
```

- [ ] Add tests for the core business rules you already closed in the spec:
  - multiple counterproposals but one active proposal
  - accepted proposal locks
  - expired silence goes to admin decision
  - date passed without score becomes pending result
  - players can cancel only before scheduled time
  - blocking states reserve the slot

- [ ] Run the targeted tests before backend implementation.

Run: `bun test convex/domains/league/tests/challenge-rules.test.ts`  
Expected: failing assertions for the not-yet-implemented helpers.

- [ ] Implement the minimal helper code and rerun.

Run: `bun test convex/domains/league/tests/challenge-rules.test.ts`  
Expected: all tests pass.

## Task 4: Implement Challenge Contracts and the Convex Challenge API

**Files:**
- Modify: `convex/domains/league/contract.ts`
- Create: `convex/functions/league/challenges.ts`
- Modify: `convex/functions/league/membership.ts`

- [ ] Add schemas for challenge creation, proposal response, cancellation, score submission, score confirmation, and admin decisions.

```ts
export const CreateLeagueChallengeSchema = z.object({
  leagueId: z.string().min(1),
  challengedMembershipId: z.string().min(1),
  courtId: z.string().min(1),
  matchDate: z.string().min(1),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
});
```

- [ ] In `convex/functions/league/challenges.ts`, add shared guards:
  - get active membership for current user
  - load challenge with league and memberships
  - assert current user is challenger, challenged player, or manager
  - assert selected court belongs to the league
  - assert slot is available and not blocked

- [ ] Implement player mutations:
  - `create`
  - `acceptProposal`
  - `declineProposal`
  - `counterPropose`
  - `cancel`
  - `submitResult`
  - `confirmResult`

- [ ] Implement admin mutations:
  - `approveChallenge`
  - `rejectChallenge`
  - `approveResult`
  - `requestResultCorrection`
  - `invalidateMatch`
  - `decideExpiredResponse`
  - `decidePendingResult`

- [ ] Implement list/detail queries:
  - `listForLeague`
  - `listForViewer`
  - `getById`
  - `getCounts`

- [ ] Reuse `leagueMembership` helper patterns instead of duplicating membership lookup logic. If a reusable membership helper becomes necessary, extract only the truly shared pieces from `membership.ts` into a narrow local helper in the same file family.

- [ ] Run code generation and typecheck after adding the CRPC procedures.

Run: `bun run codegen`  
Expected: generated API types include `league.challenges.*`.

Run: `bun run typecheck`  
Expected: no missing procedure/type errors.

## Task 5: Wire the Ranking Button to Real Challenge Creation

**Files:**
- Modify: `src/components/pages/leagues/ranking.tsx`
- Create: `src/components/pages/leagues/challenge-proposal-dialog.tsx`

- [ ] Extend `RankingProps` so the viewer-side `Desafiar` button can call outward instead of `onPress={() => undefined}`.

```ts
type RankingProps = {
  // existing props...
  onChallengePress?: (item: RankingItem) => void;
};
```

- [ ] Keep the current rule that the challenge button only appears when the viewer can legally challenge that ranking position.

- [ ] Create `challenge-proposal-dialog.tsx` with:
  - opponent summary
  - read-only match-config summary
  - date field
  - start time
  - end time
  - court select from league courts
  - primary button to send proposal

- [ ] Keep the dialog limited to `data`, `horário`, and `quadra`. Do not allow editing match rules here.

- [ ] Reuse the same dialog for counterproposal mode, with current proposal values prefilled and the button label changed to `Reenviar proposta`.

## Task 6: Add the `Desafios` Player/Admin Surface to the Public League Route

**Files:**
- Create: `src/components/pages/leagues/challenges.tsx`
- Create: `src/components/pages/leagues/challenge-result-dialog.tsx`
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`

- [ ] Add a new `Desafios` tab to the public league route.

Assumed visibility for v1:
- owner: sees `Desafios`
- active member: sees `Desafios`
- non-member or pending member: does not see `Desafios`

- [ ] In `index.tsx`, fetch the new challenge queries only when the tab is visible to the current viewer.

- [ ] Build `src/components/pages/leagues/challenges.tsx` as the single challenge surface with two modes:
  - player mode
  - admin mode

- [ ] In player mode, show at minimum:
  - `Recebidos`
  - `Enviados`
  - `Ativos`
  - `Histórico`

- [ ] In admin mode, show at minimum:
  - `Todos`
  - `Validação de desafios`
  - `Validação de resultados`
  - `Decisões pendentes`

- [ ] Create `challenge-result-dialog.tsx` so one player can submit the score and the other can confirm it later.

Recommended score draft shape for v1:

```ts
type ChallengeScoreInput = {
  winnerMembershipId: string;
  sets: Array<{
    challengerGames: number;
    challengedGames: number;
    kind: "set" | "super_tiebreak";
  }>;
};
```

- [ ] Keep score-entry validation driven by the challenge `matchConfigSnapshot`, not by the current league settings.

## Task 7: Add Admin Actions and Result-Review Loops

**Files:**
- Modify: `src/components/pages/leagues/challenges.tsx`
- Modify: `src/components/pages/leagues/challenge-result-dialog.tsx`

- [ ] In the challenge detail card/dialog, show the current proposal, proposal history, and the available actions for the current state.

- [ ] In admin mode, expose the exact actions from the spec:
  - approve challenge
  - reject challenge
  - approve result
  - request correction
  - invalidate match
  - decide expired response
  - decide pending result

- [ ] When the admin requests result correction, send the challenge back to a player-visible correction state instead of closing it.

- [ ] When the admin invalidates a match, close it without ranking side effects and release the slot.

- [ ] Make the UI text explicit so users understand whether they are waiting on:
  - the opponent
  - admin challenge validation
  - result confirmation
  - admin result validation
  - admin decision

## Task 8: Verification and Smoke Pass

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-league-challenges-design.md` only if implementation-time naming drift forces a spec sync

- [ ] Run the domain tests again.

Run: `bun test convex/domains/league/tests/challenge-rules.test.ts`  
Expected: PASS

- [ ] Run code generation after the full backend surface is in place.

Run: `bun run codegen`  
Expected: generated API artifacts updated cleanly.

- [ ] Run repo checks.

Run: `bun run typecheck`  
Expected: PASS

Run: `bun run check`  
Expected: PASS

Run: `git diff --check`  
Expected: no whitespace or conflict-marker issues.

- [ ] Smoke-check the exact v1 story:
  - owner opens league rules and sets validation modes
  - active player sees `Desafiar` only when allowed by ranking distance
  - challenger sends full proposal
  - opponent counterproposes
  - deadline is reset
  - opponent/challenger accepts and locks proposal
  - manual challenge validation blocks the slot
  - one player submits score
  - other confirms score
  - manual result validation lets admin approve, request correction, or invalidate
  - history remains visible after completion
