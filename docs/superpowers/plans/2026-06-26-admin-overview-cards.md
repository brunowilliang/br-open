# AdminOverview Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AdminOverview` placeholder with a management dashboard: two conditional alert widgets (join requests, pending validations) and a 2×2 grid of metric cards (occupation, monthly matches, ongoing challenges, activity rate), mirroring the `ParticipantOverview` structure.

**Architecture:** Two files, same pattern as participant. Pure, testable builders in `src/lib/leagues/admin-overview-derived.ts` (no React, return `null` when not applicable). A thin React component in `src/components/pages/leagues/admin-overview.tsx` reads from the existing league-details bucket$ and renders alerts + grid with zero inline business logic. No new Convex fetches — all data is already hydrated in the bucket$ for the `owner` role.

**Tech Stack:** React Native + Expo Router, `@legendapp/state` (observable store), `heroui-native` (Card/Alert), `@hugeicons/core-free-icons`, `better-styled` (cn), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-26-admin-overview-cards-design.md`

---

## File Structure

- **Modify:** `src/lib/leagues/challenge-tab-counts.ts` — export the two status sets (`ADMIN_ATTENTION_STATUSES`, `ADMIN_ONGOING_STATUSES`) so the admin module can reuse them without duplication.
- **Create:** `src/lib/leagues/admin-overview-derived.ts` — pure builders + types.
- **Create:** `src/lib/leagues/admin-overview-derived.test.ts` — `bun:test` coverage for every builder.
- **Modify:** `src/components/pages/leagues/admin-overview.tsx` — replace the placeholder with the dashboard.

---

## Task 1: Export status sets from challenge-tab-counts

**Files:**
- Modify: `src/lib/leagues/challenge-tab-counts.ts:51-65`

The two status sets are currently private. Export them so the admin module reuses the exact same classification (no drift).

- [ ] **Step 1: Make the two sets exported**

In `src/lib/leagues/challenge-tab-counts.ts`, change the two `const` declarations to `export const`:

```ts
export const ADMIN_ATTENTION_STATUSES = new Set<ChallengeTabCountItem["status"]>([
  "pending_admin_challenge_validation",
  "pending_admin_result_validation",
  "pending_admin_decision",
  "pending_result_correction",
]);

export const ADMIN_ONGOING_STATUSES = new Set<ChallengeTabCountItem["status"]>([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
]);
```

- [ ] **Step 2: Run typecheck to confirm the export doesn't break existing usage**

Run: `bun run typecheck`
Expected: PASS (existing internal references still work; export only widens visibility).

- [ ] **Step 3: Commit**

```bash
git add src/lib/leagues/challenge-tab-counts.ts
git commit -m "refactor(league): export admin status sets for reuse in overview"
```

---

## Task 2: Write failing tests for alert builders

**Files:**
- Create: `src/lib/leagues/admin-overview-derived.test.ts`

We test the alert builders first (TDD): join requests and pending validations, plus `summarizeAdminPendingActions`.

- [ ] **Step 1: Create the test file with alert builder tests**

Create `src/lib/leagues/admin-overview-derived.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  buildAdminJoinRequestsAlert,
  buildAdminValidationsAlert,
  summarizeAdminPendingActions,
  type ChallengeStatus,
} from "./admin-overview-derived";

function makeChallenge(status: ChallengeStatus) {
  return {
    status,
    challenger: { membershipId: "m-1", playerProfileId: "p-1" },
    challenged: { membershipId: "m-2", playerProfileId: "p-2" },
  } as never;
}

describe("buildAdminJoinRequestsAlert", () => {
  it("returns null when there are no pending requests", () => {
    expect(buildAdminJoinRequestsAlert({ pendingRequestsCount: 0 })).toBeNull();
  });

  it("returns the count when there are pending requests", () => {
    expect(buildAdminJoinRequestsAlert({ pendingRequestsCount: 3 })).toEqual({
      total: 3,
    });
  });
});

