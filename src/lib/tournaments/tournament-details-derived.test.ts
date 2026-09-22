import { describe, expect, test } from "bun:test";

import {
  buildBracketPlaceholder,
  buildTournamentEntriesTabItems,
  buildRegistrationWindowState,
  buildTournamentActiveEntriesCountByCategory,
  buildTournamentCategoryVacancy,
  buildTournamentDetailsAccess,
  buildTournamentNavigationTabItems,
  buildTournamentDetailsRole,
  buildTournamentJoinOptions,
  buildStartWarnings,
  canCancelTournamentEntry,
  formatBracketStage,
  formatMatchScheduleSummary,
  isBracketPublic,
  resolveTournamentEntriesTab,
} from "./tournament-details-derived";

describe("buildTournamentDetailsRole", () => {
  test("organizer beats any entry", () => {
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: true,
        viewerEntryIds: ["e-1"],
      })
    ).toBe("organizer");
  });

  test("player with entry, guest without", () => {
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: false,
        viewerEntryIds: ["e-1"],
      })
    ).toBe("player");
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: false,
        viewerEntryIds: [],
      })
    ).toBe("guest");
  });
});

describe("isBracketPublic / buildTournamentDetailsAccess", () => {
  test("bracket public only in ongoing/finished", () => {
    expect(isBracketPublic("ongoing")).toBeTrue();
    expect(isBracketPublic("finished")).toBeTrue();
    expect(isBracketPublic("draft")).toBeFalse();
    expect(isBracketPublic("published")).toBeFalse();
    expect(isBracketPublic("drawn")).toBeFalse();
  });

  test("organizer sees everything in any status (including private draft)", () => {
    for (const status of [
      "draft",
      "published",
      "drawn",
      "ongoing",
      "finished",
    ]) {
      expect(
        buildTournamentDetailsAccess({ role: "organizer", status })
      ).toEqual({
        canManage: true,
        canOpenBracket: true,
        canOpenSchedule: true,
      });
    }
  });

  test("non-organizer without public bracket: bracket/schedule closed", () => {
    for (const status of ["draft", "published", "drawn"]) {
      expect(buildTournamentDetailsAccess({ role: "player", status })).toEqual({
        canManage: false,
        canOpenBracket: false,
        canOpenSchedule: false,
      });
    }
  });

  test("non-organizer in ongoing/finished: bracket/schedule open, no manage", () => {
    for (const status of ["ongoing", "finished"]) {
      expect(buildTournamentDetailsAccess({ role: "guest", status })).toEqual({
        canManage: false,
        canOpenBracket: true,
        canOpenSchedule: true,
      });
    }
  });
});

describe("formatMatchScheduleSummary", () => {
  test("null while any schedule field is missing", () => {
    expect(
      formatMatchScheduleSummary({
        courtName: null,
        matchDate: "2026-09-12",
        startMinute: 840,
      })
    ).toBeNull();
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: null,
        startMinute: 840,
      })
    ).toBeNull();
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: "2026-09-12",
        startMinute: null,
      })
    ).toBeNull();
  });

  test("scheduled match renders day · time · court", () => {
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: "2026-09-12",
        startMinute: 840,
      })
    ).toBe("12 de set. · 14:00 · Quadra 2");
  });

  test("date renders in UTC, immune to the local timezone", () => {
    // 2026-09-01T00:00Z is 31 de ago. 21:00 in America/Sao_Paulo: a local
    // formatter would render the previous day.
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 1",
        matchDate: "2026-09-01",
        startMinute: 0,
      })
    ).toBe("1 de set. · 00:00 · Quadra 1");
  });
});

describe("buildBracketPlaceholder", () => {
  test("no access: placeholder with the start date", () => {
    const placeholder = buildBracketPlaceholder({
      access: buildTournamentDetailsAccess({
        role: "guest",
        status: "published",
      }),
      startDateMs: new Date(2026, 7, 25).getTime(),
    });

    expect(placeholder).toContain("Chave disponível a partir de");
    expect(placeholder).toContain("25 de ago");
  });

  test("with access: null (bracket renders)", () => {
    expect(
      buildBracketPlaceholder({
        access: buildTournamentDetailsAccess({
          role: "player",
          status: "ongoing",
        }),
        startDateMs: Date.now(),
      })
    ).toBeNull();
  });
});

