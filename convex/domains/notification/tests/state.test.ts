import { describe, expect, it } from "bun:test";

import { resolvePushReadiness } from "../state";

describe("notification push readiness", () => {
  it("keeps user preference separate from device readiness", () => {
    expect(
      resolvePushReadiness({
        deviceCount: 0,
        permissionStatus: "granted",
        pushEnabled: true,
      })
    ).toEqual({
      canReceivePush: false,
      reason: "missing_device",
    });
  });

  it("does not receive push when the user preference is off", () => {
    expect(
      resolvePushReadiness({
        deviceCount: 1,
        permissionStatus: "granted",
        pushEnabled: false,
      })
    ).toEqual({
      canReceivePush: false,
      reason: "preference_disabled",
    });
  });

  it("receives push only when preference, permission, and device are ready", () => {
    expect(
      resolvePushReadiness({
        deviceCount: 1,
        permissionStatus: "granted",
        pushEnabled: true,
      })
    ).toEqual({
      canReceivePush: true,
      reason: "ready",
    });
  });
});
