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
import * as playerTables from "../player/tables";

export const notificationPreference = convexTable(
  "notificationPreference",
  {
    pushEnabled: boolean().notNull(),
    updatedAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .references(() => authTables.user.id, { onDelete: "cascade" }),
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
      .references(() => authTables.user.id, { onDelete: "cascade" }),
  },
  (notificationDevice) => [
    index("expoPushToken").on(notificationDevice.expoPushToken),
    index("userId").on(notificationDevice.userId),
  ]
);

export const notificationFeed = convexTable(
  "notificationFeed",
  {
    actorUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    body: text().notNull(),
    data: json<Record<string, unknown>>().notNull(),
    eventType: text().notNull(),
    isRead: boolean().notNull(),
    occurredAt: timestamp().notNull(),
    readAt: timestamp(),
    recipientActorKind: text().notNull(),
    // Retraction: when a challenge is cancelled/rescheduled, prior
    // notifications about it should be retracted rather than orphaned.
    retractedAt: timestamp(),
    sourceEntityId: text(),
    sourceEntityType: text(),
    status: textEnum(["active", "retracted"]).default("active"),
    recipientOrganizationId: id("organization").references(
      () => authTables.organization.id,
      { onDelete: "cascade" }
    ),
    recipientPlayerProfileId: id("playerProfile").references(
      () => playerTables.playerProfile.id,
      { onDelete: "cascade" }
    ),
    recipientUserId: id("user")
      .notNull()
      .references(() => authTables.user.id, { onDelete: "cascade" }),
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
    index("recipientUserId_actorKind_isRead").on(
      notificationFeed.recipientUserId,
      notificationFeed.recipientActorKind,
      notificationFeed.isRead
    ),
    index("recipientUserId_actorKind_occurredAt").on(
      notificationFeed.recipientUserId,
      notificationFeed.recipientActorKind,
      notificationFeed.occurredAt
    ),
    index("recipientPlayerProfileId_occurredAt").on(
      notificationFeed.recipientPlayerProfileId,
      notificationFeed.occurredAt
    ),
    index("recipientOrganizationId_occurredAt").on(
      notificationFeed.recipientOrganizationId,
      notificationFeed.occurredAt
    ),
    index("actorUserId").on(notificationFeed.actorUserId),
    index("eventType").on(notificationFeed.eventType),
    index("sourceEntity").on(
      notificationFeed.sourceEntityType,
      notificationFeed.sourceEntityId
    ),
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
      .references(() => notificationDevice.id, { onDelete: "cascade" }),
    errorMessage: text(),
    expoPushToken: text().notNull(),
    feedId: id("notificationFeed")
      .notNull()
      .references(() => notificationFeed.id, { onDelete: "cascade" }),
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

// Single-row lock used to dedupe `sendPending` scheduler invocations. Without
// it, concurrent `createForRecipients` calls and the self-chaining
// `scheduleNextBatch` each enqueue a redundant `sendPending` runner, wasting
// scheduler budget. The lock is keyed by `key` (only "sendPending" today) and
// expires after `expiresAt`, so a crashed runner can't wedge the pipeline.
export const notificationDeliveryLock = convexTable(
  "notificationDeliveryLock",
  {
    key: text().notNull(),
    claimedAt: timestamp().notNull(),
    expiresAt: timestamp().notNull(),
  },
  (notificationDeliveryLock) => [index("key").on(notificationDeliveryLock.key)]
);
