import { describe, expect, test } from "bun:test";

import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

import {
  buildTournamentAwaitingPaymentAlert,
  buildTournamentCategoriesKpi,
  buildTournamentEntriesKpi,
  buildTournamentMatchesKpi,
  buildTournamentPendingApprovalAlert,
  buildTournamentPendingKpi,
} from "./organizer-overview-derived";
import type { TournamentMatchWithSides } from "./bracket-view";

function buildEntry(
  id: string,
  status: TournamentEntryWithPlayers["status"]
): TournamentEntryWithPlayers {
  return {
    categoryId: "cat-1",
    createdAt: 0,
    createdByUserId: null,
    entryRound: null,
    id,
    partnerUserId: null,
    playerA: null,
    playerAId: `a-${id}`,
    playerB: null,
    playerBId: null,
    seedRank: null,
    status,
    updatedAt: 0,
  };
}

function buildMatch(status: string): TournamentMatchWithSides {
  return {
    categoryId: "cat-1",
    courtId: null,
    createdAt: 0,
    endMinute: null,
    entryA: null,
    entryAId: null,
    entryB: null,
    entryBId: null,
    id: `m-${status}`,
    matchDate: null,
    round: 1,
    rowVersion: 0,
    scheduledById: null,
    score: null,
    slotInRound: 0,
    startMinute: null,
    status: status as TournamentMatchWithSides["status"],
    updatedAt: 0,
    walkover: false,
    winnerEntryId: null,
  };
}

describe("tournament organizer overview alerts", () => {
  test("pending approval alert only when there are pending entries", () => {
    expect(
      buildTournamentPendingApprovalAlert({
        entries: [
          buildEntry("a", "pending_approval"),
          buildEntry("b", "active"),
        ],
      })
    ).toEqual({ total: 1 });

    expect(
      buildTournamentPendingApprovalAlert({
        entries: [buildEntry("b", "active")],
      })
    ).toBeNull();
  });

  test("awaiting payment alert only when there are unpaid entries", () => {
    expect(
      buildTournamentAwaitingPaymentAlert({
        entries: [buildEntry("a", "awaiting_payment")],
      })
    ).toEqual({ total: 1 });

    expect(buildTournamentAwaitingPaymentAlert({ entries: [] })).toBeNull();
  });
});

describe("tournament organizer overview KPIs", () => {
  const entries = [
    buildEntry("a", "active"),
    buildEntry("b", "active"),
    buildEntry("c", "pending_approval"),
    buildEntry("d", "pending_partner"),
    buildEntry("e", "awaiting_payment"),
  ];

  test("entries Kpi counts confirmed (active) only", () => {
    expect(buildTournamentEntriesKpi({ entries })).toEqual({
      confirmedCount: 2,
    });
  });

  test("pending Kpi counts approval, partner and payment together", () => {
    expect(buildTournamentPendingKpi({ entries })).toEqual({ pendingCount: 3 });
  });

  test("categories Kpi counts active categories", () => {
    expect(
      buildTournamentCategoriesKpi({
        categories: [{ id: "1" }, { id: "2" }],
      })
    ).toEqual({ activeCount: 2 });
  });

  test("matches Kpi is null before the draw and counts finished after", () => {
    expect(buildTournamentMatchesKpi({ matches: [] })).toBeNull();

    expect(
      buildTournamentMatchesKpi({
        matches: [buildMatch("finished"), buildMatch("pending")],
      })
    ).toEqual({ finishedCount: 1, total: 2 });
  });

  test("matches Kpi ignores vacant rows from pruned subtrees", () => {
    expect(
      buildTournamentMatchesKpi({
        matches: [
          buildMatch("finished"),
          buildMatch("pending"),
          buildMatch("vacant"),
          buildMatch("vacant"),
        ],
      })
    ).toEqual({ finishedCount: 1, total: 2 });
  });
});
