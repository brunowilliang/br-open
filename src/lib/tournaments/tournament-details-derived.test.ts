import { describe, expect, test } from "bun:test";

import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

import {
  buildBracketPlaceholder,
  buildTournamentDatesKpi,
  buildTournamentDeadlineKpi,
  buildTournamentEntriesTabItems,
  buildTournamentEntryStatusKpi,
  buildTournamentPhaseLine,
  buildRegistrationWindowState,
  buildTournamentActiveEntriesCountByCategory,
  buildTournamentCategoryVacancy,
  buildTournamentDetailsAccess,
  buildTournamentDetailsRole,
  buildTournamentDetailsScreenState,
  buildTournamentJoinOptions,
  canCancelTournamentEntry,
  formatBracketStage,
  formatEntryPlayerNames,
  formatEntrySideLabel,
  getTournamentStatusChip,
  resolveTournamentEntriesTab,
  walkoverWinnerSide,
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

describe("buildTournamentDetailsScreenState", () => {
  const ready = {
    actorKey: "player:p-1",
    actorSwitchAt: 0,
    bootstrapStatus: "ready",
    hasTournament: true,
    payloadUpdatedAt: 100,
  } as const;

  test("payload do ator ativo libera a tela", () => {
    expect(buildTournamentDetailsScreenState(ready)).toBe("ready");
  });

  test("contexto do ator ainda não resolvido nunca vira ready", () => {
    expect(
      buildTournamentDetailsScreenState({ ...ready, actorKey: null })
    ).toBe("loading");
  });

  test("payload de ANTES da troca de ator não libera (papel do ator anterior)", () => {
    expect(
      buildTournamentDetailsScreenState({
        ...ready,
        actorSwitchAt: 100,
        payloadUpdatedAt: 100,
      })
    ).toBe("loading");
    expect(
      buildTournamentDetailsScreenState({
        ...ready,
        actorSwitchAt: 100,
        payloadUpdatedAt: 101,
      })
    ).toBe("ready");
  });

  test("descoberta pendente ou sem torneio fica em loading", () => {
    expect(
      buildTournamentDetailsScreenState({
        ...ready,
        bootstrapStatus: "loading",
      })
    ).toBe("loading");
    expect(
      buildTournamentDetailsScreenState({ ...ready, hasTournament: false })
    ).toBe("loading");
  });

  test("erro manda no gate: não vira loading", () => {
    expect(
      buildTournamentDetailsScreenState({
        ...ready,
        bootstrapStatus: "error",
      })
    ).toBe("error");
  });
});

describe("buildTournamentDetailsAccess", () => {
  test("organizer sees everything even sem divulgação", () => {
    expect(
      buildTournamentDetailsAccess({
        bracketReleased: false,
        role: "organizer",
      })
    ).toEqual({
      canManage: true,
      canOpenBracket: true,
      canOpenSchedule: true,
    });
  });

  test("não-organizador sem divulgação: bracket/schedule fechados", () => {
    for (const role of ["guest", "player"] as const) {
      expect(
        buildTournamentDetailsAccess({ bracketReleased: false, role })
      ).toEqual({
        canManage: false,
        canOpenBracket: false,
        canOpenSchedule: false,
      });
    }
  });

  test("não-organizador com chave divulgada: abre mesmo antes do início", () => {
    for (const role of ["guest", "player"] as const) {
      expect(
        buildTournamentDetailsAccess({ bracketReleased: true, role })
      ).toEqual({
        canManage: false,
        canOpenBracket: true,
        canOpenSchedule: true,
      });
    }
  });
});

describe("buildBracketPlaceholder", () => {
  test("sem acesso e sem data combinada: placeholder com o início", () => {
    const placeholder = buildBracketPlaceholder({
      access: buildTournamentDetailsAccess({
        bracketReleased: false,
        role: "guest",
      }),
      bracketReleaseAtMs: null,
      startDateMs: new Date(2026, 7, 25).getTime(),
    });

    expect(placeholder).toContain("Chave disponível a partir de");
    expect(placeholder).toContain("25 de ago");
  });

  test("sem acesso com data combinada: o texto é a data da divulgação", () => {
    const placeholder = buildBracketPlaceholder({
      access: buildTournamentDetailsAccess({
        bracketReleased: false,
        role: "player",
      }),
      bracketReleaseAtMs: new Date(2026, 7, 23).getTime(),
      startDateMs: new Date(2026, 7, 25).getTime(),
    });

    expect(placeholder).toContain("Chave divulgada em");
    expect(placeholder).toContain("23 de ago");
  });

  test("com acesso: null (bracket renders)", () => {
    expect(
      buildBracketPlaceholder({
        access: buildTournamentDetailsAccess({
          bracketReleased: true,
          role: "player",
        }),
        bracketReleaseAtMs: null,
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

describe("getTournamentStatusChip", () => {
  const deadlineMs = new Date(2026, 8, 19, 12).getTime();
  const beforeDeadlineMs = new Date(2026, 8, 10).getTime();

  test("o par published/drawn sai da janela, nao do status", () => {
    expect(
      getTournamentStatusChip({
        nowMs: beforeDeadlineMs,
        registrationDeadlineMs: deadlineMs,
        status: "published",
      })
    ).toEqual({ color: "accent", label: "Inscrições abertas" });

    expect(
      getTournamentStatusChip({
        nowMs: beforeDeadlineMs,
        registrationDeadlineMs: deadlineMs,
        status: "drawn",
      })
    ).toEqual({ color: "accent", label: "Inscrições abertas" });

    expect(
      getTournamentStatusChip({
        nowMs: deadlineMs + 1,
        registrationDeadlineMs: deadlineMs,
        status: "drawn",
      })
    ).toEqual({ color: "accent", label: "Inscrições encerradas" });
  });

  test("cada status do vocabulario tem o seu chip", () => {
    const cases = [
      { color: "default", label: "Rascunho", status: "draft" },
      { color: "warning", label: "Em andamento", status: "ongoing" },
      { color: "default", label: "Encerrado", status: "finished" },
      { color: "danger", label: "Cancelado", status: "cancelled" },
    ] as const;

    for (const item of cases) {
      expect(
        getTournamentStatusChip({
          nowMs: beforeDeadlineMs,
          registrationDeadlineMs: deadlineMs,
          status: item.status,
        })
      ).toEqual({ color: item.color, label: item.label });
    }
  });

  test("status fora do vocabulario cai no rotulo cru", () => {
    expect(
      getTournamentStatusChip({
        nowMs: beforeDeadlineMs,
        registrationDeadlineMs: deadlineMs,
        status: "archived",
      })
    ).toEqual({ color: "default", label: "archived" });
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

/** Inscrição no shape do wire: 1 jogador (simples) ou 2 (dupla); `null` no
 * lugar de um lado cobre o parceiro que ainda não hidratou. */
function buildEntryFixture(
  players: (null | { fullName: string; nickname?: null | string })[]
): TournamentEntryWithPlayers {
  const cards = players.map((player, index) =>
    player
      ? {
          avatarUrl: null,
          fullName: player.fullName,
          nickname: player.nickname ?? null,
          playerProfileId: `pp-${index}`,
          username: null,
        }
      : null
  );

  return {
    categoryId: "cat-1",
    createdAt: 0,
    createdByUserId: null,
    entryRound: null,
    id: "e-1",
    partnerUserId: null,
    playerA: cards[0] ?? null,
    playerAId: "pa-1",
    playerB: cards[1] ?? null,
    playerBId: cards[1] ? "pb-1" : null,
    seedRank: null,
    status: "active",
    updatedAt: 0,
  };
}

describe("formatEntryPlayerNames", () => {
  test("dupla: os dois nomes por inteiro, na ordem do lado", () => {
    const entry = buildEntryFixture([
      { fullName: "Bruno William Garcia" },
      { fullName: "Jose Almeida Prado" },
    ]);

    expect(formatEntryPlayerNames(entry)).toEqual([
      "Bruno William Garcia",
      "Jose Almeida Prado",
    ]);
  });

  test("apelido vence o nome completo", () => {
    expect(
      formatEntryPlayerNames(
        buildEntryFixture([
          { fullName: "Rafael Souza", nickname: "Rafa" },
          { fullName: "Diego Nakamura", nickname: "Dieguinho" },
        ])
      )
    ).toEqual(["Rafa", "Dieguinho"]);
  });

  test("simples e dupla com parceiro não resolvido: um nome só", () => {
    expect(
      formatEntryPlayerNames(buildEntryFixture([{ fullName: "Marina Costa" }]))
    ).toEqual(["Marina Costa"]);
    expect(
      formatEntryPlayerNames(
        buildEntryFixture([{ fullName: "Marina Costa" }, null])
      )
    ).toEqual(["Marina Costa"]);
  });

  test("lado vazio e jogador sem hidratação caem no rótulo de fallback", () => {
    expect(formatEntryPlayerNames(null)).toEqual(["A definir"]);
    expect(formatEntryPlayerNames(buildEntryFixture([null]))).toEqual([
      "Jogador",
    ]);
  });
});

describe("formatEntrySideLabel", () => {
  test("segue o rótulo de UMA linha (agenda, inscrições, próximo jogo)", () => {
    expect(
      formatEntrySideLabel(
        buildEntryFixture([
          { fullName: "Bruno William Garcia" },
          { fullName: "Jose Almeida Prado" },
        ])
      )
    ).toBe("Bruno William Garcia / Jose Almeida Prado");

    expect(formatEntrySideLabel(null)).toBe("A definir");
    expect(
      formatEntrySideLabel(buildEntryFixture([{ fullName: "Marina Costa" }]))
    ).toBe("Marina Costa");
  });
});

describe("walkoverWinnerSide", () => {
  const playedWalkover = {
    entryAId: "entry-a",
    entryBId: "entry-b",
    status: "finished",
    walkover: true,
  };

  test("W.O. jogado: o lado é o do winnerEntryId", () => {
    expect(
      walkoverWinnerSide({ ...playedWalkover, winnerEntryId: "entry-a" })
    ).toBe("a");
    expect(
      walkoverWinnerSide({ ...playedWalkover, winnerEntryId: "entry-b" })
    ).toBe("b");
  });

  test("bye do sorteio e partida jogada não são W.O. do card", () => {
    expect(
      walkoverWinnerSide({
        entryAId: "entry-a",
        entryBId: null,
        status: "walkover",
        walkover: true,
        winnerEntryId: "entry-a",
      })
    ).toBeNull();
    expect(
      walkoverWinnerSide({
        entryAId: "entry-a",
        entryBId: "entry-b",
        status: "finished",
        walkover: false,
        winnerEntryId: "entry-b",
      })
    ).toBeNull();
  });

  test("W.O. sem vencedor resolvido (ou fora dos dois lados) não pinta lado", () => {
    expect(
      walkoverWinnerSide({ ...playedWalkover, winnerEntryId: null })
    ).toBeNull();
    expect(
      walkoverWinnerSide({ ...playedWalkover, winnerEntryId: "entry-c" })
    ).toBeNull();
  });
});

describe("buildTournamentPhaseLine", () => {
  const now = new Date(2026, 9, 1, 9).getTime();
  const deadline = new Date(2026, 9, 11).getTime();
  const releaseAt = new Date(2026, 9, 4).getTime();
  const base = {
    bracketReleaseAt: releaseAt as null | number,
    bracketReleased: false,
    now,
    registrationDeadlineAt: deadline,
    status: "published",
  };

  test("inscrições abertas contam pro fim do prazo", () => {
    expect(buildTournamentPhaseLine(base)).toEqual({
      color: "default",
      label: "Faltam 10 dias para as inscrições terminarem",
    });
  });

  test("véspera e dia do prazo", () => {
    expect(
      buildTournamentPhaseLine({
        ...base,
        now: new Date(2026, 9, 10).getTime(),
      })
    ).toEqual({ color: "default", label: "As inscrições terminam amanhã" });

    expect(
      buildTournamentPhaseLine({
        ...base,
        registrationDeadlineAt: new Date(2026, 9, 1, 18).getTime(),
      })
    ).toEqual({ color: "default", label: "As inscrições terminam hoje" });
  });

  test("encerradas e chave por sair contam pro chaveamento", () => {
    const closed = {
      ...base,
      registrationDeadlineAt: new Date(2026, 8, 28).getTime(),
    };

    expect(buildTournamentPhaseLine(closed)).toEqual({
      color: "default",
      label: "Chaveamento sai em 3 dias",
    });

    expect(
      buildTournamentPhaseLine({
        ...closed,
        now: new Date(2026, 9, 3).getTime(),
      })
    ).toEqual({ color: "default", label: "Chaveamento sai amanhã" });

    expect(
      buildTournamentPhaseLine({
        ...closed,
        bracketReleaseAt: new Date(2026, 9, 4, 23).getTime(),
        now: new Date(2026, 9, 4, 9).getTime(),
      })
    ).toEqual({ color: "default", label: "Chaveamento sai hoje" });
  });

  test("sem marco futuro acionável não tem faixa", () => {
    const closed = {
      ...base,
      registrationDeadlineAt: new Date(2026, 8, 28).getTime(),
    };

    expect(
      buildTournamentPhaseLine({ ...closed, bracketReleased: true })
    ).toBeNull();
    expect(
      buildTournamentPhaseLine({ ...closed, bracketReleaseAt: null })
    ).toBeNull();
    expect(
      buildTournamentPhaseLine({
        ...base,
        now: new Date(2026, 9, 13).getTime(),
        status: "ongoing",
      })
    ).toBeNull();
  });

  test("encerrado cita o fim (sem fim no dado, sai sem dia)", () => {
    expect(
      buildTournamentPhaseLine({
        ...base,
        endDate: new Date(2026, 9, 14).getTime(),
        now: new Date(2026, 9, 15).getTime(),
        status: "finished",
      })
    ).toEqual({ color: "default", label: "Torneio encerrado em 14 de out." });

    expect(
      buildTournamentPhaseLine({
        ...base,
        endDate: null,
        now: new Date(2026, 9, 15).getTime(),
        status: "finished",
      })
    ).toEqual({ color: "default", label: "Torneio encerrado" });
  });

  test("cancelado sai em vermelho (sem dia no dado)", () => {
    expect(buildTournamentPhaseLine({ ...base, status: "cancelled" })).toEqual({
      color: "danger",
      label: "Torneio cancelado",
    });
  });
});

describe("buildTournamentDatesKpi", () => {
  const startDate = new Date(2026, 9, 13).getTime();

  test("janela no mesmo mês vira '13 a 14 de out.'", () => {
    expect(
      buildTournamentDatesKpi({
        endDate: new Date(2026, 9, 14).getTime(),
        startDate,
      })
    ).toBe("13 a 14 de out.");
  });

  test("meses diferentes nomeiam os dois dias", () => {
    expect(
      buildTournamentDatesKpi({
        endDate: new Date(2026, 10, 2).getTime(),
        startDate,
      })
    ).toBe("13 de out. a 2 de nov.");
  });

  test("torneio de um dia (ou sem fim) mostra o dia sozinho", () => {
    expect(buildTournamentDatesKpi({ startDate })).toBe("13 de out.");

    expect(buildTournamentDatesKpi({ endDate: startDate, startDate })).toBe(
      "13 de out."
    );
  });

  test("sem data de início não há valor", () => {
    expect(buildTournamentDatesKpi({ startDate: 0 })).toBeNull();
  });
});

describe("buildTournamentDeadlineKpi", () => {
  test("prazo vira 'até 11 de out.'", () => {
    expect(buildTournamentDeadlineKpi(new Date(2026, 9, 11).getTime())).toBe(
      "até 11 de out."
    );
  });

  test("sem prazo não há valor", () => {
    expect(buildTournamentDeadlineKpi(0)).toBeNull();
  });
});

describe("buildTournamentEntryStatusKpi", () => {
  test("uma ativa já deixa o geral 'Inscrito', mesmo com outra aguardando", () => {
    expect(
      buildTournamentEntryStatusKpi(["awaiting_payment", "active"])
    ).toEqual({ color: "success", label: "Inscrito" });
  });

  test("sem ativa, a aguardando mais avançada manda", () => {
    expect(buildTournamentEntryStatusKpi(["pending_approval"])).toEqual({
      color: "warning",
      label: "Em análise",
    });

    expect(
      buildTournamentEntryStatusKpi(["pending_partner", "awaiting_payment"])
    ).toEqual({ color: "warning", label: "A pagar" });
  });

  test("sem inscrição viva não há status geral", () => {
    expect(buildTournamentEntryStatusKpi([])).toBeNull();
    expect(buildTournamentEntryStatusKpi(["rejected", "cancelled"])).toBeNull();
  });
});
