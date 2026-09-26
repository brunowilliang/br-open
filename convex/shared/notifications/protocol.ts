export const NOTIFICATION_EVENT_TYPES = [
  "tournament.partner.invited",
  "tournament.partner.responded",
  "tournament.partner.awaiting_reply",
  "tournament.entry.created",
  "tournament.entry.confirmed",
  "tournament.entry.rejected",
  "tournament.entry.refund_requested",
  "tournament.bracket.published",
  "tournament.bracket.placement_failed",
  "tournament.match.reassigned",
  "tournament.match.scheduled",
  "tournament.match.rescheduled",
  "tournament.match.result",
  "tournament.match.result_edited",
  "tournament.finished",
  "tournament.cancelled",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
