export const NOTIFICATION_EVENT_TYPES = [
  "league.membership.requested",
  "league.membership.approved",
  "league.membership.payment_confirmed",
  "league.membership.payment_due",
  "league.membership.payment_expired",
  "league.membership.payment_refunded",
  "league.membership.rejected",
  "league.membership.renewal_due",
  "league.membership.renewal_reminder",
  "league.membership.removed",
  "league.challenge.created",
  "league.challenge.counter_proposed",
  "league.challenge.proposal_accepted",
  "league.challenge.proposal_declined",
  "league.challenge.cancelled",
  "league.challenge.cancellation_requested",
  "league.challenge.cancellation_accepted",
  "league.challenge.cancellation_rejected",
  "league.challenge.result_submitted",
  "league.challenge.result_confirmed",
  "league.challenge.result_edited",
  "league.challenge.result_correction_requested",
  "league.challenge.result_invalidated",
  "league.challenge.result_reminder_requested",
  "league.challenge.walkover_submitted",
  "league.challenge.walkover_confirmed",
  "league.challenge.organizer_approved",
  "league.challenge.organizer_rejected",
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

export const NOTIFICATION_PUSH_CATEGORY_IDS = {
  leagueMembershipRequest: "league_membership_request",
} as const;
export type NotificationPushCategoryId =
  (typeof NOTIFICATION_PUSH_CATEGORY_IDS)[keyof typeof NOTIFICATION_PUSH_CATEGORY_IDS];

export const NOTIFICATION_ACTION_IDS: Record<string, string> = {
  leagueMembershipRequestApprove: "league_membership_request_approve",
  leagueMembershipRequestReject: "league_membership_request_reject",
};

export type NotificationActionId =
  (typeof NOTIFICATION_ACTION_IDS)[keyof typeof NOTIFICATION_ACTION_IDS];

export const NOTIFICATION_EVENT_CATEGORY_IDS: Partial<
  Record<NotificationEventType, NotificationPushCategoryId>
> = {
  "league.membership.requested":
    NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest,
};

export const NOTIFICATION_CATEGORY_ACTION_IDS: Record<
  NotificationPushCategoryId,
  readonly NotificationActionId[]
> = {
  [NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest]: [
    NOTIFICATION_ACTION_IDS.leagueMembershipRequestApprove,
    NOTIFICATION_ACTION_IDS.leagueMembershipRequestReject,
  ],
};