describe("formatBracketStage", () => {
  test("names stages by draw size", () => {
    // 8-slot draw: three rounds (Quartas, Semi, Final).
    expect(formatBracketStage(1, 3)).toBe("Quartas de final");
    expect(formatBracketStage(2, 3)).toBe("Semifinal");
    expect(formatBracketStage(3, 3)).toBe("Final");

    // 16-slot draw: four rounds.
    expect(formatBracketStage(1, 4)).toBe("Oitavas de final");
    expect(formatBracketStage(4, 4)).toBe("Final");
  });

  test("falls back to round number for uncommon draw sizes", () => {
    // 64-slot draw: first two rounds have no named stage.
    expect(formatBracketStage(1, 6)).toBe("Rodada 1");
    expect(formatBracketStage(2, 6)).toBe("Rodada 2");
  });
});

describe("buildRegistrationWindowState", () => {
  const deadlineMs = new Date(2026, 8, 19, 12).getTime();

  test("open in published with future deadline", () => {
    const state = buildRegistrationWindowState({
      nowMs: new Date(2026, 8, 10).getTime(),
      registrationDeadlineMs: deadlineMs,
      status: "published",
    });

    expect(state.open).toBeTrue();
  });

  test("drawn keeps the window open (deadline is the only closer)", () => {
    const state = buildRegistrationWindowState({
      nowMs: new Date(2026, 8, 10).getTime(),
      registrationDeadlineMs: deadlineMs,
      status: "drawn",
    });

    expect(state.open).toBeTrue();
  });

  test("passed deadline closes even in published", () => {
    const state = buildRegistrationWindowState({
      nowMs: deadlineMs + 1,
      registrationDeadlineMs: deadlineMs,
      status: "published",
    });

    expect(state.open).toBeFalse();
  });

  test("ongoing/draft are closed regardless of deadline", () => {
    for (const status of ["draft", "ongoing", "finished", "cancelled"]) {
      const state = buildRegistrationWindowState({
        nowMs: new Date(2026, 8, 10).getTime(),
        registrationDeadlineMs: deadlineMs,
        status,
      });

      expect(state.open).toBeFalse();
    }
  });
});

describe("buildTournamentNavigationTabItems", () => {
  test("guest em published ve Overview e Entries (chave e agenda fechadas pre-ongoing)", () => {
    const access = buildTournamentDetailsAccess({
      role: "guest",
      status: "published",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "entries"]);
  });

  test("player em ongoing ve todas as abas na ordem", () => {
    const access = buildTournamentDetailsAccess({
      role: "player",
      status: "ongoing",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "bracket", "schedule", "entries"]);
  });

  test("organizer em draft ve todas as abas", () => {
    const access = buildTournamentDetailsAccess({
      role: "organizer",
      status: "draft",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "bracket", "schedule", "entries"]);
  });
});

describe("buildTournamentCategoryVacancy", () => {
  test("no limit: nothing to render", () => {
    expect(
      buildTournamentCategoryVacancy({
        activeEntriesCount: 7,
        maxEntries: null,
      })
    ).toEqual({ isFull: false, label: null });
  });

  test("partial limit renders active/max", () => {
    expect(
      buildTournamentCategoryVacancy({
        activeEntriesCount: 3,
        maxEntries: 8,
      })
    ).toEqual({ isFull: false, label: "3/8 vagas" });
  });

  test("full category renders Lotada", () => {
    expect(
      buildTournamentCategoryVacancy({
        activeEntriesCount: 8,
        maxEntries: 8,
      })
    ).toEqual({ isFull: true, label: "Lotada" });
    expect(
      buildTournamentCategoryVacancy({
        activeEntriesCount: 9,
        maxEntries: 8,
      }).isFull
    ).toBeTrue();
  });
});

