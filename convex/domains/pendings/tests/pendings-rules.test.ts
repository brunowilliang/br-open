import { describe, expect, it } from "bun:test";

import type { Id } from "../../../functions/_generated/dataModel";
import {
  buildLeagueInactivityPending,
  buildLeagueJoinRequestsPending,
  buildOrganizerChallengePendingItem,
  buildPlayerChallengePendingItem,
} from "../../league/pendings-rules";
import {
  buildLeaguePaymentAccountPending,
  buildMembershipPaymentPending,
} from "../../payment/pendings-rules";
import {
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  type TournamentEntryPendingView,
} from "../../tournament/pendings-rules";
import type {
  PendingActionType,
  PendingDescription,
  PendingItem,
  PendingSeverity,
} from "../contract";
import {
  PENDING_ACTION_TYPE_OPTIONS,
  PENDING_KINDS_BY_SCOPE,
  PENDING_KIND_OPTIONS,
  PENDING_KIND_SCOPES,
  PENDING_SCOPE_OPTIONS,
} from "../contract";
import {
  buildPendingItemId,
  buildPendingsResult,
  PENDING_ITEM_CAP,
  sortPendingItems,
} from "../pendings-rules";
import {
  collectPendings,
  createSaturationCollector,
  PENDING_DERIVERS,
  resolvePendingsActor,
  type PendingsActor,
  type PendingsReadCtx,
} from "../registry";

/** Texto corrido da descricao, so para provar a copy aprovada nas partes. */
function joinDescriptionText(description: PendingDescription) {
  if (typeof description === "string") {
    return description;
  }

  return description
    .map((line) => line.parts.map((part) => part.text).join(""))
    .join("; ");
}

function makeItem(input: {
  actionLabel?: null | string;
  deadlineAt?: null | number;
  id: string;
  moneyCents?: null | number;
  severity?: PendingSeverity;
}): PendingItem {
  return {
    action: input.actionLabel ? { params: null, type: "open_route" } : null,
    actionLabel: input.actionLabel ?? null,
    count: null,
    deadlineAt: input.deadlineAt ?? null,
    description: "Descrição de teste.",
    domain: "league",
    id: input.id,
    kind: "player_league_inactivity_risk",
    moneyCents: input.moneyCents ?? null,
    params: input.actionLabel ? { leagueId: input.id } : null,
    route: input.actionLabel ? "/leagues/[leagueId]/challenges" : null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: input.severity ?? "warning",
    source: { id: input.id, type: "league" },
    title: "Pendência de teste",
  };
}

/**
 * `ctx` que EXPLODE se tocado: as guardas de escopo saem antes de qualquer
 * leitura, e e isso que o teste prova (organizacao nao le dado de jogador nem
 * vice-versa).
 */
const untouchableCtx = {} as PendingsReadCtx;

