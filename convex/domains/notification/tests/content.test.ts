import { describe, expect, it } from "bun:test";

import {
  NOTIFICATION_EVENT_CATEGORY_IDS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PUSH_CATEGORY_IDS,
} from "../../../shared/notifications/protocol";
import { buildNotificationContent } from "../definitions";

describe("notification content", () => {
  it("builds the manager notification for a league join request", () => {
    const content = buildNotificationContent({
      actorName: "Ana Silva",
      eventType: "league.membership.requested",
      leagueId: "league-1",
      leagueName: "Santa Elena",
      recipientRole: "organizer",
    });

    expect(content).toEqual({
      body: "Ana Silva pediu para entrar na liga Santa Elena.",
      categoryId: "league_membership_request",
      data: {
        eventType: "league.membership.requested",
        leagueId: "league-1",
        url: "/leagues/league-1/requests",
      },
      title: "Nova solicitação de entrada",
    });
  });

  it("builds the player notification for a received challenge", () => {
    const content = buildNotificationContent({
      actorName: "Bruno Garcia",
      eventType: "league.challenge.created",
      leagueId: "league-2",
      leagueName: "BR Open",
      recipientRole: "player",
    });

    expect(content).toEqual({
      body: "Bruno Garcia desafiou você na liga BR Open.",
      data: {
        eventType: "league.challenge.created",
        leagueId: "league-2",
        url: "/leagues/league-2/challenges",
      },
      title: "Novo desafio recebido",
    });
  });

  it("keeps custom data without losing route metadata", () => {
    const content = buildNotificationContent({
      actorName: "Bruno Garcia",
      eventType: "league.challenge.result_submitted",
      leagueId: "league-3",
      leagueName: "BR Open",
      metadata: { challengeId: "challenge-1" },
      recipientRole: "player",
    });

    expect(content.data).toEqual({
      challengeId: "challenge-1",
      eventType: "league.challenge.result_submitted",
      leagueId: "league-3",
      url: "/leagues/league-3/challenges",
    });
  });

  it("builds content for every protocol event type", () => {
    const contents = NOTIFICATION_EVENT_TYPES.map((eventType) =>
      buildNotificationContent({
        actorName: "Bruno Garcia",
        eventType,
        leagueId: "league-1",
        leagueName: "BR Open",
        recipientRole: "player",
      })
    );

    expect(contents).toHaveLength(NOTIFICATION_EVENT_TYPES.length);
    expect(contents.every((content) => content.title.length > 0)).toBe(true);
    expect(contents.every((content) => content.body.length > 0)).toBe(true);
    expect(contents.map((content) => content.data.eventType)).toEqual([
      ...NOTIFICATION_EVENT_TYPES,
    ]);
  });

  it("keeps actionable event categories aligned with the protocol", () => {
    const content = buildNotificationContent({
      actorName: "Ana Silva",
      eventType: "league.membership.requested",
      leagueId: "league-1",
      leagueName: "Santa Elena",
      recipientRole: "organizer",
    });

    expect(content.categoryId).toBe(
      NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"]
    );
    expect(NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"]).toBe(
      NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest
    );
  });

  describe("league.membership.renewal_reminder", () => {
    const build = (metadata: Record<string, unknown>) =>
      buildNotificationContent({
        eventType: "league.membership.renewal_reminder",
        leagueId: "league-1",
        leagueName: "Santa Elena",
        metadata,
        recipientRole: "player",
      });

    it("interpolates the real days left", () => {
      const content = build({ cycleEndMs: 1_700_000_000_000, daysLeft: 3 });

      expect(content.title).toBe("Renovação em 3 dias");
      expect(content.body).toBe(
        "Sua inscrição na liga Santa Elena vence em 3 dias. Renove para continuar participando."
      );
    });

    it("says today while the due date is still today", () => {
      const content = build({ daysLeft: 0 });

      expect(content.title).toBe("Renovação hoje");
      expect(content.body).toBe(
        "Sua inscrição na liga Santa Elena vence hoje. Renove para continuar participando."
      );
    });

    it("says tomorrow when only the next day is left", () => {
      const content = build({ daysLeft: 1 });

      expect(content.title).toBe("Renovação amanhã");
      expect(content.body).toContain("vence amanhã.");
    });

    it("keeps the generic wording for rows without a countdown", () => {
      const content = build({});

      expect(content.title).toBe("Renovação próxima");
      expect(content.body).toBe(
        "Sua inscrição na liga Santa Elena vence em breve. Renove para continuar participando."
      );
    });

    it("links to the checkout only for a PENDING charge", () => {
      expect(build({ chargeId: "charge-1", daysLeft: 2 }).data.url).toBe(
        "/checkout/charge-1"
      );
      // Without a PENDING charge the backend omits `chargeId`, so the tap lands
      // on the league instead of a charge that no longer has a QR code.
      expect(build({ daysLeft: 2 }).data.url).toBe("/leagues/league-1");
    });
  });
});
