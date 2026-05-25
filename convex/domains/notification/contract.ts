import { z } from "zod";

import { NOTIFICATION_EVENT_TYPES } from "../../shared/notifications/protocol";
import type {
  NotificationPermissionStatus,
  PushReadinessReason,
} from "./state";

export const NotificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);

export const NotificationPermissionStatusSchema = z.enum([
  "denied",
  "granted",
  "undetermined",
] satisfies [NotificationPermissionStatus, ...NotificationPermissionStatus[]]);

export const NotificationReadinessReasonSchema = z.enum([
  "missing_device",
  "permission_denied",
  "permission_undetermined",
  "preference_disabled",
  "ready",
] satisfies [PushReadinessReason, ...PushReadinessReason[]]);

export const NotificationDeliveryStateSchema = z.enum([
  "awaiting_delivery",
  "in_progress",
  "delivered",
  "needs_retry",
  "failed",
  "maybe_delivered",
  "unable_to_deliver",
]);

export const NotificationDevicePlatformSchema = z.enum([
  "android",
  "ios",
  "web",
]);

export const notificationFeedItemSchema = z.object({
  actorUserId: z.string().nullable(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  eventType: NotificationEventTypeSchema,
  id: z.string(),
  isRead: z.boolean(),
  occurredAt: z.number(),
  readAt: z.number().nullable(),
  recipientUserId: z.string(),
  title: z.string(),
});

export const notificationStatusSchema = z.object({
  canReceivePush: z.boolean(),
  deviceCount: z.number().int().nonnegative(),
  permissionStatus: NotificationPermissionStatusSchema,
  pushEnabled: z.boolean(),
  readinessReason: NotificationReadinessReasonSchema,
  unreadCount: z.number().int().nonnegative(),
});

export const SetNotificationPreferenceSchema = z.object({
  pushEnabled: z.boolean(),
});

export const UpsertNotificationDeviceSchema = z.object({
  expoPushToken: z.string().min(1),
  permissionStatus: NotificationPermissionStatusSchema,
  platform: NotificationDevicePlatformSchema,
});

export const MarkNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

export const RemoveNotificationSchema = z.object({
  notificationId: z.string().min(1),
});

export const ListNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export type NotificationFeedItem = z.infer<typeof notificationFeedItemSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
