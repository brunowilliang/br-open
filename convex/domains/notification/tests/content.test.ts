import { describe, expect, it } from "bun:test";

import { NOTIFICATION_EVENT_TYPES } from "../../../shared/notifications/protocol";
import { buildNotificationContent } from "../definitions";

describe("notification content", () => {
  it("builds the organizer notification for a new entry", () => {
    const content = buildNotificationContent({
      actorName: "Ana Silva",
      eventType: "tournament.entry.created",
      recipientRole: "organizer",
      tournamentId: "tournament-1",
      tournamentName: "Copa Verão",
    });

    expect(content).toEqual({
      body: "Ana Silva se inscreveu em Copa Verão.",
      data: {
        eventType: "tournament.entry.created",
        tournamentId: "tournament-1",
        url: "/tournaments/tournament-1",
      },
      title: "Nova inscrição",
    });
  });

  it("keeps custom data without losing route metadata", () => {
    const content = buildNotificationContent({
      actorName: "Bruno Garcia",
      eventType: "tournament.partner.responded",
      metadata: { accepted: true },
      recipientRole: "player",
      tournamentId: "tournament-2",
      tournamentName: "Copa Verão",
    });

    expect(content).toEqual({
      body: "Bruno Garcia aceitou o convite de dupla em Copa Verão.",
      data: {
        accepted: true,
        eventType: "tournament.partner.responded",
        tournamentId: "tournament-2",
        url: "/tournaments/tournament-2",
      },
      title: "Convite respondido",
    });
  });

  it("builds content for every protocol event type", () => {
    const contents = NOTIFICATION_EVENT_TYPES.map((eventType) =>
      buildNotificationContent({
        actorName: "Bruno Garcia",
        eventType,
        recipientRole: "player",
        tournamentId: "tournament-1",
        tournamentName: "Copa Verão",
      })
    );

    expect(contents).toHaveLength(NOTIFICATION_EVENT_TYPES.length);
    expect(contents.every((content) => content.title.length > 0)).toBe(true);
    expect(contents.every((content) => content.body.length > 0)).toBe(true);
    expect(contents.map((content) => content.data.eventType)).toEqual([
      ...NOTIFICATION_EVENT_TYPES,
    ]);
  });
});
