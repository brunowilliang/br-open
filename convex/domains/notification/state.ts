export type NotificationPermissionStatus =
  | "denied"
  | "granted"
  | "undetermined";

export type PushReadinessInput = {
  deviceCount: number;
  permissionStatus: NotificationPermissionStatus;
  pushEnabled: boolean;
};

export type PushReadinessReason =
  | "missing_device"
  | "permission_denied"
  | "permission_undetermined"
  | "preference_disabled"
  | "ready";

export type PushReadiness = {
  canReceivePush: boolean;
  reason: PushReadinessReason;
};

export function resolvePushReadiness(input: PushReadinessInput): PushReadiness {
  if (!input.pushEnabled) {
    return { canReceivePush: false, reason: "preference_disabled" };
  }

  if (input.permissionStatus === "denied") {
    return { canReceivePush: false, reason: "permission_denied" };
  }

  if (input.permissionStatus === "undetermined") {
    return { canReceivePush: false, reason: "permission_undetermined" };
  }

  if (input.deviceCount === 0) {
    return { canReceivePush: false, reason: "missing_device" };
  }

  return { canReceivePush: true, reason: "ready" };
}
