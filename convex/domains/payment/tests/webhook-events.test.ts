import { describe, expect, it } from "bun:test";

import {
  type AbacatePayWebhookPayload,
  CHECKOUT_COMPLETED,
  PAYOUT_FAILED,
  TRANSPARENT_COMPLETED,
  TRANSPARENT_REFUNDED,
} from "../webhook-events";

describe("AbacatePay webhook payload narrowing", () => {
  // Helper that mirrors how the route handler narrows the union. Extracting
  // it here lets us assert type + runtime behavior together.
  function describeEvent(payload: AbacatePayWebhookPayload): string {
    if (payload.event === TRANSPARENT_COMPLETED) {
      // TS narrows: payload.data.transparent is accessible.
      return `completed:${payload.data.transparent.id}`;
    }
    if (payload.event === TRANSPARENT_REFUNDED) {
      return `refunded:${payload.data.transparent.id}`;
    }
    return `ignored:${payload.event}`;
  }

  it("narrows transparent.completed and exposes transparent.id", () => {
    const payload: AbacatePayWebhookPayload = {
      event: TRANSPARENT_COMPLETED,
      data: {
        transparent: {
          id: "pix_char_abc",
          externalId: null,
          amount: 5000,
          paidAmount: 5000,
          platformFee: 80,
          status: "PAID",
        },
      },
    };
    expect(describeEvent(payload)).toBe("completed:pix_char_abc");
  });

  it("narrows transparent.refunded and exposes transparent.id", () => {
    const payload: AbacatePayWebhookPayload = {
      event: TRANSPARENT_REFUNDED,
      data: { transparent: { id: "pix_char_xyz", status: "REFUNDED" } },
    };
    expect(describeEvent(payload)).toBe("refunded:pix_char_xyz");
  });

  it("treats other events as ignored (no transparent access)", () => {
    const payload: AbacatePayWebhookPayload = {
      event: CHECKOUT_COMPLETED,
      data: {},
    };
    expect(describeEvent(payload)).toBe("ignored:checkout.completed");
  });

  it("treats payout events as ignored", () => {
    const payload: AbacatePayWebhookPayload = {
      event: PAYOUT_FAILED,
      data: {},
    };
    expect(describeEvent(payload)).toBe("ignored:payout.failed");
  });

  it("exposes metadata when present on transparent.completed", () => {
    const payload: AbacatePayWebhookPayload = {
      event: TRANSPARENT_COMPLETED,
      data: {
        transparent: {
          id: "pix_char_md",
          externalId: null,
          amount: 9000,
          paidAmount: null,
          platformFee: 80,
          status: "PAID",
          metadata: {
            leagueId: "n572hhb2mjsehjeje74swnd7j588gq1j",
            membershipId: "n9739m0wweb4a1hcx1thtx071x88hs1y",
          },
        },
      },
    };
    if (payload.event === TRANSPARENT_COMPLETED) {
      expect(payload.data.transparent.metadata?.membershipId).toBe(
        "n9739m0wweb4a1hcx1thtx071x88hs1y"
      );
    }
  });
});