describe("buildAdminValidationsAlert", () => {
  it("returns null when no challenges need admin attention", () => {
    expect(
      buildAdminValidationsAlert({
        challenges: [
          makeChallenge("confirmed"),
          makeChallenge("finished"),
        ],
      })
    ).toBeNull();
  });

  it("groups admin-attention statuses into actions", () => {
    const result = buildAdminValidationsAlert({
      challenges: [
        makeChallenge("pending_admin_challenge_validation"),
        makeChallenge("pending_admin_challenge_validation"),
        makeChallenge("pending_admin_result_validation"),
        makeChallenge("pending_admin_decision"),
        makeChallenge("pending_result_correction"),
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.total).toBe(5);
    expect(result?.actions).toHaveLength(5);
  });
});

describe("summarizeAdminPendingActions", () => {
  it("returns empty string for no actions", () => {
    expect(summarizeAdminPendingActions([])).toBe("");
  });

  it("summarizes each kind with pt-BR pluralization, joined by ' · '", () => {
    const summary = summarizeAdminPendingActions([
      { kind: "challenge_validation" },
      { kind: "challenge_validation" },
      { kind: "result_approval" },
      { kind: "decision" },
      { kind: "result_correction" },
    ]);

    expect(summary).toBe(
      "2 desafios para validar · 1 resultado para aprovar · 1 disputa para decidir · 1 placar para corrigir"
    );
  });

  it("uses singular form for a single item", () => {
    const summary = summarizeAdminPendingActions([
      { kind: "challenge_validation" },
    ]);

    expect(summary).toBe("1 desafio para validar");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/leagues/admin-overview-derived.test.ts`
Expected: FAIL — module `./admin-overview-derived` does not exist yet.

- [ ] **Step 3: Commit (red)**

```bash
git add src/lib/leagues/admin-overview-derived.test.ts
git commit -m "test(league): add failing tests for admin alert builders"
```

---

## Task 3: Implement alert builders

**Files:**
- Modify: `src/lib/leagues/admin-overview-derived.ts` (create)

- [ ] **Step 1: Create the derived module with alert builders + shared types**

Create `src/lib/leagues/admin-overview-derived.ts`:

```ts
import type { ApiOutputs } from "@convex/shared/api";

import {
  ADMIN_ATTENTION_STATUSES,
  ADMIN_ONGOING_STATUSES,
} from "./challenge-tab-counts";

export type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type ChallengeStatus = ChallengeItem["status"];

export type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];

// ----- Alerts -----

export type AdminJoinRequestsAlert = { total: number };

export type AdminPendingActionKind =
  | "challenge_validation"
  | "decision"
  | "result_approval"
  | "result_correction";

export type AdminPendingAction = { kind: AdminPendingActionKind };

export type AdminValidationsAlert = {
  actions: AdminPendingAction[];
  total: number;
};

const ATTENTION_STATUS_TO_KIND: Record<
  Extract<
    ChallengeStatus,
    | "pending_admin_challenge_validation"
    | "pending_admin_result_validation"
    | "pending_admin_decision"
    | "pending_result_correction"
  >,
  AdminPendingActionKind
> = {
  pending_admin_challenge_validation: "challenge_validation",
  pending_admin_result_validation: "result_approval",
  pending_admin_decision: "decision",
  pending_result_correction: "result_correction",
};

export function buildAdminJoinRequestsAlert(input: {
  pendingRequestsCount: number;
}): AdminJoinRequestsAlert | null {
  if (input.pendingRequestsCount <= 0) {
    return null;
  }

  return { total: input.pendingRequestsCount };
}

export function buildAdminValidationsAlert(input: {
  challenges: ChallengeItem[];
}): AdminValidationsAlert | null {
  const actions: AdminPendingAction[] = [];

  for (const challenge of input.challenges) {
    const kind = ATTENTION_STATUS_TO_KIND[
      challenge.status as keyof typeof ATTENTION_STATUS_TO_KIND
    ];

    if (kind) {
      actions.push({ kind });
    }
  }

  if (actions.length === 0) {
    return null;
  }

  return { actions, total: actions.length };
}

const KIND_LABEL: Record<AdminPendingActionKind, { one: string; many: string }> = {
  challenge_validation: {
    one: "desafio para validar",
    many: "desafios para validar",
  },
  result_approval: {
    one: "resultado para aprovar",
    many: "resultados para aprovar",
  },
  decision: { one: "disputa para decidir", many: "disputas para decidir" },
  result_correction: {
    one: "placar para corrigir",
    many: "placares para corrigir",
  },
};

// Ordem estável para o resumo, independente da ordem dos status no input.
const SUMMARY_ORDER: AdminPendingActionKind[] = [
  "challenge_validation",
  "result_approval",
  "decision",
  "result_correction",
];

export function summarizeAdminPendingActions(
  actions: AdminPendingAction[]
): string {
  const counts: Record<AdminPendingActionKind, number> = {
    challenge_validation: 0,
    decision: 0,
    result_approval: 0,
    result_correction: 0,
  };

  for (const action of actions) {
    counts[action.kind] += 1;
  }

  const parts: string[] = [];

  for (const kind of SUMMARY_ORDER) {
    const count = counts[kind];
    if (count === 0) {
      continue;
    }
    const label = count === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many;
    parts.push(`${count} ${label}`);
  }

  return parts.join(" · ");
}

// Re-export so the component can import status sets from a single place if needed.
export { ADMIN_ATTENTION_STATUSES, ADMIN_ONGOING_STATUSES };
```

- [ ] **Step 2: Run alert tests to verify they pass**

Run: `bun test src/lib/leagues/admin-overview-derived.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/leagues/admin-overview-derived.ts src/lib/leagues/admin-overview-derived.test.ts
git commit -m "feat(league): add admin alert builders for join requests and validations"
```

---

## Task 4: Write failing tests for metric card builders

**Files:**
- Modify: `src/lib/leagues/admin-overview-derived.test.ts`

Add tests for the four metric card builders.

- [ ] **Step 1: Append metric card tests to the test file**

Append to `src/lib/leagues/admin-overview-derived.test.ts` (add imports at the top, then the describes):

Add to the existing import block:

```ts
import {
  buildAdminActivityRateCard,
  buildAdminJoinRequestsAlert,
  buildAdminMonthlyMatchesCard,
  buildAdminOngoingChallengesCard,
  buildAdminOccupationCard,
  buildAdminValidationsAlert,
  summarizeAdminPendingActions,
  type ChallengeStatus,
} from "./admin-overview-derived";
```

Then append these describes at the end of the file:

```ts
const NOW = new Date("2026-06-15T12:00:00Z").getTime();
const MONTH_START = new Date("2026-06-15T12:00:00Z");
MONTH_START.setDate(1);
MONTH_START.setHours(0, 0, 0, 0);
const MONTH_START_MS = MONTH_START.getTime();

function makeFinishedChallenge(
  finishedAt: number,
  challengerMembershipId = "m-1",
  challengedMembershipId = "m-2"
) {
  return {
    status: "finished",
    finishedAt,
    challenger: { membershipId: challengerMembershipId, playerProfileId: "p-1" },
    challenged: { membershipId: challengedMembershipId, playerProfileId: "p-2" },
  } as never;
}

describe("buildAdminOccupationCard", () => {
  it("shows remaining slots when maxPlayers is set", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 12, maxPlayers: 20 })
    ).toEqual({ activeCount: 12, label: "8 vagas restantes" });
  });

  it("shows 'Liga lotada' when activeCount reaches maxPlayers", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 20, maxPlayers: 20 })
    ).toEqual({ activeCount: 20, label: "Liga lotada" });
  });

  it("shows 'Liga lotada' when activeCount exceeds maxPlayers", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 21, maxPlayers: 20 })
    ).toEqual({ activeCount: 21, label: "Liga lotada" });
  });

  it("shows 'vagas ilimitadas' when maxPlayers is null", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 5, maxPlayers: null })
    ).toEqual({ activeCount: 5, label: "vagas ilimitadas" });
  });
});

