import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { NotificationPermissionStatus } from "./notification-permission-rules";
import {
  LEAGUE_MEMBERSHIP_REQUEST_NOTIFICATION_ACTIONS,
  NOTIFICATION_CATEGORY_IDENTIFIERS,
} from "./response-intent";

// Pure permission predicates live in ./notification-permission-rules so they
// can be unit-tested without importing react-native. The status type is
// re-exported from there as the canonical definition.
export type { NotificationPermissionStatus };

export type PushDevicePlatform = "android" | "ios" | "web";

export type PushDeviceRegistration = {
  expoPushToken: string | null;
  permissionStatus: NotificationPermissionStatus;
  platform: PushDevicePlatform;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getPlatform = (): PushDevicePlatform => {
  if (Platform.OS === "android") {
    return "android";
  }

  if (Platform.OS === "ios") {
    return "ios";
  }

  return "web";
};

const normalizePermissionStatus = (
  permissions: Notifications.NotificationPermissionsStatus
): NotificationPermissionStatus => {
  if (
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return "granted";
  }

  if (permissions.status === Notifications.PermissionStatus.DENIED) {
    return "denied";
  }

  return "undetermined";
};

const getProjectId = () => {
  const expoConfigProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const easConfigProjectId = Constants.easConfig?.projectId;

  if (typeof expoConfigProjectId === "string") {
    return expoConfigProjectId;
  }

  if (typeof easConfigProjectId === "string") {
    return easConfigProjectId;
  }

  throw new Error("Expo EAS projectId nao configurado.");
};

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    importance: Notifications.AndroidImportance.MAX,
    lightColor: "#208AEF",
    name: "Notificacoes",
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function registerNotificationCategoriesAsync() {
  if (Platform.OS === "web") {
    return;
  }

  await Notifications.setNotificationCategoryAsync(
    NOTIFICATION_CATEGORY_IDENTIFIERS.leagueMembershipRequest,
    LEAGUE_MEMBERSHIP_REQUEST_NOTIFICATION_ACTIONS.map((action) => ({
      buttonTitle: action.buttonTitle,
      identifier: action.identifier,
      options: { ...action.options },
    }))
  );
}

export async function registerForPushNotificationsAsync(input: {
  requestPermission: boolean;
}): Promise<PushDeviceRegistration> {
  await ensureAndroidNotificationChannel();

  let permissions = await Notifications.getPermissionsAsync();

  if (
    input.requestPermission &&
    normalizePermissionStatus(permissions) !== "granted"
  ) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  const permissionStatus = normalizePermissionStatus(permissions);

  if (permissionStatus !== "granted" || !Device.isDevice) {
    return {
      expoPushToken: null,
      permissionStatus,
      platform: getPlatform(),
    };
  }

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() })
  ).data;

  return {
    expoPushToken,
    permissionStatus,
    platform: getPlatform(),
  };
}

export async function getPushPermissionStatusAsync() {
  await ensureAndroidNotificationChannel();

  const permissions = await Notifications.getPermissionsAsync();

  return normalizePermissionStatus(permissions);
}
