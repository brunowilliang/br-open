/**
 * Notification recipient resolution — pure functions.
 *
 * Moved out of `functions/notification/events.ts` so the rule can be tested
 * in isolation from the scheduler wiring.
 */

/**
 * Dedupes the recipient list for a league notification.
 *
 * The actor user is intentionally NOT filtered out — the same user can be
 * both the actor (e.g. the player who requested to join) and a recipient
 * (e.g. when they are also a manager of the organization), and in those
 * cases they still need the notification.
 */
export function getLeagueNotificationRecipientUserIds<
  UserId extends string,
>(input: {
  actorUserId?: UserId | null;
  recipientUserIds: UserId[];
}): UserId[] {
  return Array.from(new Set(input.recipientUserIds));
}