describe("buildTournamentActiveEntriesCountByCategory", () => {
  test("counts only active entries per category", () => {
    const counts = buildTournamentActiveEntriesCountByCategory([
      { categoryId: "cat-a", status: "active" },
      { categoryId: "cat-a", status: "active" },
      { categoryId: "cat-a", status: "pending_approval" },
      { categoryId: "cat-a", status: "cancelled" },
      { categoryId: "cat-b", status: "active" },
    ]);

    expect(counts).toEqual({ "cat-a": 2, "cat-b": 1 });
  });
});

describe("buildTournamentJoinOptions", () => {
  const categoryIds = ["cat-a", "cat-b", "cat-c"];

  test("guest can pick every category", () => {
    expect(
      buildTournamentJoinOptions({
        categoryIds,
        entries: [
          { categoryId: "cat-a", id: "e-other" },
          { categoryId: "cat-b", id: "e-other-2" },
        ],
        viewerEntryIds: [],
      })
    ).toEqual({
      joinableCategoryIds: categoryIds,
      joinedCategoryIds: [],
    });
  });

  test("joined categories leave the selector, others stay", () => {
    expect(
      buildTournamentJoinOptions({
        categoryIds,
        entries: [
          { categoryId: "cat-a", id: "e-1" },
          { categoryId: "cat-c", id: "e-2" },
          { categoryId: "cat-b", id: "e-other" },
        ],
        viewerEntryIds: ["e-1", "e-2"],
      })
    ).toEqual({
      joinableCategoryIds: ["cat-b"],
      joinedCategoryIds: ["cat-a", "cat-c"],
    });
  });

  test("cancelled entry frees the category again", () => {
    expect(
      buildTournamentJoinOptions({
        categoryIds,
        entries: [{ categoryId: "cat-a", id: "e-1" }],
        viewerEntryIds: [],
      })
    ).toEqual({
      joinableCategoryIds: categoryIds,
      joinedCategoryIds: [],
    });
  });
});

describe("canCancelTournamentEntry", () => {
  test("alive entry before the start is cancellable", () => {
    for (const tournamentStatus of ["published", "drawn"]) {
      for (const entryStatus of [
        "pending_partner",
        "awaiting_payment",
        "pending_approval",
        "active",
      ]) {
        expect(
          canCancelTournamentEntry({ entryStatus, tournamentStatus })
        ).toBeTrue();
      }
    }
  });

  test("terminal entries and post-start tournaments are not", () => {
    for (const entryStatus of ["cancelled", "rejected"]) {
      expect(
        canCancelTournamentEntry({
          entryStatus,
          tournamentStatus: "published",
        })
      ).toBeFalse();
    }

    for (const tournamentStatus of ["draft", "ongoing", "finished"]) {
      expect(
        canCancelTournamentEntry({
          entryStatus: "active",
          tournamentStatus,
        })
      ).toBeFalse();
    }
  });
});

