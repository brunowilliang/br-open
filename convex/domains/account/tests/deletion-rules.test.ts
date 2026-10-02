import { describe, expect, it } from "bun:test";

import {
  buildAccountDeletionStatus,
  isActiveTournamentForDeletion,
  resolveAccountDeletionEntryAction,
  type AccountDeletionOrgSnapshot,
} from "../deletion-rules";

const cleanOrg: AccountDeletionOrgSnapshot = {
  activeTournaments: [],
  draftTournamentIds: [],
  lockedBalanceCents: 0,
  moneyInFlightCount: 0,
  organizationId: "org-1",
  otherMemberCount: 0,
};

describe("resolveAccountDeletionEntryAction", () => {
  it("cancels live entries before the tournament starts", () => {
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "awaiting_payment",
        pendingMatchCount: 0,
        tournamentStatus: "published",
      })
    ).toBe("cancel");
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "active",
        pendingMatchCount: 0,
        tournamentStatus: "drawn",
      })
    ).toBe("cancel");
  });

  it("applies walkover for ongoing entries with pending matches", () => {
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "active",
        pendingMatchCount: 2,
        tournamentStatus: "ongoing",
      })
    ).toBe("walkover");
  });

  it("cancels ongoing entries without any match and skips terminal ones", () => {
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "active",
        pendingMatchCount: 0,
        tournamentStatus: "ongoing",
      })
    ).toBe("cancel");
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "cancelled",
        pendingMatchCount: 0,
        tournamentStatus: "published",
      })
    ).toBe("skip");
    expect(
      resolveAccountDeletionEntryAction({
        entryStatus: "active",
        pendingMatchCount: 1,
        tournamentStatus: "finished",
      })
    ).toBe("skip");
  });
});

describe("isActiveTournamentForDeletion", () => {
  it("covers the three live statuses", () => {
    expect(isActiveTournamentForDeletion("published")).toBe(true);
    expect(isActiveTournamentForDeletion("drawn")).toBe(true);
    expect(isActiveTournamentForDeletion("ongoing")).toBe(true);
    expect(isActiveTournamentForDeletion("draft")).toBe(false);
    expect(isActiveTournamentForDeletion("finished")).toBe(false);
    expect(isActiveTournamentForDeletion("cancelled")).toBe(false);
  });
});

describe("buildAccountDeletionStatus", () => {
  it("is deletable when nothing blocks, listing what will be resolved", () => {
    const status = buildAccountDeletionStatus({
      organizations: [cleanOrg],
      player: {
        cancellableEntryCount: 1,
        pendingMatchCount: 2,
        pendingPixCount: 1,
        refundableChargeCount: 1,
      },
    });

    expect(status.canDelete).toBe(true);
    expect(status.blockers).toEqual([]);
    expect(status.resolutions.map((item) => item.code)).toEqual([
      "entries_cancelled",
      "entries_refunded",
      "pix_cancelled",
      "matches_walkover",
    ]);
    expect(status.resolutions[0]?.summary).toContain("1 inscrição");
    expect(status.resolutions[3]?.summary).toContain("2 partidas pendentes");
  });

  it("blocks on organizer obligations and keeps singleton copy right", () => {
    const status = buildAccountDeletionStatus({
      organizations: [
        {
          ...cleanOrg,
          activeTournaments: [
            { id: "tournament-1", organizationId: "org-1" },
            { id: "tournament-2", organizationId: "org-2" },
          ],
          draftTournamentIds: ["draft-1"],
          lockedBalanceCents: 1500,
          moneyInFlightCount: 1,
          otherMemberCount: 3,
        },
      ],
      player: null,
    });

    expect(status.canDelete).toBe(false);
    expect(status.blockers.map((item) => item.code)).toEqual([
      "organization_active_tournament",
      "organization_money_in_flight",
      "organization_locked_balance",
      "organization_other_members",
    ]);
    expect(status.blockers[0]?.summary).toContain("2 torneios");
    expect(status.blockers[0]?.tournamentIds).toEqual([
      "tournament-1",
      "tournament-2",
    ]);
    expect(status.blockers[0]?.organizationIds).toEqual(["org-1", "org-2"]);
    expect(status.blockers[1]?.tournamentIds).toEqual([]);
    expect(status.blockers[1]?.organizationIds).toEqual([]);
    expect(status.resolutions.map((item) => item.code)).toEqual([
      "drafts_deleted",
    ]);
    expect(status.resolutions[0]?.summary).toContain("1 rascunho sem");
  });

  it("aggregates tournament ids across organizations", () => {
    const status = buildAccountDeletionStatus({
      organizations: [
        {
          ...cleanOrg,
          activeTournaments: [{ id: "tournament-a", organizationId: "org-1" }],
        },
        {
          ...cleanOrg,
          activeTournaments: [{ id: "tournament-b", organizationId: "org-2" }],
          organizationId: "org-2",
        },
      ],
      player: null,
    });

    expect(status.blockers[0]?.count).toBe(2);
    expect(status.blockers[0]?.tournamentIds).toEqual([
      "tournament-a",
      "tournament-b",
    ]);
    expect(status.blockers[0]?.organizationIds).toEqual(["org-1", "org-2"]);
  });
});
