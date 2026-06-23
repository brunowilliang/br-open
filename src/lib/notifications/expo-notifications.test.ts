import { describe, expect, it } from "bun:test";

import {
  shouldOpenNotificationSettingsAlert,
  shouldRequestPushPermission,
} from "./notification-permission-rules";

describe("expo-notifications predicates", () => {
  describe("shouldRequestPushPermission", () => {
    it("requests when no device is registered and status is undetermined", () => {
      expect(
        shouldRequestPushPermission({
          deviceCount: 0,
          permissionStatus: "undetermined",
        })
      ).toBe(true);
    });

    it("does not request when a device is already registered", () => {
      expect(
        shouldRequestPushPermission({
          deviceCount: 1,
          permissionStatus: "granted",
        })
      ).toBe(false);
      // even if permission is undetermined, an existing device means we don't
      // re-trigger the system prompt.
      expect(
        shouldRequestPushPermission({
          deviceCount: 1,
          permissionStatus: "undetermined",
        })
      ).toBe(false);
    });

    it("does not request once the user has decided (granted or denied)", () => {
      expect(
        shouldRequestPushPermission({
          deviceCount: 0,
          permissionStatus: "granted",
        })
      ).toBe(false);
      expect(
        shouldRequestPushPermission({
          deviceCount: 0,
          permissionStatus: "denied",
        })
      ).toBe(false);
    });
  });

  describe("shouldOpenNotificationSettingsAlert", () => {
    it("opens the alert when permission is not granted", () => {
      expect(shouldOpenNotificationSettingsAlert("denied")).toBe(true);
      expect(shouldOpenNotificationSettingsAlert("undetermined")).toBe(true);
    });

    it("does not open the alert when permission is granted", () => {
      expect(shouldOpenNotificationSettingsAlert("granted")).toBe(false);
    });
  });
});