describe("buildStartWarnings", () => {
  const baseMatch = {
    categoryId: "cat-a",
    entryAId: "e-1",
    entryBId: "e-2",
    round: 1,
    slotInRound: 0,
    status: "pending",
    walkover: false,
  };

  test("no pending invites and no holes: empty warnings", () => {
    expect(
      buildStartWarnings({
        entries: [{ status: "active" }, { status: "pending_approval" }],
        matches: [baseMatch],
      })
    ).toEqual([]);
  });

  test("pending invite warns (singular and plural)", () => {
    expect(
      buildStartWarnings({
        entries: [{ status: "pending_partner" }],
        matches: [],
      })
    ).toEqual([
      "Há 1 convite de dupla sem resposta · essa inscrição ficará de fora da chave.",
    ]);

    expect(
      buildStartWarnings({
        entries: [{ status: "pending_partner" }, { status: "pending_partner" }],
        matches: [],
      })
    ).toEqual([
      "Há 2 convites de dupla sem resposta · essas inscrições ficarão de fora da chave.",
    ]);
  });

  test("round-1 empty side is a hole", () => {
    const warnings = buildStartWarnings({
      entries: [],
      matches: [
        { ...baseMatch, entryAId: null },
        { ...baseMatch, slotInRound: 1 },
      ],
    });

    expect(warnings).toEqual([
      "A chave tem 1 vaga em aberto (A definir) · o início só é liberado com a chave completa.",
    ]);
  });

  test("empty side fed by a live match below is the normal shape, not a hole", () => {
    expect(
      buildStartWarnings({
        entries: [],
        matches: [
          { ...baseMatch, entryAId: null, round: 2, slotInRound: 0 },
          { ...baseMatch, slotInRound: 0 },
          { ...baseMatch, slotInRound: 1 },
        ],
      })
    ).toEqual([]);
  });

  test("empty side over a pruned (vacant) child is a hole", () => {
    const warnings = buildStartWarnings({
      entries: [],
      matches: [
        { ...baseMatch, entryAId: null, round: 2, slotInRound: 0 },
        { ...baseMatch, slotInRound: 0, status: "vacant" },
        { ...baseMatch, slotInRound: 1 },
      ],
    });

    expect(warnings).toEqual([
      "A chave tem 1 vaga em aberto (A definir) · o início só é liberado com a chave completa.",
    ]);
  });

  test("vacant and walkover rows never count as holes", () => {
    expect(
      buildStartWarnings({
        entries: [],
        matches: [
          { ...baseMatch, entryAId: null, status: "vacant" },
          { ...baseMatch, entryBId: null, slotInRound: 1, walkover: true },
        ],
      })
    ).toEqual([]);
  });

  test("round/slot collide across categories — boards stay separate", () => {
    const warnings = buildStartWarnings({
      entries: [],
      matches: [
        // cat-a: lado B vazio alimentado por um filho vacant abaixo — buraco.
        { ...baseMatch, entryBId: null, round: 2, slotInRound: 0 },
        { ...baseMatch, slotInRound: 0 },
        { ...baseMatch, slotInRound: 1, status: "vacant" },
        // cat-b: same round/slot coordinates, but the feed is live (no hole).
        {
          ...baseMatch,
          categoryId: "cat-b",
          entryBId: null,
          round: 2,
          slotInRound: 0,
        },
        { ...baseMatch, categoryId: "cat-b", slotInRound: 0 },
        { ...baseMatch, categoryId: "cat-b", slotInRound: 1 },
      ],
    });

    expect(warnings).toEqual([
      "A chave tem 1 vaga em aberto (A definir) · o início só é liberado com a chave completa.",
    ]);
  });

  test("plural holes", () => {
    const warnings = buildStartWarnings({
      entries: [],
      matches: [
        { ...baseMatch, entryAId: null, slotInRound: 0 },
        { ...baseMatch, entryBId: null, slotInRound: 1 },
      ],
    });

    expect(warnings).toEqual([
      "A chave tem 2 vagas em aberto (A definir) · o início só é liberado com a chave completa.",
    ]);
  });
});