describe("buildAdminMonthlyMatchesCard", () => {
  it("counts only finished challenges within the current month", () => {
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000),
      makeFinishedChallenge(MONTH_START_MS + 2000),
      makeFinishedChallenge(MONTH_START_MS - 1000), // mês anterior
    ];

    expect(buildAdminMonthlyMatchesCard({ challenges, now: NOW })).toEqual({
      finishedCount: 2,
    });
  });

  it("returns zero when nothing finished this month", () => {
    const challenges = [makeFinishedChallenge(MONTH_START_MS - 1000)];

    expect(buildAdminMonthlyMatchesCard({ challenges, now: NOW })).toEqual({
      finishedCount: 0,
    });
  });
});

describe("buildAdminOngoingChallengesCard", () => {
  it("counts only ongoing statuses", () => {
    const challenges = [
      { status: "confirmed" } as never,
      { status: "pending_result_confirmation" } as never,
      { status: "finished" } as never, // não conta
      { status: "pending_admin_decision" } as never, // não conta (vai pro alerta)
    ];

    expect(buildAdminOngoingChallengesCard({ challenges })).toEqual({
      ongoingCount: 2,
    });
  });
});

describe("buildAdminActivityRateCard", () => {
  const ranking = [
    { id: "m-1" },
    { id: "m-2" },
    { id: "m-3" },
  ] as never;

  it("returns rate 0 with no division by zero when ranking is empty", () => {
    expect(
      buildAdminActivityRateCard({ challenges: [], now: NOW, ranking: [] })
    ).toEqual({ activeCount: 0, rate: 0 });
  });

  it("computes the fraction of active members who played this month", () => {
    // m-1 e m-2 jogaram este mês; m-3 não. → 2/3.
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-2"),
    ];

    const result = buildAdminActivityRateCard({
      challenges,
      now: NOW,
      ranking,
    });

    expect(result).toEqual({ activeCount: 3, rate: expect.closeTo(2 / 3, 5) });
  });

  it("ignores players not in the active ranking", () => {
    // A partida envolve m-1 e m-4, mas m-4 não está no ranking. → 1/3.
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-4"),
    ];

    const result = buildAdminActivityRateCard({
      challenges,
      now: NOW,
      ranking,
    });

    expect(result).toEqual({ activeCount: 3, rate: expect.closeTo(1 / 3, 5) });
  });

  it("caps at 1.0 when all active members played", () => {
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-2"),
      makeFinishedChallenge(MONTH_START_MS + 2000, "m-1", "m-3"),
    ];

    expect(
      buildAdminActivityRateCard({ challenges, now: NOW, ranking })
    ).toEqual({ activeCount: 3, rate: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/leagues/admin-overview-derived.test.ts`
Expected: FAIL — `buildAdminOccupationCard`, `buildAdminMonthlyMatchesCard`, `buildAdminOngoingChallengesCard`, `buildAdminActivityRateCard` are not exported yet.

- [ ] **Step 3: Commit (red)**

```bash
git add src/lib/leagues/admin-overview-derived.test.ts
git commit -m "test(league): add failing tests for admin metric card builders"
```

---

## Task 5: Implement metric card builders

**Files:**
- Modify: `src/lib/leagues/admin-overview-derived.ts`

- [ ] **Step 1: Add metric card types and builders**

Append to `src/lib/leagues/admin-overview-derived.ts` (below the existing alert code):

```ts
// ----- Metric cards -----

export type AdminOccupationCard = {
  activeCount: number;
  label: string;
};

export type AdminMonthlyMatchesCard = { finishedCount: number };

export type AdminOngoingChallengesCard = { ongoingCount: number };

export type AdminActivityRateCard = { activeCount: number; rate: number };

function getMonthStartMs(now: number) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.getTime();
}

export function buildAdminOccupationCard(input: {
  activeCount: number;
  maxPlayers: null | number;
}): AdminOccupationCard {
  if (input.maxPlayers === null) {
    return { activeCount: input.activeCount, label: "vagas ilimitadas" };
  }

  const remaining = input.maxPlayers - input.activeCount;

  if (remaining <= 0) {
    return { activeCount: input.activeCount, label: "Liga lotada" };
  }

  return {
    activeCount: input.activeCount,
    label: `${remaining} vagas restantes`,
  };
}

export function buildAdminMonthlyMatchesCard(input: {
  challenges: ChallengeItem[];
  now: number;
}): AdminMonthlyMatchesCard {
  const monthStart = getMonthStartMs(input.now);

  const finishedCount = input.challenges.filter((challenge) => {
    if (challenge.status !== "finished") {
      return false;
    }
    return (
      challenge.finishedAt !== null &&
      challenge.finishedAt !== undefined &&
      challenge.finishedAt >= monthStart
    );
  }).length;

  return { finishedCount };
}

export function buildAdminOngoingChallengesCard(input: {
  challenges: ChallengeItem[];
}): AdminOngoingChallengesCard {
  const ongoingCount = input.challenges.filter((challenge) =>
    ADMIN_ONGOING_STATUSES.has(challenge.status)
  ).length;

  return { ongoingCount };
}

export function buildAdminActivityRateCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ranking: MembershipOverview["ranking"];
}): AdminActivityRateCard {
  const activeCount = input.ranking.length;

  if (activeCount === 0) {
    return { activeCount: 0, rate: 0 };
  }

  const activeMembershipIds = new Set(input.ranking.map((member) => member.id));
  const monthStart = getMonthStartMs(input.now);
  const playedThisMonth = new Set<string>();

  for (const challenge of input.challenges) {
    if (challenge.status !== "finished") {
      continue;
    }
    if (
      challenge.finishedAt === null ||
      challenge.finishedAt === undefined ||
      challenge.finishedAt < monthStart
    ) {
      continue;
    }

    const challengerId = challenge.challenger.membershipId;
    const challengedId = challenge.challenged.membershipId;

    if (challengerId && activeMembershipIds.has(challengerId)) {
      playedThisMonth.add(challengerId);
    }
    if (challengedId && activeMembershipIds.has(challengedId)) {
      playedThisMonth.add(challengedId);
    }
  }

  const rate = playedThisMonth.size / activeCount;

  return { activeCount, rate: Math.min(1, rate) };
}
```

- [ ] **Step 2: Run all derived tests to verify they pass**

Run: `bun test src/lib/leagues/admin-overview-derived.test.ts`
Expected: PASS (all alert + metric card tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/leagues/admin-overview-derived.ts
git commit -m "feat(league): add admin metric card builders"
```

