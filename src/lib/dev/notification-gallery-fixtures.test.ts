import { readFile } from "node:fs/promises";

import { describe, expect, it } from "bun:test";

import {
  buildGalleryNotificationItem,
  buildGalleryNotificationNote,
  GALLERY_ACTION_NOTES,
  GALLERY_TEMPLATE_LINES,
  NOTIFICATION_CATALOG_EVENT_TYPES,
  NOTIFICATION_GALLERY_EVENT_TYPES,
  NOTIFICATION_GALLERY_GROUPS,
} from "./notification-gallery-fixtures";

const DEFINITIONS_FILE = `${import.meta.dir}/../../../convex/domains/notification/definitions.ts`;

describe("NOTIFICATION_GALLERY_GROUPS", () => {
  it("covers the server catalog exactly once", () => {
    const gallery = [...NOTIFICATION_GALLERY_EVENT_TYPES];

    expect(new Set(gallery).size).toBe(gallery.length);
    expect([...gallery].sort()).toEqual(
      [...NOTIFICATION_CATALOG_EVENT_TYPES].sort()
    );
  });

  it("keeps the approved group order, which is NOT the catalog order", () => {
    // A sequência aprovada abre na inscrição do jogador (o catálogo abre em
    // `tournament.bracket.placement_failed`) e fecha no ciclo do torneio —
    // ordem de LEITURA da galeria, não a do catálogo do servidor.
    expect(NOTIFICATION_GALLERY_EVENT_TYPES.slice(0, 2)).toEqual([
      "tournament.entry.confirmed",
      "tournament.entry.rejected",
    ]);
    expect(NOTIFICATION_GALLERY_EVENT_TYPES.at(-1)).toBe(
      "tournament.cancelled"
    );
  });

  it("keeps the organizer event in its own group", () => {
    // O papel é do MAPA do servidor (ORGANIZER_RECIPIENT_EVENTS,
    // orchestrator.ts:99-101): só a inscrição nova do torneio chega ao ator
    // organização.
    const organizerGroups = NOTIFICATION_GALLERY_GROUPS.filter((group) =>
      group.title.includes("(organizador)")
    );

    expect(organizerGroups.flatMap((group) => group.eventTypes)).toEqual([
      "tournament.entry.created",
    ]);
  });
});

describe("galeria de notificações", () => {
  it("pins the server template line of every catalog type", async () => {
    // O número é o do bloco do evento em `definitions.ts` (o catálogo do
    // servidor) e é conferido contra o arquivo REAL abaixo: um deslocamento
    // lá reprova aqui.
    expect(GALLERY_TEMPLATE_LINES).toEqual({
      "tournament.bracket.placement_failed": 42,
      "tournament.bracket.published": 49,
      "tournament.cancelled": 56,
      "tournament.entry.confirmed": 63,
      "tournament.entry.created": 70,
      "tournament.entry.refund_requested": 77,
      "tournament.entry.rejected": 87,
      "tournament.finished": 94,
      "tournament.match.reassigned": 101,
      "tournament.match.rescheduled": 108,
      "tournament.match.result": 115,
      "tournament.match.result_edited": 122,
      "tournament.match.scheduled": 129,
      "tournament.partner.awaiting_reply": 136,
      "tournament.partner.invited": 143,
      "tournament.partner.responded": 150,
    });

    const lines = (await readFile(DEFINITIONS_FILE, "utf8")).split("\n");

    for (const eventType of NOTIFICATION_CATALOG_EVENT_TYPES) {
      const blockStart = GALLERY_TEMPLATE_LINES[eventType] - 1;

      expect(lines[blockStart]).toBe(`  "${eventType}": {`);

      const block: string[] = [];
      for (let i = blockStart + 1; i < lines.length; i += 1) {
        if (/^ {2}"/.test(lines[i] ?? "")) {
          break;
        }
        block.push(lines[i]);
      }

      const blockText = block.join("\n");

      expect(blockText).toContain("template:");
      expect(blockText).toContain("body:");
      expect(blockText).toContain("title:");
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
    const note = buildGalleryNotificationNote("tournament.entry.created");

    expect(note).toContain("definitions.ts:70");
    expect(note).toContain("papel organizador");
    expect(note).toContain("Aprovar/Recusar");
  });
});
