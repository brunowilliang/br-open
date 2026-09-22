import { describe, expect, it } from "bun:test";

import type { PendingItem } from "@convex/domains/pendings/contract";
import { PENDING_KINDS_BY_SCOPE } from "@convex/domains/pendings/contract";
import {
  buildLeagueInactivityPending,
  buildLeagueJoinRequestsPending,
  buildOrganizerChallengePendingItem,
  buildPlayerChallengePendingItem,
  resolveLeagueInactivityRisk,
} from "@convex/domains/league/pendings-rules";
import {
  buildLeaguePaymentAccountPending,
  buildMembershipPaymentPending,
} from "@convex/domains/payment/pendings-rules";
import {
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  type TournamentEntryPendingView,
} from "@convex/domains/tournament/pendings-rules";

import {
  resolvePendingAction,
  resolvePendingsForTournament,
} from "./pendings-view";

/**
 * Itens reais dos builders do servidor passam pelo MESMO `resolvePendingAction`
 * da tela: nenhum kind pode nascer sem ação resolvível, ou o botão some calado.
 */

const NOW_MS = Date.UTC(2026, 8, 15, 12);
const MEMBERSHIP_ID = "membership-1";
const ORGANIZATION_ID = "organization-1";
const TOURNAMENT_ID = "tournament-1";

function buildEntryView(
  overrides: Partial<TournamentEntryPendingView>
): TournamentEntryPendingView {
  return {
    categoryDisplayName: "Simples Masculino",
    entryFeeCents: 500,
    entryId: "entry-1",
    invitedName: "",
    inviterName: "",
    isCreator: true,
    isInvited: false,
    registrationDeadlineAtMs: NOW_MS + 86_400_000,
    status: "awaiting_payment",
    tournamentId: TOURNAMENT_ID,
    tournamentName: "Copa Vila Tênis Clube",
    ...overrides,
  };
}

function buildEveryV1Item(): PendingItem[] {
  const membership = (status: string) =>
    buildMembershipPaymentPending({
      dueAtMs: status === "active" ? NOW_MS + 2 * 86_400_000 : null,
      membershipId: MEMBERSHIP_ID,
      membershipStatus: status,
      monthlyPriceCents: 9000,
      nowMs: NOW_MS,
      reminderDaysBefore: 7,
    });

  const inactivityRisk = resolveLeagueInactivityRisk({
    hasInactivityPenalty: true,
    inactivityPenaltyDays: 21,
    lastMatchAtMs: NOW_MS - 20 * 86_400_000,
    nowMs: NOW_MS,
  });

  return [
    membership("payment_due"),
    membership("active"),
    membership("suspended"),
    ...buildPlayerEntryPendings({
      entries: [buildEntryView({})],
    }),
    ...buildPlayerEntryPendings({
      entries: [
        buildEntryView({
          entryId: "entry-invited",
          inviterName: "Marina Costa",
          isCreator: false,
          isInvited: true,
          status: "pending_partner",
        }),
      ],
    }),
    ...buildPlayerEntryPendings({
      entries: [
        buildEntryView({
          invitedName: "Gustavo Lima",
          status: "pending_partner",
        }),
      ],
    }),
    ...buildPlayerEntryPendings({
      entries: [buildEntryView({ status: "pending_approval" })],
    }),
    buildPlayerChallengePendingItem({
      counts: { confirmResult: 1, registerResult: 2, requestCorrection: 0 },
      leagueId: "league-1",
    }),
    buildLeagueInactivityPending({
      membershipId: MEMBERSHIP_ID,
      risk: inactivityRisk as NonNullable<typeof inactivityRisk>,
    }),
    buildLeaguePaymentAccountPending({
      leagueId: "league-1",
      monthlyPriceCents: 9000,
    }),
    buildLeagueJoinRequestsPending({ count: 2, leagueId: "league-1" }),
    buildOrganizerChallengePendingItem({
      organizationId: ORGANIZATION_ID,
      proposals: 1,
      results: 2,
    }),
    ...buildOrganizerEntryPendings({
      tournaments: [
        {
          awaitingApprovalCount: 1,
          awaitingPaymentCount: 2,
          awaitingPaymentFeeCents: 1000,
          registrationDeadlineAtMs: NOW_MS + 86_400_000,
          tournamentId: TOURNAMENT_ID,
          tournamentName: "Copa Vila Tênis Clube",
        },
      ],
    }),
  ].filter((item): item is PendingItem => item !== null);
}

function inviteItem(): PendingItem {
  return buildEveryV1Item().find(
    (item) => item.kind === "player_tournament_partner_invite_received"
  ) as PendingItem;
}

