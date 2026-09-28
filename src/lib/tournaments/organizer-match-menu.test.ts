import { describe, expect, it, mock } from "bun:test";

import {
  bindOrganizerMatchMenu,
  buildMatchSlotKey,
  buildOrganizerMatchMenu,
  canReserveUnreadySlot,
  type OrganizerMatchMenuInput,
} from "./organizer-match-menu";

function buildInput(
  overrides: Partial<OrganizerMatchMenuInput> = {}
): OrganizerMatchMenuInput {
  return {
    canReserveSlot: false,
    isConclusionPending: false,
    isFinal: false,
    isTournamentClosed: false,
    matchDate: null,
    matchStatus: "pending",
    sidesDefined: false,
    ...overrides,
  };
}

function kinds(input: OrganizerMatchMenuInput) {
  return buildOrganizerMatchMenu(input).map((entry) => [
    entry.kind,
    entry.label,
  ]);
}

describe("buildOrganizerMatchMenu", () => {
  it("agendado com os dois lados: reagendar, resultado e cancelar por último", () => {
    expect(
      kinds(
        buildInput({
          matchDate: "2026-09-12",
          matchStatus: "scheduled",
          sidesDefined: true,
        })
      )
    ).toEqual([
      ["schedule_match", "Reagendar"],
      ["publish_result", "Resultado"],
      ["cancel_matches", "Cancelar jogo"],
    ]);
  });

  it("o MESMO menu vale no chaveamento e na agenda (mesmo estado, mesmo menu)", () => {
    const agenda = buildInput({
      matchDate: "2026-09-12",
      matchStatus: "scheduled",
      sidesDefined: true,
    });

    expect(buildOrganizerMatchMenu(agenda)).toEqual(
      buildOrganizerMatchMenu({ ...agenda })
    );
  });

  it("sem data: agendar e resultado, sem cancelar", () => {
    expect(kinds(buildInput({ sidesDefined: true }))).toEqual([
      ["schedule_match", "Agendar"],
      ["publish_result", "Resultado"],
    ]);
  });

  it("vaga que espera os vencedores: reservar horário (e reagendar já reservado)", () => {
    expect(
      kinds(buildInput({ canReserveSlot: true, matchStatus: "vacant" }))
    ).toEqual([["schedule_match", "Reservar horário"]]);
    expect(
      kinds(
        buildInput({
          canReserveSlot: true,
          matchDate: "2026-09-12",
          matchStatus: "vacant",
        })
      )
    ).toEqual([["schedule_match", "Reagendar"]]);
  });

  it("decidido: só editar resultado (o cancelamento não se aplica)", () => {
    expect(
      kinds(
        buildInput({
          matchDate: "2026-09-12",
          matchStatus: "finished",
          sidesDefined: true,
        })
      )
    ).toEqual([["edit_result", "Editar resultado"]]);
    expect(
      kinds(
        buildInput({
          matchDate: "2026-09-12",
          matchStatus: "champion",
          sidesDefined: true,
        })
      )
    ).toEqual([["edit_result", "Editar resultado"]]);
  });

  it("na FINAL com a pendência viva o concluir vem PRIMEIRO", () => {
    expect(
      kinds(
        buildInput({
          isConclusionPending: true,
          isFinal: true,
          matchStatus: "finished",
          sidesDefined: true,
        })
      )
    ).toEqual([
      ["conclude_tournament", "Concluir torneio"],
      ["edit_result", "Editar resultado"],
    ]);
  });

  it("torneio encerrado não tem menu nenhum", () => {
    expect(
      buildOrganizerMatchMenu(
        buildInput({
          isConclusionPending: true,
          isFinal: true,
          isTournamentClosed: true,
          matchDate: "2026-09-12",
          matchStatus: "scheduled",
          sidesDefined: true,
        })
      )
    ).toEqual([]);
  });
});

describe("bindOrganizerMatchMenu", () => {
  it("liga cada verbo ao canal com o kind dele", () => {
    const onAction = mock(() => undefined);
    const items = bindOrganizerMatchMenu({
      entries: buildOrganizerMatchMenu(
        buildInput({
          matchDate: "2026-09-12",
          matchStatus: "scheduled",
          sidesDefined: true,
        })
      ),
      onAction,
    });

    expect(items.map((item) => item.label)).toEqual([
      "Reagendar",
      "Resultado",
      "Cancelar jogo",
    ]);

    items.at(-1)?.onPress();

    expect(onAction).toHaveBeenCalledWith("cancel_matches");
  });
});

describe("canReserveUnreadySlot", () => {
  const slotKeys = new Set([
    buildMatchSlotKey({ categoryId: "cat", round: 1, slotInRound: 0 }),
    buildMatchSlotKey({ categoryId: "cat", round: 1, slotInRound: 1 }),
  ]);

  it("libera a semi com as duas filhas na chave", () => {
    expect(
      canReserveUnreadySlot({
        categoryId: "cat",
        matchRound: 2,
        slotInRound: 0,
        slotKeys,
      })
    ).toBeTrue();
  });

  it("não libera a 1ª rodada nem a vaga sem as duas filhas", () => {
    expect(
      canReserveUnreadySlot({
        categoryId: "cat",
        matchRound: 1,
        slotInRound: 0,
        slotKeys,
      })
    ).toBeFalse();
    expect(
      canReserveUnreadySlot({
        categoryId: "cat",
        matchRound: 2,
        slotInRound: 1,
        slotKeys,
      })
    ).toBeFalse();
  });
});
