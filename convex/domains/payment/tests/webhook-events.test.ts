import { describe, expect, it } from "bun:test";

import {
  type WooviWebhookPayload,
  OPENPIX_CHARGE_COMPLETED,
  OPENPIX_CHARGE_EXPIRED,
  OPENPIX_TRANSACTION_RECEIVED,
} from "../webhook-events";

describe("Woovi webhook payload narrowing", () => {
  // Helper that mirrors how the route handler narrows the union.
  function describeEvent(payload: WooviWebhookPayload): string {
    if (
      payload.event === OPENPIX_TRANSACTION_RECEIVED ||
      payload.event === OPENPIX_CHARGE_COMPLETED
    ) {
      // TS narrows: payload.charge is accessible on these variants.
      if (!("charge" in payload)) {
        return "paid:no-charge";
      }
      return `paid:${payload.charge.correlationID}`;
    }
    if (payload.event === OPENPIX_CHARGE_EXPIRED) {
      if (!("charge" in payload)) {
        return "expired:no-charge";
      }
      return `expired:${payload.charge.correlationID}`;
    }
    return `ignored:${payload.event}`;
  }

  it("narrows TRANSACTION_RECEIVED and exposes charge.correlationID", () => {
    const payload: WooviWebhookPayload = {
      charge: {
        correlationID: "bropen:m1:1700000000",
        status: "COMPLETED",
        value: 5000,
      },
      event: OPENPIX_TRANSACTION_RECEIVED,
    };
    expect(describeEvent(payload)).toBe("paid:bropen:m1:1700000000");
  });

  it("narrows CHARGE_COMPLETED as a paid alias", () => {
    const payload: WooviWebhookPayload = {
      charge: {
        correlationID: "bropen:m2:1700000001",
        status: "COMPLETED",
        value: 9000,
      },
      event: OPENPIX_CHARGE_COMPLETED,
    };
    expect(describeEvent(payload)).toBe("paid:bropen:m2:1700000001");
  });

  it("narrows CHARGE_EXPIRED and exposes charge.correlationID", () => {
    const payload: WooviWebhookPayload = {
      charge: { correlationID: "bropen:m3:1700000002", status: "EXPIRED" },
      event: OPENPIX_CHARGE_EXPIRED,
    };
    expect(describeEvent(payload)).toBe("expired:bropen:m3:1700000002");
  });

  it("treats other events as ignored (no charge access)", () => {
    const payload: WooviWebhookPayload = {
      event: "OPENPIX:PROPOSAL_ACCEPTED",
    };
    expect(describeEvent(payload)).toBe("ignored:OPENPIX:PROPOSAL_ACCEPTED");
  });
});
