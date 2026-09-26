/**
 * Notification feed access rules — pure functions.
 *
 * Moved out of `functions/notification/feed.ts` (and desuplicated from
 * `settings.ts`, where `isNotificationForActiveActor` was copied verbatim)
 * so the rules can be tested in isolation from the CRPC procedures.
 */

import { NOTIFICATION_EVENT_TYPES } from "../../shared/notifications/protocol";
import type { ActorKind } from "../auth/actor-context";

type NotificationActorLike = {
  // Loosened to `string` to accept raw DB rows (`recipientActorKind` is `text()`).
  // The zod schema (notificationFeedItemSchema) is the authority for valid values.
  recipientActorKind?: ActorKind | string;
  recipientOrganizationId?: null | string;
  recipientPlayerProfileId?: null | string;
};

type ActiveActorLike = { id: string; kind: ActorKind };

/**
 * Whether a feed row belongs to the viewer's currently active actor
 * (organization vs player). A notification routed to the organization
 * manager must not be visible when the viewer is in player mode, and
 * vice versa.
 */
export function isNotificationForActiveActor(
  notification: NotificationActorLike,
  activeActor: ActiveActorLike
): boolean {
  if (notification.recipientActorKind !== activeActor.kind) {
    return false;
  }

  if (activeActor.kind === "organization") {
    return notification.recipientOrganizationId === activeActor.id;
  }

  return notification.recipientPlayerProfileId === activeActor.id;
}

/**
 * Whether a user may mark a notification as read. Currently a simple
 * ownership check (recipient === viewer), but extracted as a rule so the
 * policy lives in one place if it ever needs to account for managers
 * acting on behalf of a user, etc.
 */
export function canMarkNotificationReadForUser(input: {
  notification: { recipientUserId: string };
  userId: string;
}): boolean {
  return input.notification.recipientUserId === input.userId;
}

/**
 * Whether this app version still knows the event type. Rows from removed
 * domains (the old `league.*` events) stay in the database, and serializing one
 * throws against the strict enum, which would fail the whole feed.
 */
export function isKnownNotificationEventType(eventType: string): boolean {
  return NOTIFICATION_EVENT_TYPES.some((known) => known === eventType);
}
