import { describe, expect, it } from "bun:test";

import type { NotificationPresentation } from "@convex/domains/notification/contract";

import {
  buildNotificationDescription,
  getNotificationActionTarget,
  type NotificationCardItem,
} from "./notification-view";

function buildItem(
  overrides: Partial<NotificationCardItem>
): NotificationCardItem {
  return {
    body: "Marina Costa pediu para entrar na liga Liga do Parque.",
    data: {},
    id: "notification-1",
    isRead: false,
    occurredAt: 1,
    presentation: null,
    sourceEntityId: null,
    sourceEntityType: null,
    title: "Nova solicitação de entrada",
    ...overrides,
  };
}

function buildPresentation(
  overrides: Partial<NotificationPresentation>
): NotificationPresentation {
  return {
    action: null,
    actionLabel: null,
    bodyHighlights: [],
    secondaryAction: null,
    secondaryActionLabel: null,
    ...overrides,
  };
}

describe("buildNotificationDescription", () => {
  it("keeps the server text untouched when there is no highlight", () => {
    expect(
      buildNotificationDescription({
        body: "Sua entrada na liga foi aprovada.",
        bodyHighlights: [],
      })
    ).toBe("Sua entrada na liga foi aprovada.");
  });

  it("splits the text into parts with the keyword flagged", () => {
    // O destaque tem que sair do TEXTO do servidor: nada de reescrever a frase.
    expect(
      buildNotificationDescription({
        body: "Marina Costa pediu para entrar na liga.",
        bodyHighlights: ["Marina Costa"],
      })
    ).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Marina Costa" },
          { text: " pediu para entrar na liga." },
        ],
      },
    ]);
  });

  it("matches ignoring case and keeps the original spelling on screen", () => {
    expect(
      buildNotificationDescription({
        body: "GUSTAVO LIMA aceitou o convite de dupla.",
        bodyHighlights: ["Gustavo Lima"],
      })
    ).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "GUSTAVO LIMA" },
          { text: " aceitou o convite de dupla." },
        ],
      },
    ]);
  });

  it("ignores a keyword the text does not have", () => {
    expect(
      buildNotificationDescription({
        body: "Um jogador pediu para entrar na liga.",
        bodyHighlights: ["Marina Costa"],
      })
    ).toBe("Um jogador pediu para entrar na liga.");
  });

  it("merges overlapping keywords into one highlighted range", () => {
    expect(
      buildNotificationDescription({
        body: "Marina Costa pediu.",
        bodyHighlights: ["Marina", "Marina Costa"],
      })
    ).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Marina Costa" },
          { text: " pediu." },
        ],
      },
    ]);
  });

  it("highlights every occurrence of the keyword", () => {
    expect(
      buildNotificationDescription({
        body: "Copa Dracena 8 · a Copa Dracena 8 começou.",
        bodyHighlights: ["Copa Dracena 8"],
      })
    ).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Copa Dracena 8" },
          { text: " · a " },
          { isHighlighted: true, text: "Copa Dracena 8" },
          { text: " começou." },
        ],
      },
    ]);
  });
});

describe("getNotificationActionTarget", () => {
  it("reads the action and the url the server put in the item", () => {
    const target = getNotificationActionTarget(
      buildItem({
        data: { url: "/tournaments/tournament-1/entries" },
        presentation: buildPresentation({
          action: {
            params: { entryId: "entry-1" },
            type: "approve_tournament_entry",
          },
          actionLabel: "Aprovar",
        }),
      })
    );

    expect(target).toEqual({
      action: {
        params: { entryId: "entry-1" },
        type: "approve_tournament_entry",
      },
      params: null,
      route: "/tournaments/tournament-1/entries",
    });
  });

  it("has no action for an informative item (legacy row included)", () => {
    const target = getNotificationActionTarget(buildItem({}));

    expect(target.action).toBeNull();
    expect(target.route).toBeNull();
  });
});