describe("resolveTournamentEntriesTab", () => {
  test("cold organizer entry (context not loaded yet) then applies pending", () => {
    // Primeiro render da entrada pela home: a descoberta ainda não hidratou,
    // então `role` é null — a derivada devolve Confirmados e a barra nem é
    // montada (buildTournamentEntriesTabItems não tem itens sem papel).
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: null,
        userTab: null,
      })
    ).toBe("confirmed");

    // Mesma chamada quando o contexto do organizador chega (re-render): o
    // initialTab do alerta é honrado, sem estado intermediário.
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: "organizer",
        userTab: null,
      })
    ).toBe("pending");
  });

  test("organizer without initialTab stays on confirmed", () => {
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "organizer",
        userTab: null,
      })
    ).toBe("confirmed");
  });

  test("player with a live entry opens on mine", () => {
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "player",
        userTab: null,
      })
    ).toBe("mine");

    // O initialTab=pending do alerta nunca vale fora do organizador.
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: "player",
        userTab: null,
      })
    ).toBe("mine");
  });

  test("viewer without entry never opens on an empty tab", () => {
    // Guest (sem inscrição viva): cai na lista global de confirmados.
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "guest",
        userTab: null,
      })
    ).toBe("confirmed");
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: "guest",
        userTab: null,
      })
    ).toBe("confirmed");
  });

  test("manual tab wins over the initialTab and survives the context loading", () => {
    // Usuário tocou Confirmados depois de chegar em Pendências: o contexto já
    // carregado (nem um novo render) não devolve a aba do initialTab.
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: "organizer",
        userTab: "confirmed",
      })
    ).toBe("confirmed");

    // E a escolha manual de Pendências vale mesmo sem initialTab.
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "organizer",
        userTab: "pending",
      })
    ).toBe("pending");

    // No jogador, a escolha manual de Confirmados segura a lista global mesmo
    // com inscrição viva (a derivada não devolve "minhas" por cima).
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "player",
        userTab: "confirmed",
      })
    ).toBe("confirmed");
  });

  test("organizer never sits on mine (aba do viewer não existe para ele)", () => {
    // O gestor toca "Minhas" na janela de load (a barra era a do jogador antes
    // de o papel resolver): a aba não está na lista do papel dele, então a
    // derivada DESCARTA a escolha em vez de prender a tela num segmento que os
    // triggers dele não têm.
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "organizer",
        userTab: "mine",
      })
    ).toBe("confirmed");

    // E o deep-link de pendências segue valendo depois do clamp.
    expect(
      resolveTournamentEntriesTab({
        initialTab: "pending",
        role: "organizer",
        userTab: "mine",
      })
    ).toBe("pending");
  });

  test("player never sits on pending (aba do organizador)", () => {
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "player",
        userTab: "pending",
      })
    ).toBe("mine");
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "guest",
        userTab: "pending",
      })
    ).toBe("confirmed");
  });

  test("papel degrada com a tela aberta: a aba herdada sai para a lista global", () => {
    // Jogador com UMA inscrição abriu Inscrições (default Minhas).
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "player",
        userTab: "mine",
      })
    ).toBe("mine");

    // Cancelou a inscrição: o contexto invalida, `viewerEntryIds` zera e o
    // papel vira guest COM A TELA ABERTA. A barra desmonta (o guest não tem
    // itens), então a escolha herdada não pode sobreviver — senão a tela fica
    // presa no segmento do jogador SEM trigger para voltar.
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: "guest",
        userTab: "mine",
      })
    ).toBe("confirmed");

    // Mesma proteção enquanto o papel novo ainda não resolveu.
    expect(
      resolveTournamentEntriesTab({
        initialTab: undefined,
        role: null,
        userTab: "mine",
      })
    ).toBe("confirmed");
  });
});

describe("buildTournamentEntriesTabItems", () => {
  test("organizer: Confirmados|Pendências, sem Minhas", () => {
    expect(buildTournamentEntriesTabItems({ role: "organizer" })).toEqual([
      { label: "Confirmados", value: "confirmed" },
      { label: "Pendências", value: "pending" },
    ]);
  });

  test("player: Minhas|Confirmados", () => {
    expect(buildTournamentEntriesTabItems({ role: "player" })).toEqual([
      { label: "Minhas", value: "mine" },
      { label: "Confirmados", value: "confirmed" },
    ]);
  });

  test("guest e entrada fria não montam barra (o repo só monta com 2+ itens)", () => {
    // Guest não tem inscrição viva por construção, então "Minhas" seria uma aba
    // morta; e na entrada fria o papel ainda é null (a barra errada do gestor
    // era pintada justamente aqui).
    expect(buildTournamentEntriesTabItems({ role: "guest" })).toEqual([]);
    expect(buildTournamentEntriesTabItems({ role: null })).toEqual([]);
  });
});
