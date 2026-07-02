/**
 * Notification feed access rules — pure functions.
 *
 * Moved out of `functions/notification/feed.ts` (and desuplicated from
 * `settings.ts`, where `isNotificationForActiveActor` was copied verbatim)
 * so the rules can be tested in isolation from the CRPC procedures.
 */

type ActorKind = "organization" | "player";

type NotificationActorLike = {
  recipientActorKind?: string;
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
