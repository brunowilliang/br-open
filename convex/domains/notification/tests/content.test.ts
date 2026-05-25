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
      recipientRole: "manager",
    });

    expect(content).toEqual({
      body: "Ana Silva pediu para entrar na liga Santa Elena.",
      categoryId: "league_membership_request",
      data: {
        eventType: "league.membership.requested",
        leagueId: "league-1",
        url: "/leagues/league-1?tab=requests",
      },
      title: "Nova solicitacao de entrada",
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
      body: "Bruno Garcia desafiou voce na liga BR Open.",
      data: {
        eventType: "league.challenge.created",
        leagueId: "league-2",
        url: "/leagues/league-2?tab=challenges",
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
      url: "/leagues/league-3?tab=challenges",
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
      recipientRole: "manager",
    });

    expect(content.categoryId).toBe(
      NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"]
    );
    expect(NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"]).toBe(
      NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest
    );
  });
});
