import {
  NOTIFICATION_ACTION_IDS,
  NOTIFICATION_PUSH_CATEGORY_IDS,
  type NotificationActionId,
} from "@convex/shared/notifications/protocol";

export const NOTIFICATION_CATEGORY_IDENTIFIERS = NOTIFICATION_PUSH_CATEGORY_IDS;
export const NOTIFICATION_ACTION_IDENTIFIERS = NOTIFICATION_ACTION_IDS;

type NotificationActionDefinition = {
  buttonTitle: string;
  identifier: NotificationActionId;
  options?: {
    isDestructive?: boolean;
    opensAppToForeground?: boolean;
  };
};

export const LEAGUE_MEMBERSHIP_REQUEST_NOTIFICATION_ACTIONS = [
  {
    buttonTitle: "Aprovar",
    identifier: NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestApprove,
    options: { opensAppToForeground: true },
  },
  {
    buttonTitle: "Recusar",
    identifier: NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestReject,
    options: {
      isDestructive: true,
      opensAppToForeground: true,
    },
  },
] as const satisfies readonly NotificationActionDefinition[];

type NotificationResponseData = Record<string, unknown>;

export type NotificationResponseIntent =
  | {
      kind: "open";
      notificationId?: string;
      url: string | null;
    }
  | {
      kind: "approveLeagueMembership";
      leagueId: string;
      membershipId: string;
      notificationId?: string;
      url: string;
    }
  | {
      kind: "rejectLeagueMembership";
      leagueId: string;
      membershipId: string;
      notificationId?: string;
    };

type ResolveNotificationResponseIntentInput = {
  actionIdentifier: string;
  data: NotificationResponseData;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const getLeagueRankingUrl = (leagueId: string) =>
  `/leagues/${leagueId}?tab=ranking`;

function getOpenIntent(
  data: NotificationResponseData
): NotificationResponseIntent {
  return {
    kind: "open",
    ...(readString(data.notificationId)
      ? { notificationId: readString(data.notificationId) ?? undefined }
      : {}),
    url: readString(data.url),
  };
}

export function resolveNotificationResponseIntent(
  input: ResolveNotificationResponseIntentInput
): NotificationResponseIntent {
  const eventType = readString(input.data.eventType);
  const leagueId = readString(input.data.leagueId);
  const membershipId = readString(input.data.membershipId);
  const notificationId = readString(input.data.notificationId);

  if (eventType === "league.membership.requested" && leagueId && membershipId) {
    if (
      input.actionIdentifier ===
      NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestApprove
    ) {
      return {
        kind: "approveLeagueMembership",
        leagueId,
        membershipId,
        ...(notificationId ? { notificationId } : {}),
        url: getLeagueRankingUrl(leagueId),
      };
    }

    if (
      input.actionIdentifier ===
      NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestReject
    ) {
      return {
        kind: "rejectLeagueMembership",
        leagueId,
        membershipId,
        ...(notificationId ? { notificationId } : {}),
      };
    }
  }

  return getOpenIntent(input.data);
}
