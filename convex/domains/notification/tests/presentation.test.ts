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

const tournamentBase = {
  actorName: "Bruno Garcia",
  recipientRole: "player",
  tournamentId: "tournament-1",
  tournamentName: "Copa Verão",
} satisfies Omit<NotificationContentInput, "eventType">;

describe("notification presentation", () => {
  it("declares exactly the actionable event types", () => {
    expect([...NOTIFICATION_ACTIONABLE_EVENT_TYPES].sort()).toEqual([
      "tournament.entry.created",
      "tournament.partner.invited",
    ]);
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

  it("drops the action when the emitter did not send the id it needs", () => {
    // O botao nao pode nascer sem o dado que a mutation exige: sem id, o item
    // vira informativo em vez de botao morto.
    expect(
      buildNotificationPresentation({
        ...tournamentBase,
        eventType: "tournament.partner.invited",
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
          ...tournamentBase,
          eventType,
          metadata: { chargeId: "charge-1", entryId: "entry-1" },
        })
      ).toBeNull();
    }
  });

  it("keeps an informative post payment event without any button", () => {
    // `tournament.entry.confirmed` com chargeId e pos pagamento: um botao de
    // pagar ali mentiria.
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
        ...tournamentBase,
        eventType: "tournament.entry.created",
        metadata: { entryId: "entry-1" },
        recipientRole: "organizer",
      },
      {
        ...tournamentBase,
        eventType: "tournament.partner.invited",
        metadata: { entryId: "entry-1" },
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
        eventType: "tournament.entry.created",
        metadata: { entryId: "entry-1" },
        recipientRole: "player",
        tournamentId: "tournament-1",
        tournamentName: "Copa Verão",
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
        "bruno garcia se inscreveu em Copa Verão.",
        "Bruno Garcia"
      )
    ).toBe("bruno garcia");
  });

  it("finds the actor name when the body mentions it normally", () => {
    expect(
      findActorNameInBody(
        "Bruno Garcia se inscreveu em Copa Verão.",
        "Bruno Garcia"
      )
    ).toBe("Bruno Garcia");
  });

  it("returns no highlight when the body does not mention the actor", () => {
    expect(
      findActorNameInBody(
        "Um jogador se inscreveu em Copa Verão.",
        "Bruno Garcia"
      )
    ).toBeNull();
  });

  it("treats the actor name literally, even with regex characters", () => {
    expect(
      findActorNameInBody("Ana (Ju) se inscreveu em Copa Verão.", "Ana (Ju)")
    ).toBe("Ana (Ju)");
  });
});