describe("pendings: ordem determinista", () => {
  it("ordena por severidade, prazo (null por ultimo), valor desc e id", () => {
    const ordered = sortPendingItems([
      makeItem({ deadlineAt: 10, id: "info-cedo", severity: "info" }),
      makeItem({ id: "warning-sem-prazo", severity: "warning" }),
      makeItem({ deadlineAt: 90, id: "danger-tarde", severity: "danger" }),
      makeItem({ deadlineAt: 10, id: "danger-cedo", severity: "danger" }),
      makeItem({
        deadlineAt: 10,
        id: "warning-caros",
        moneyCents: 5000,
        severity: "warning",
      }),
      makeItem({
        deadlineAt: 10,
        id: "warning-baratos",
        moneyCents: 100,
        severity: "warning",
      }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "danger-cedo",
      "danger-tarde",
      "warning-caros",
      "warning-baratos",
      "warning-sem-prazo",
      "info-cedo",
    ]);
  });

  it("desempata pelo id (ordem estavel entre execucoes)", () => {
    const ordered = sortPendingItems([
      makeItem({ id: "b" }),
      makeItem({ id: "a" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("pendings: cap, contagens e saturacao", () => {
  it("corta no cap, conta o array devolvido e avisa que truncou", () => {
    const items = Array.from({ length: PENDING_ITEM_CAP + 5 }, (_, index) =>
      makeItem({ id: `item-${String(index).padStart(2, "0")}` })
    );

    const result = buildPendingsResult({ items, scope: "player" });

    expect(result.items).toHaveLength(PENDING_ITEM_CAP);
    expect(result.truncated).toBe(true);
    expect(result.counts.total).toBe(PENDING_ITEM_CAP);
    expect(result.counts.bySeverity.warning).toBe(PENDING_ITEM_CAP);
    expect(result.counts.byDomain.league).toBe(PENDING_ITEM_CAP);
    expect(result.scope).toBe("player");
  });

  it("nao trunca quando o array cabe no cap", () => {
    const result = buildPendingsResult({
      items: [makeItem({ id: "a", severity: "danger" })],
      scope: "organization",
    });

    expect(result.truncated).toBe(false);
    expect(result.counts.bySeverity.danger).toBe(1);
    expect(result.counts.bySeverity.warning).toBe(0);
    expect(result.counts.bySeverity.info).toBe(0);
  });

  it("array vazio devolve contagens zeradas e nenhuma saturacao", () => {
    const result = buildPendingsResult({ items: [], scope: "player" });

    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.saturation).toEqual([]);
    expect(result.counts.total).toBe(0);
    expect(result.counts.byDomain).toEqual({
      league: 0,
      payment: 0,
      player: 0,
      tournament: 0,
    });
  });

  it("saturacao: um kind aparece UMA vez, com o menor cap que o cortou", () => {
    const result = buildPendingsResult({
      items: [],
      saturation: [
        { kind: "player_league_inactivity_risk", limit: 200 },
        { kind: "player_league_inactivity_risk", limit: 20 },
        { kind: "player_league_membership_payment_due", limit: 50 },
      ],
      scope: "player",
    });

    expect(result.saturation).toEqual([
      { kind: "player_league_inactivity_risk", limit: 20 },
      { kind: "player_league_membership_payment_due", limit: 50 },
    ]);
  });

  it("saturacao: leitura so enche o cap quando o numero de linhas alcanca o limite", () => {
    const collector = createSaturationCollector();

    collector.markIfFull(["player_league_inactivity_risk"], [1, 2, 3], 4);
    expect(collector.saturations).toEqual([]);

    collector.markIfFull(["player_league_inactivity_risk"], [1, 2, 3, 4], 4);
    collector.markIfFull(["player_league_membership_payment_due"], [1], 1);
    expect(collector.saturations).toEqual([
      { kind: "player_league_inactivity_risk", limit: 4 },
      { kind: "player_league_membership_payment_due", limit: 1 },
    ]);
  });
});

describe("pendings: identidade", () => {
  it("id e deterministico no formato kind:sourceId", () => {
    expect(
      buildPendingItemId("player_league_inactivity_risk", "membership-1")
    ).toBe("player_league_inactivity_risk:membership-1");
  });
});

describe("pendings: registro dos derivadores", () => {
  it("cobre TODOS os kinds do escopo, uma vez cada", () => {
    for (const scope of PENDING_SCOPE_OPTIONS) {
      const declared = PENDING_DERIVERS[scope].flatMap((deriver) => [
        ...deriver.kinds,
      ]);

      expect([...new Set(declared)].sort()).toEqual(
        [...PENDING_KINDS_BY_SCOPE[scope]].sort()
      );
      expect(declared).toHaveLength(new Set(declared).size);
    }
  });

  it("declara cada kind no escopo em que o contrato o registrou", () => {
    for (const scope of PENDING_SCOPE_OPTIONS) {
      for (const deriver of PENDING_DERIVERS[scope]) {
        for (const kind of deriver.kinds) {
          expect(PENDING_KIND_SCOPES[kind]).toBe(scope);
        }
      }
    }
  });
});

describe("pendings: acao de cada kind", () => {
  const entryView = (
    overrides: Partial<TournamentEntryPendingView> & { entryId: string }
  ): TournamentEntryPendingView => ({
    categoryDisplayName: "Duplas Mistas",
    entryFeeCents: 4000,
    invitedName: "Gustavo Lima",
    inviterName: "Marina Costa",
    isCreator: true,
    isInvited: false,
    registrationDeadlineAtMs: 1_800_000_000_000,
    status: "pending_partner",
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  });

  /** UM item por kind, com o minimo que cada deriver precisa. */
  const oneItemPerKind = (): PendingItem[] => {
    const membershipStatus = (status: string) =>
      buildMembershipPaymentPending({
        dueAtMs: 1_800_000_000_000,
        membershipId: "membership-1",
        membershipStatus: status,
        monthlyPriceCents: 9000,
        nowMs: 1_799_000_000_000,
        reminderDaysBefore: 5,
      });

    const collected: (PendingItem | null)[] = [
      membershipStatus("payment_due"),
      membershipStatus("suspended"),
      buildMembershipPaymentPending({
        dueAtMs: 1_799_259_200_000,
        membershipId: "membership-1",
        membershipStatus: "active",
        monthlyPriceCents: 9000,
        nowMs: 1_799_000_000_000,
        reminderDaysBefore: 5,
      }),
      buildLeaguePaymentAccountPending({
        leagueId: "league-1",
        monthlyPriceCents: 9000,
      }),
      buildLeagueJoinRequestsPending({ count: 2, leagueId: "league-1" }),
      buildOrganizerChallengePendingItem({
        organizationId: "org-1",
        proposals: 1,
        results: 1,
      }),
      buildPlayerChallengePendingItem({
        counts: { confirmResult: 0, registerResult: 1, requestCorrection: 0 },
        leagueId: "league-1",
      }),
      buildLeagueInactivityPending({
        membershipId: "membership-1",
        risk: {
          daysSinceLastMatch: 27,
          daysUntilPenalty: 3,
          penaltyAtMs: 1_800_000_000_000,
          severity: "warning",
        },
      }),
      ...buildPlayerEntryPendings({
        entries: [
          entryView({ entryId: "entry-1", isCreator: false, isInvited: true }),
          entryView({ entryId: "entry-2" }),
          entryView({
            entryId: "entry-3",
            isCreator: false,
            isInvited: true,
            status: "pending_approval",
          }),
          entryView({ entryId: "entry-4", status: "awaiting_payment" }),
          entryView({
            entryId: "entry-5",
            status: "awaiting_payment",
            tournamentId: "tournament-2",
          }),
        ],
      }),
      ...buildOrganizerEntryPendings({
        tournaments: [
          {
            awaitingApprovalCount: 1,
            awaitingPaymentCount: 1,
            awaitingPaymentFeeCents: 4000,
            registrationDeadlineAtMs: 1_800_000_000_000,
            tournamentId: "tournament-1",
            tournamentName: "Copa Dracena 8",
          },
        ],
      }),
    ];

    return collected.filter((item): item is PendingItem => item !== null);
  };

  it("todo kind do contrato sai com a acao declarada", () => {
    const items = oneItemPerKind();
    const expected: Record<string, null | PendingActionType> = {
      organization_league_challenges_awaiting_validation: null,
      organization_league_join_requests: "open_route",
      organization_league_payment_account_missing: "open_route",
      organization_tournament_entries_awaiting_approval: "open_route",
      organization_tournament_entries_awaiting_payment: "open_route",
      player_league_challenges_pending_actions: "open_route",
      player_league_inactivity_risk: null,
      player_league_membership_payment_due: "pay_league_membership",
      player_league_membership_payment_due_soon: "pay_league_membership",
      player_league_membership_suspended: "pay_league_membership",
      player_tournament_entries_awaiting_payment: "pay_tournament_entry",
      player_tournament_entry_awaiting_approval: null,
      player_tournament_partner_invite_received: "accept_partner_invite",
      player_tournament_partner_invite_sent: null,
    };

    // O fixture cobre TODOS os kinds do contrato (nada fica sem prova).
    expect([...new Set(items.map((item) => item.kind))].sort()).toEqual(
      [...PENDING_KIND_OPTIONS].sort()
    );

    for (const item of items) {
      const expectedType = expected[item.kind];

      if (expectedType === null) {
        expect(item.action).toBeNull();
        expect(item.actionLabel).toBeNull();
        expect(item.secondaryAction).toBeNull();
        continue;
      }

      expect(item.action?.type).toBe(expectedType);
      expect(item.actionLabel).not.toBeNull();
      expect(
        (PENDING_ACTION_TYPE_OPTIONS as readonly string[]).includes(
          item.action?.type ?? ""
        )
      ).toBe(true);
    }
  });

  it("acao de NAVEGACAO sempre tem destino e nunca carrega params proprios", () => {
    for (const item of oneItemPerKind()) {
      if (item.action?.type !== "open_route") {
        continue;
      }

      expect(item.route).not.toBeNull();
      expect(item.params).not.toBeNull();
      expect(item.action.params).toBeNull();
    }
  });

  it("acao de MUTACAO traz o ALVO na acao; route/params sao contexto, nunca o alvo", () => {
    const payloads: Record<string, string[]> = {
      accept_partner_invite: ["entryId"],
      decline_partner_invite: ["entryId"],
      pay_tournament_entry: ["entryId"],
    };

    for (const item of oneItemPerKind()) {
      const type = item.action?.type;

      if (!type || type === "open_route") {
        continue;
      }

      if (type === "pay_league_membership") {
        // Alvo = o proprio source; nenhum params de acao.
        expect(item.source.type).toBe("league_membership");
        expect(item.action?.params).toBeNull();
        continue;
      }

      // Alvo = action.params.entryId (nunca o source, nunca o route).
      expect(Object.keys(item.action?.params ?? {})).toEqual(
        payloads[type] ?? []
      );
      if (item.kind === "player_tournament_entries_awaiting_payment") {
        // Agregado de UMA inscricao: o source e o TORNEIO e o alvo e a
        // inscricao a pagar — e por isso o alvo nao pode vir do source.
        expect(item.source.type).toBe("tournament");
      } else {
        // Item por inscricao: o alvo e a propria entidade do item.
        expect(item.action?.params?.entryId).toBe(item.source.id);
      }

      // O que o invariante PROIBE e a mutacao depender de route/params: o
      // cliente nunca navega por eles nesse caso. Route/params podem existir
      // como CONTEXTO da entidade (o recorte da tela le), nunca como alvo.
      if (item.route !== null) {
        expect(item.params).not.toBeNull();
        expect(item.params?.entryId).toBeUndefined();
      }
    }
  });

  it("o convite recebido tem as DUAS acoes com o mesmo alvo", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-1", isCreator: false, isInvited: true }),
      ],
    });

    expect(item?.action).toEqual({
      params: { entryId: "entry-1" },
      type: "accept_partner_invite",
    });
    expect(item?.secondaryAction).toEqual({
      params: { entryId: "entry-1" },
      type: "decline_partner_invite",
    });
  });

  it("agregado de UMA inscricao paga a propria inscricao; com mais, abre a casa", () => {
    const single = buildPlayerEntryPendings({
      entries: [entryView({ entryId: "entry-1", status: "awaiting_payment" })],
    });
    expect(single[0]?.action).toEqual({
      params: { entryId: "entry-1" },
      type: "pay_tournament_entry",
    });
    expect(single[0]?.route).toBeNull();

    const multiple = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-1", status: "awaiting_payment" }),
        entryView({ entryId: "entry-2", status: "awaiting_payment" }),
      ],
    });
    expect(multiple[0]?.action).toEqual({ params: null, type: "open_route" });
    expect(multiple[0]?.route).toBe("/tournaments/[tournamentId]");
  });

  it("a copy do item continua sendo a sentence aprovada (partes juntam nela)", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-1", isCreator: false, isInvited: true }),
      ],
    });

    expect(joinDescriptionText(item?.description ?? "")).toBe(
      "Marina Costa convidou você para jogar Duplas Mistas na Copa Dracena 8."
    );
  });
});

