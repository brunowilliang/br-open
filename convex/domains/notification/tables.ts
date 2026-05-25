import {
  boolean,
  convexTable,
  id,
  index,
  integer,
  json,
  text,
  textEnum,
  timestamp,
} from "kitcn/orm";

import * as authTables from "../auth/tables";

export const notificationPreference = convexTable(
  "notificationPreference",
  {
    pushEnabled: boolean().notNull(),
    updatedAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .references(() => authTables.user.id),
  },
  (notificationPreference) => [
    index("userId").on(notificationPreference.userId),
  ]
);

export const notificationDevice = convexTable(
  "notificationDevice",
  {
    disabledAt: timestamp(),
    expoPushToken: text().notNull(),
    lastSeenAt: timestamp().notNull(),
    permissionStatus: text().notNull(),
    platform: text().notNull(),
    registeredAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .references(() => authTables.user.id),
  },
  (notificationDevice) => [
    index("expoPushToken").on(notificationDevice.expoPushToken),
    index("userId").on(notificationDevice.userId),
  ]
);

export const notificationFeed = convexTable(
  "notificationFeed",
  {
    actorUserId: id("user").references(() => authTables.user.id),
    body: text().notNull(),
    data: json<Record<string, unknown>>().notNull(),
    eventType: text().notNull(),
    isRead: boolean().notNull(),
    occurredAt: timestamp().notNull(),
    readAt: timestamp(),
    recipientUserId: id("user")
      .notNull()
      .references(() => authTables.user.id),
    title: text().notNull(),
  },
  (notificationFeed) => [
    index("recipientUserId_isRead").on(
      notificationFeed.recipientUserId,
      notificationFeed.isRead
    ),
    index("recipientUserId_occurredAt").on(
      notificationFeed.recipientUserId,
      notificationFeed.occurredAt
    ),
    index("eventType").on(notificationFeed.eventType),
  ]
);

const notificationDeliveryState = textEnum([
  "awaiting_delivery",
  "in_progress",
  "delivered",
  "needs_retry",
  "failed",
  "maybe_delivered",
  "unable_to_deliver",
] as const).notNull();

export const notificationDelivery = convexTable(
  "notificationDelivery",
  {
    attempts: integer().notNull(),
    deliveredAt: timestamp(),
    deviceId: id("notificationDevice")
      .notNull()
      .references(() => notificationDevice.id),
    errorMessage: text(),
    expoPushToken: text().notNull(),
    feedId: id("notificationFeed")
      .notNull()
      .references(() => notificationFeed.id),
    lastAttemptAt: timestamp(),
    responseId: text(),
    state: notificationDeliveryState,
  },
  (notificationDelivery) => [
    index("deviceId").on(notificationDelivery.deviceId),
    index("feedId").on(notificationDelivery.feedId),
    index("state").on(notificationDelivery.state),
  ]
);
