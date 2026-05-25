export const NOTIFICATION_EVENT_TYPES = [
  "league.membership.requested",
  "league.membership.approved",
  "league.membership.rejected",
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
  "league.challenge.result_correction_requested",
  "league.challenge.result_invalidated",
  "league.challenge.admin_approved",
  "league.challenge.admin_rejected",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_PUSH_CATEGORY_IDS = {
  leagueMembershipRequest: "league_membership_request",
} as const;

export type NotificationPushCategoryId =
  (typeof NOTIFICATION_PUSH_CATEGORY_IDS)[keyof typeof NOTIFICATION_PUSH_CATEGORY_IDS];

export const NOTIFICATION_ACTION_IDS = {
  leagueMembershipRequestApprove: "league_membership_request_approve",
  leagueMembershipRequestReject: "league_membership_request_reject",
} as const;

export type NotificationActionId =
  (typeof NOTIFICATION_ACTION_IDS)[keyof typeof NOTIFICATION_ACTION_IDS];

export const NOTIFICATION_EVENT_CATEGORY_IDS = {
  "league.membership.requested":
    NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest,
} as const satisfies Partial<
  Record<NotificationEventType, NotificationPushCategoryId>
>;

export const NOTIFICATION_CATEGORY_ACTION_IDS = {
  [NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest]: [
    NOTIFICATION_ACTION_IDS.leagueMembershipRequestApprove,
    NOTIFICATION_ACTION_IDS.leagueMembershipRequestReject,
  ],
} as const satisfies Record<
  NotificationPushCategoryId,
  readonly NotificationActionId[]
>;
