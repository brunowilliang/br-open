/**
 * Notification recipient resolution — pure functions.
 *
 * Kept separate from the scheduler wiring so the rule can be tested in
 * isolation.
 */

/**
 * Dedupes the recipient list of a notification.
 *
 * The actor user is intentionally NOT filtered out — the same user can be
 * both the actor (e.g. the player who triggered the event) and a recipient
 * (e.g. when they are also a manager of the organization), and in those
 * cases they still need the notification.
 */
export function getNotificationRecipientUserIds<UserId extends string>(input: {
  actorUserId?: UserId | null;
  recipientUserIds: UserId[];
}): UserId[] {
  return Array.from(new Set(input.recipientUserIds));
}
