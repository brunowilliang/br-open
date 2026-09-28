import { describe, expect, it } from "bun:test";

import type { NotificationPresentation } from "@convex/domains/notification/contract";

import { buildGalleryNotificationItem } from "@/lib/dev/notification-gallery-fixtures";
import {
  buildNotificationDescription,
  buildNotificationMenuItems,
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
        body: "Copa Dracena 8 | a Copa Dracena 8 começou.",
        bodyHighlights: ["Copa Dracena 8"],
      })
    ).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Copa Dracena 8" },
          { text: " | a " },
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

describe("botão do aviso com confronto definido (tournament.match.ready)", () => {
  // Item REAL do servidor (definitions + presentation): o destino do botão tem
  // que ser a MESMA url do toque do item, com o matchId que o servidor embutiu.
  const item = buildGalleryNotificationItem("tournament.match.ready");
  const url = item.data.url as string;

  it("mantém o matchId no alvo: a rota do item é o destino, sem params", () => {
    expect(url).toContain("?matchId=gallery-match-1");

    expect(getNotificationActionTarget(item)).toEqual({
      action: { params: null, type: "open_route" },
      params: null,
      route: url,
    });
  });

  it("leva o botão à url do item (o matchId não se perde no caminho)", () => {
    const items = buildNotificationMenuItems(item);

    expect(items).toEqual([
      {
        kind: "action",
        label: "Combinar horário",
        resolution: { kind: "navigate", params: {}, route: url },
        tone: "default",
      },
      { kind: "remove", label: "Remover notificação", tone: "danger" },
    ]);
  });
});