---

## Task 6: Replace AdminOverview placeholder with the dashboard

**Files:**
- Modify: `src/components/pages/leagues/admin-overview.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/pages/leagues/admin-overview.tsx`:

```tsx
import {
  Activity01Icon,
  Calendar03Icon,
  Target02Icon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildAdminActivityRateCard,
  buildAdminJoinRequestsAlert,
  buildAdminMonthlyMatchesCard,
  buildAdminOngoingChallengesCard,
  buildAdminOccupationCard,
  buildAdminValidationsAlert,
  summarizeAdminPendingActions,
} from "@/lib/leagues/admin-overview-derived";
import { WidgetAlert } from "./widget-alert";
import { WidgetCard } from "./widget-card";

export function AdminOverview() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const challenges = useValue(bucket$.data.challenges);
  const league = useValue(bucket$.data.league);
  const membershipOverview = useValue(bucket$.data.membershipOverview);

  const now = Date.now();
  const joinRequests = buildAdminJoinRequestsAlert({
    pendingRequestsCount: membershipOverview?.pendingRequests.length ?? 0,
  });
  const validations = buildAdminValidationsAlert({ challenges });
  const occupation = buildAdminOccupationCard({
    activeCount: membershipOverview?.ranking.length ?? 0,
    maxPlayers: league?.maxPlayers ?? null,
  });
  const monthlyMatches = buildAdminMonthlyMatchesCard({ challenges, now });
  const ongoing = buildAdminOngoingChallengesCard({ challenges });
  const activityRate = buildAdminActivityRateCard({
    challenges,
    now,
    ranking: membershipOverview?.ranking ?? [],
  });

  const activityPercent = Math.round(activityRate.rate * 100);

  return (
    <View className="gap-3">
      {joinRequests ? (
        <WidgetAlert
          status="accent"
          title={
            `${joinRequests.total} ${
              joinRequests.total === 1
                ? "jogador aguardando aprovação"
                : "jogadores aguardando aprovação"
            }`
          }
        />
      ) : null}

      {validations ? (
        <WidgetAlert
          description={summarizeAdminPendingActions(validations.actions)}
          status="warning"
          title={
            `${validations.total} ${
              validations.total === 1
                ? "item precisando de atenção"
                : "itens precisando de atenção"
            }`
          }
        />
      ) : null}

      <View className="flex-row gap-3">
        <WidgetCard
          className="flex-1"
          description={occupation.label}
          icon={UserGroup02Icon}
          title={`${occupation.activeCount} ativos`}
        />
        <WidgetCard
          className="flex-1"
          description="disputadas este mês"
          icon={Calendar03Icon}
          title={`${monthlyMatches.finishedCount} partidas`}
        />
      </View>

      <View className="flex-row gap-3">
        <WidgetCard
          className="flex-1"
          description="em andamento"
          icon={Target02Icon}
          title={`${ongoing.ongoingCount} desafios`}
        />
        <WidgetCard
          className="flex-1"
          description="dos jogadores ativos jogaram este mês"
          icon={Activity01Icon}
          title={`${activityPercent}%`}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS. (Confirms `useLocalSearchParams` import, bucket$ field access, and builder signatures all line up.)

- [ ] **Step 3: Run lint/format fix**

Run: `bun x ultracite fix`
Expected: completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/leagues/admin-overview.tsx
git commit -m "feat(league): add admin management dashboard to league overview"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full test suite for the touched scope**

Run: `bun test src/lib/leagues/`
Expected: PASS — all existing league lib tests still pass plus the new admin-overview-derived tests.

- [ ] **Step 2: Run repo typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run diff hygiene check**

Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 4: Final commit if anything remained (format/docs)**

If ultracite or checks touched files, stage and commit them. Otherwise this step is a no-op.