describe("pendings server -> client parity", () => {
  const items = buildEveryV1Item();

  it("builds one item for each of the 14 kinds of the v1", () => {
    const allKinds = [
      ...PENDING_KINDS_BY_SCOPE.organization,
      ...PENDING_KINDS_BY_SCOPE.player,
    ];

    expect(items.length).toBe(allKinds.length);
    expect([...new Set(items.map((item) => item.kind))].sort()).toEqual(
      [...allKinds].sort()
    );
  });

  it("resolves an action for every CTA the item draws, primary AND secondary", () => {
    const unresolvedAction = (item: PendingItem) => {
      if (item.actionLabel !== null && resolvePendingAction(item) === null) {
        return `${item.kind}: sem ação no CTA principal`;
      }

      if (
        item.secondaryActionLabel !== null &&
        (!item.secondaryAction ||
          resolvePendingAction({ ...item, action: item.secondaryAction }) ===
            null)
      ) {
        return `${item.kind}: sem ação no CTA secundário`;
      }

      return null;
    };

    expect(items.map(unresolvedAction).filter(Boolean)).toEqual([]);
    // Prova negativa: o mesmo predicado reprova sem o rótulo do segundo botão.
    expect(unresolvedAction({ ...inviteItem(), secondaryAction: null })).toBe(
      "player_tournament_partner_invite_received: sem ação no CTA secundário"
    );
  });

  it("resolves the invite secondary as decline, never as the primary", () => {
    const invite = items.find(
      (item) => item.kind === "player_tournament_partner_invite_received"
    ) as PendingItem;

    expect(resolvePendingAction(invite)).toEqual({
      accept: true,
      entryId: "entry-invited",
      kind: "respond_invite",
    });
    // A secundária resolve pelo SEU `action`, nunca pela resolução do primário.
    expect(
      resolvePendingAction({ ...invite, action: invite.secondaryAction })
    ).toEqual({
      accept: false,
      entryId: "entry-invited",
      kind: "respond_invite",
    });
  });

  it("never resolves the secondary button with the primary action", () => {
    const shared = items
      .filter((item) => item.secondaryAction !== null)
      .filter(
        (item) =>
          JSON.stringify(resolvePendingAction(item)) ===
          JSON.stringify(
            resolvePendingAction({ ...item, action: item.secondaryAction })
          )
      );

    expect(shared.map((item) => item.kind)).toEqual([]);
  });

  it("draws no CTA for the items the server sends without an action", () => {
    const withLabel = items
      .filter((item) => item.action === null)
      .filter((item) => item.actionLabel !== null);

    expect(withLabel).toEqual([]);
  });

  // No `open_route` o destino é o par do ITEM (`action.params` é nulo): sem o
  // `item.params` as rotas com placeholder abrem sem o id.
  it("fills every route placeholder of the navigation items", () => {
    const missing: string[] = [];

    for (const item of items) {
      if (item.action?.type !== "open_route") {
        continue;
      }

      const resolution = resolvePendingAction(item);

      if (resolution?.kind !== "navigate") {
        missing.push(`${item.kind}: sem navegação`);
        continue;
      }

      const placeholders = [...resolution.route.matchAll(/\[(\w+)\]/g)].map(
        (match) => match[1] as string
      );

      for (const placeholder of placeholders) {
        if (!resolution.params[placeholder]) {
          missing.push(`${item.kind}: ${placeholder} vazio`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("sends the entity params each navigation route asks for", () => {
    const navigateByKind = new Map(
      items
        .filter((item) => item.action?.type === "open_route")
        .map((item) => [item.kind, resolvePendingAction(item)])
    );

    expect([...navigateByKind.keys()].sort()).toEqual([
      "organization_league_join_requests",
      "organization_league_payment_account_missing",
      "organization_tournament_entries_awaiting_approval",
      "organization_tournament_entries_awaiting_payment",
      "player_league_challenges_pending_actions",
    ]);
    expect(
      navigateByKind.get("player_league_challenges_pending_actions")
    ).toEqual({
      kind: "navigate",
      params: { leagueId: "league-1" },
      route: "/leagues/[leagueId]/challenges",
    });
    expect(
      navigateByKind.get("organization_league_payment_account_missing")
    ).toEqual({
      kind: "navigate",
      params: { leagueId: "league-1", mode: "edit" },
      route: "/settings/leagues/[mode]/settings",
    });
    expect(
      navigateByKind.get("organization_tournament_entries_awaiting_approval")
    ).toEqual({
      kind: "navigate",
      params: { initialTab: "pending", tournamentId: TOURNAMENT_ID },
      route: "/tournaments/[tournamentId]/entries",
    });
    expect(
      navigateByKind.get("organization_tournament_entries_awaiting_payment")
    ).toEqual({
      kind: "navigate",
      params: { initialTab: "pending", tournamentId: TOURNAMENT_ID },
      route: "/tournaments/[tournamentId]/entries",
    });
    expect(navigateByKind.get("organization_league_join_requests")).toEqual({
      kind: "navigate",
      params: { leagueId: "league-1" },
      route: "/leagues/[leagueId]/requests",
    });
  });

  it("navigates with the item params when the entry item aggregates two entries", () => {
    const [aggregated] = buildPlayerEntryPendings({
      entries: [
        buildEntryView({ entryId: "e1" }),
        buildEntryView({ entryId: "e2" }),
      ],
    });

    expect(resolvePendingAction(aggregated as PendingItem)).toEqual({
      kind: "navigate",
      params: { tournamentId: TOURNAMENT_ID },
      route: "/tournaments/[tournamentId]",
    });
  });

  it("never turns a mutation into a navigation", () => {
    const navigations = items
      .filter(
        (item) => item.action !== null && item.action.type !== "open_route"
      )
      .map((item) => resolvePendingAction(item))
      .filter((resolution) => resolution?.kind === "navigate");

    expect(navigations).toEqual([]);
  });

  // Com UMA inscrição aguardando pagamento o item não tem `params` nem `route`
  // (o torneio vive só no `source`) e a casa do torneio precisa achá-lo mesmo assim.
  it("finds the single-entry payment item in the tournament house", () => {
    const [singleEntryItem] = buildPlayerEntryPendings({
      entries: [buildEntryView({})],
    });

    expect(singleEntryItem?.params).toBeNull();
    expect(singleEntryItem?.route).toBeNull();
    expect(singleEntryItem?.source).toEqual({
      id: TOURNAMENT_ID,
      type: "tournament",
    });
    expect(
      resolvePendingsForTournament({
        items: [singleEntryItem as PendingItem],
        tournamentId: TOURNAMENT_ID,
      }).map((item) => item.kind)
    ).toEqual(["player_tournament_entries_awaiting_payment"]);
    expect(resolvePendingAction(singleEntryItem as PendingItem)).toEqual({
      entryId: "entry-1",
      kind: "pay_entry",
    });
  });
});
