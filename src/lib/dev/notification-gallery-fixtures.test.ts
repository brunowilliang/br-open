import { describe, expect, it } from "bun:test";

import {
  buildGalleryNotificationItem,
  buildGalleryNotificationNote,
  GALLERY_ACTION_NOTES,
  GALLERY_TEMPLATE_LINES,
  NOTIFICATION_CATALOG_EVENT_TYPES,
  NOTIFICATION_GALLERY_EVENT_TYPES,
  NOTIFICATION_GALLERY_GROUPS,
  RENEWAL_REMINDER_DAYS_LEFT_VARIANTS,
} from "./notification-gallery-fixtures";

describe("NOTIFICATION_GALLERY_GROUPS", () => {
  it("covers the server catalog exactly once", () => {
    const gallery = [...NOTIFICATION_GALLERY_EVENT_TYPES];

    expect(new Set(gallery).size).toBe(gallery.length);
    expect([...gallery].sort()).toEqual(
      [...NOTIFICATION_CATALOG_EVENT_TYPES].sort()
    );
  });

  it("keeps the approved group order, which is NOT the catalog order", () => {
    // A sequência aprovada abre no grupo da mensalidade do jogador (o catálogo
    // abre em `league.membership.requested`, do organizador) e fecha no ciclo
    // do torneio — ordem de LEITURA da galeria, não a do catálogo do servidor.
    expect(NOTIFICATION_GALLERY_EVENT_TYPES.slice(0, 2)).toEqual([
      "league.membership.approved",
      "league.membership.rejected",
    ]);
    expect(NOTIFICATION_GALLERY_EVENT_TYPES.at(-1)).toBe(
      "tournament.cancelled"
    );
  });

  it("keeps the two organizer events in their own groups", () => {
    // O papel é do MAPA do servidor (ORGANIZER_RECIPIENT_EVENTS,
    // orchestrator.ts:120-124): só a solicitação de entrada da liga e a
    // inscrição nova do torneio chegam ao ator organização.
    const organizerGroups = NOTIFICATION_GALLERY_GROUPS.filter((group) =>
      group.title.includes("(organizador)")
    );

    expect(organizerGroups.flatMap((group) => group.eventTypes)).toEqual([
      "league.membership.requested",
      "tournament.entry.created",
    ]);
  });
});

describe("galeria de notificações", () => {
  it("has a server template line for every catalog type", () => {
    for (const eventType of NOTIFICATION_CATALOG_EVENT_TYPES) {
      expect(GALLERY_TEMPLATE_LINES[eventType]).toBeGreaterThan(100);
    }
  });

  it("builds copy and an action for every catalog type", () => {
    // O botão existe nos tipos com ação REAL e em nenhum outro: o mapa do
    // builder de apresentação é a única fonte (presentation.ts).
    const actionable = Object.keys(GALLERY_ACTION_NOTES);

    for (const eventType of NOTIFICATION_CATALOG_EVENT_TYPES) {
      const item = buildGalleryNotificationItem(eventType);

      expect(item.title.length).toBeGreaterThan(0);
      expect(item.body.length).toBeGreaterThan(0);

      if (actionable.includes(eventType)) {
        expect(item.presentation?.actionLabel).toBeTruthy();
      } else {
        expect(item.presentation).toBeNull();
      }
    }
  });

  it("leaves a paid entry without a button (product decision)", () => {
    // Evento pós-pagamento: a inscrição já está ativa e o charge já está PAID.
    expect(
      buildGalleryNotificationItem("tournament.entry.confirmed").presentation
    ).toBeNull();
  });

  it("cites the template and the action in the card note", () => {
    const note = buildGalleryNotificationNote("league.membership.requested");

    expect(note).toContain("definitions.ts:338");
    expect(note).toContain("papel organizador");
    expect(note).toContain("Aprovar/Recusar");
  });

  it("shows the four renewal wordings of the same event", () => {
    const titles = RENEWAL_REMINDER_DAYS_LEFT_VARIANTS.map(
      (variant) =>
        buildGalleryNotificationItem("league.membership.renewal_reminder", {
          metadata: { daysLeft: variant.daysLeft },
        }).title
    );

    expect(titles).toEqual([
      "Renovação próxima",
      "Renovação hoje",
      "Renovação amanhã",
      "Renovação em 5 dias",
    ]);
  });
});