describe("pendings: ator do escopo", () => {
  it("jogador ativo vira ator de jogador", () => {
    expect(
      resolvePendingsActor({
        id: "player-1",
        kind: "player",
      })
    ).toEqual({
      kind: "player",
      playerProfileId: "player-1" as Id<"playerProfile">,
    });
  });

  it("organizacao com papel de manager vira ator de organizacao", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(
        resolvePendingsActor({ id: "org-1", kind: "organization", role })
      ).toEqual({
        kind: "organization",
        organizationId: "org-1" as Id<"organization">,
      });
    }
  });

  it("member puro (e ator sem papel) nao tem escopo de organizacao", () => {
    expect(
      resolvePendingsActor({
        id: "org-1",
        kind: "organization",
        role: "member",
      })
    ).toBeNull();
    expect(
      resolvePendingsActor({ id: "org-1", kind: "organization" })
    ).toBeNull();
  });
});

describe("pendings: escopo pertence ao ator", () => {
  const player: PendingsActor = {
    kind: "player",
    playerProfileId: "player-1" as Id<"playerProfile">,
  };
  const organization: PendingsActor = {
    kind: "organization",
    organizationId: "org-1" as Id<"organization">,
  };

  it("nenhum derivador da organizacao responde ao ator jogador", async () => {
    const derived = await Promise.all(
      PENDING_DERIVERS.organization.map((deriver) =>
        deriver.derive(untouchableCtx, player, 1_700_000_000_000)
      )
    );

    expect(derived.flatMap((derivation) => derivation.items)).toEqual([]);
    expect(derived.flatMap((derivation) => derivation.saturations)).toEqual([]);
  });

  it("nenhum derivador do jogador responde ao ator organizacao", async () => {
    const derived = await Promise.all(
      PENDING_DERIVERS.player.map((deriver) =>
        deriver.derive(untouchableCtx, organization, 1_700_000_000_000)
      )
    );

    expect(derived.flatMap((derivation) => derivation.items)).toEqual([]);
    expect(derived.flatMap((derivation) => derivation.saturations)).toEqual([]);
  });

  it("coletor devolve resultado vazio e sem erro no escopo do outro ator", async () => {
    const result = await collectPendings({
      actor: organization,
      ctx: untouchableCtx,
      nowMs: 1_700_000_000_000,
      scope: "player",
    });

    expect(result.items).toEqual([]);
    expect(result.saturation).toEqual([]);
    expect(result.counts.total).toBe(0);
    expect(result.scope).toBe("player");
    expect(result.truncated).toBe(false);
  });
});
