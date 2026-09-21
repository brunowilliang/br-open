import { describe, expect, it } from "bun:test";

import { NOTIFICATION_EVENT_TYPES } from "../../../shared/notifications/protocol";
import {
  buildNotificationContent,
  type NotificationContentInput,
} from "../definitions";
import {
  buildNotificationPresentation,
  findActorNameInBody,
  NOTIFICATION_ACTIONABLE_EVENT_TYPES,
} from "../presentation";

const leagueBase = {
  actorName: "Bruno Garcia",
  leagueId: "league-1",
  leagueName: "BR Open",
  recipientRole: "player",
} satisfies Omit<NotificationContentInput, "eventType">;

const tournamentBase = {
  actorName: "Bruno Garcia",
  recipientRole: "player",
  tournamentId: "tournament-1",
  tournamentName: "Copa Verão",
} satisfies Omit<NotificationContentInput, "eventType">;

describe("notification presentation", () => {
  it("declares exactly the actionable event types", () => {
    expect([...NOTIFICATION_ACTIONABLE_EVENT_TYPES].sort()).toEqual([
      "league.challenge.cancellation_requested",
      "league.challenge.counter_proposed",
      "league.challenge.created",
      "league.challenge.result_submitted",
      "league.challenge.walkover_submitted",
      "league.membership.payment_due",
      "league.membership.payment_expired",
      "league.membership.renewal_due",
      "league.membership.renewal_reminder",
      "league.membership.requested",
      "tournament.entry.created",
      "tournament.partner.invited",
    ]);
  });

  it("builds the organizer decision for a league join request", () => {
    expect(
      buildNotificationPresentation({
        ...leagueBase,
        eventType: "league.membership.requested",
        metadata: { membershipId: "membership-1" },
        recipientRole: "organizer",
      })
    ).toEqual({
      action: {
        params: { membershipId: "membership-1" },
        type: "approve_league_membership",
      },
      actionLabel: "Aprovar",
      bodyHighlights: ["Bruno Garcia"],
      secondaryAction: {
        params: { membershipId: "membership-1" },
        type: "reject_league_membership",
      },
      secondaryActionLabel: "Recusar",
    });
  });

  it("builds the organizer decision for a tournament entry", () => {
    expect(
      buildNotificationPresentation({
        ...tournamentBase,
        eventType: "tournament.entry.created",
        metadata: { entryId: "entry-1" },
        recipientRole: "organizer",
      })
    ).toEqual({
      action: {
        params: { entryId: "entry-1" },
        type: "approve_tournament_entry",
      },
      actionLabel: "Aprovar",
      bodyHighlights: ["Bruno Garcia"],
      secondaryAction: {
        params: { entryId: "entry-1" },
        type: "reject_tournament_entry",
      },
      secondaryActionLabel: "Recusar",
    });
  });

  it("builds the invite decision from the entry id", () => {
    expect(
      buildNotificationPresentation({
        ...tournamentBase,
        eventType: "tournament.partner.invited",
        metadata: { entryId: "entry-1" },
      })
    ).toEqual({
      action: {
        params: { entryId: "entry-1" },
        type: "accept_partner_invite",
      },
      actionLabel: "Aceitar",
      bodyHighlights: ["Bruno Garcia"],
      secondaryAction: {
        params: { entryId: "entry-1" },
        type: "decline_partner_invite",
      },
      secondaryActionLabel: "Recusar",
    });
  });

  it("builds the same proposal decision for a challenge and its counter proposal", () => {
    for (const eventType of [
      "league.challenge.created",
      "league.challenge.counter_proposed",
    ] as const) {
      expect(
        buildNotificationPresentation({
          ...leagueBase,
          eventType,
          metadata: { challengeId: "challenge-1" },
        })
      ).toEqual({
        action: {
          params: { challengeId: "challenge-1" },
          type: "accept_challenge_proposal",
        },
        actionLabel: "Aceitar",
        bodyHighlights: ["Bruno Garcia"],
        secondaryAction: {
          params: { challengeId: "challenge-1" },
          type: "decline_challenge_proposal",
        },
        secondaryActionLabel: "Recusar",
      });
    }
  });

  it("builds the cancellation decision for a challenge", () => {
    expect(
      buildNotificationPresentation({
        ...leagueBase,
        eventType: "league.challenge.cancellation_requested",
        metadata: { challengeId: "challenge-1" },
      })
    ).toEqual({
      action: {
        params: { challengeId: "challenge-1" },
        type: "accept_challenge_cancellation",
      },
      actionLabel: "Aceitar",
      bodyHighlights: ["Bruno Garcia"],
      secondaryAction: {
        params: { challengeId: "challenge-1" },
        type: "decline_challenge_cancellation",
      },
      secondaryActionLabel: "Recusar",
    });
  });

  it("asks to confirm the submitted result, including the W.O. submission", () => {
    for (const eventType of [
      "league.challenge.result_submitted",
      "league.challenge.walkover_submitted",
    ] as const) {
      expect(
        buildNotificationPresentation({
          ...leagueBase,
          eventType,
          metadata: { challengeId: "challenge-1" },
        })
      ).toEqual({
        action: {
          params: { challengeId: "challenge-1" },
          type: "confirm_challenge_result",
        },
        actionLabel: "Confirmar",
        bodyHighlights: ["Bruno Garcia"],
        secondaryAction: null,
        secondaryActionLabel: null,
      });
    }
  });

  it("labels the membership payment by what the state asks for", () => {
    const labels = {
      "league.membership.payment_due": "Pagar",
      "league.membership.payment_expired": "Pagar",
      "league.membership.renewal_due": "Renovar",
      "league.membership.renewal_reminder": "Renovar",
    } as const;

    for (const [eventType, actionLabel] of Object.entries(labels)) {
      const presentation = buildNotificationPresentation({
        ...leagueBase,
        eventType: eventType as keyof typeof labels,
        metadata: { membershipId: "membership-1" },
      });

      expect(presentation?.action).toEqual({
        params: { membershipId: "membership-1" },
        type: "pay_league_membership",
      });
      expect(presentation?.actionLabel).toBe(actionLabel);
      expect(presentation?.secondaryAction).toBeNull();
    }
  });

  it("drops the action when the emitter did not send the id it needs", () => {
    // O botao nao pode nascer sem o dado que a mutation exige: sem id, o item
    // vira informativo em vez de botao morto.
    expect(
      buildNotificationPresentation({
        ...tournamentBase,
        eventType: "tournament.partner.invited",
      })
    ).toBeNull();
    expect(
      buildNotificationPresentation({
        ...leagueBase,
        eventType: "league.membership.payment_due",
      })
    ).toBeNull();
  });

  it("treats every other event type as informative", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPES) {
      if (NOTIFICATION_ACTIONABLE_EVENT_TYPES.includes(eventType)) {
        continue;
      }

      expect(
        buildNotificationPresentation({
          ...leagueBase,
          eventType,
          metadata: { chargeId: "charge-1", membershipId: "membership-1" },
        })
      ).toBeNull();
    }
  });

  it("keeps an informative post payment event without any button", () => {
    // Decisao do IBX-0077: `tournament.entry.confirmed` com chargeId e
    // pos pagamento, entao um botao de pagar ali mentiria.
    expect(
      buildNotificationPresentation({
        ...tournamentBase,
        eventType: "tournament.entry.confirmed",
        metadata: { chargeId: "charge-1" },
      })
    ).toBeNull();
  });

  it("highlights only text that really exists in the body", () => {
    const inputs = [
      {
        ...leagueBase,
        eventType: "league.membership.requested",
        metadata: { membershipId: "membership-1" },
        recipientRole: "organizer",
      },
      {
        ...tournamentBase,
        eventType: "tournament.partner.invited",
        metadata: { entryId: "entry-1" },
      },
      {
        ...leagueBase,
        eventType: "league.challenge.created",
        metadata: { challengeId: "challenge-1" },
      },
    ] satisfies NotificationContentInput[];

    for (const input of inputs) {
      const body = buildNotificationContent(input).body;
      const highlights =
        buildNotificationPresentation(input)?.bodyHighlights ?? [];

      expect(highlights.length).toBeGreaterThan(0);

      for (const highlight of highlights) {
        expect(body).toContain(highlight);
      }
    }
  });

  it("does not highlight the generic actor placeholder", () => {
    expect(
      buildNotificationPresentation({
        eventType: "league.challenge.created",
        leagueId: "league-1",
        leagueName: "BR Open",
        metadata: { challengeId: "challenge-1" },
        recipientRole: "player",
      })?.bodyHighlights
    ).toEqual([]);
  });

  it("takes the highlight from the rendered body, not from the input name", () => {
    // O corpo citando o nome em CAIXA diferente da entrada continua gerando
    // destaque, e o trecho destacado e o que o corpo mostra (era o buraco do
    // recorte case-sensitive sobre a entrada).
    expect(
      findActorNameInBody(
        "BRUNO GARCIA se inscreveu em Copa Verão.",
        "Bruno Garcia"
      )
    ).toBe("BRUNO GARCIA");
    expect(
      findActorNameInBody(
        "bruno garcia desafiou você na liga BR Open.",
        "Bruno Garcia"
      )
    ).toBe("bruno garcia");
  });

  it("finds the actor name when the body mentions it normally", () => {
    expect(
      findActorNameInBody(
        "Bruno Garcia pediu para entrar na liga.",
        "Bruno Garcia"
      )
    ).toBe("Bruno Garcia");
  });

  it("returns no highlight when the body does not mention the actor", () => {
    expect(
      findActorNameInBody("Um jogador desafiou você na liga.", "Bruno Garcia")
    ).toBeNull();
  });

  it("treats the actor name literally, even with regex characters", () => {
    expect(
      findActorNameInBody("Ana (Ju) se inscreveu em Copa Verão.", "Ana (Ju)")
    ).toBe("Ana (Ju)");
  });
});
