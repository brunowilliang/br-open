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

type NotificationFeedResponseItem = {
  data: Record<string, unknown>;
  id: string;
  recipientActorKind: "organization" | "player";
  recipientOrganizationId?: string | null;
  recipientPlayerProfileId?: string | null;
};

type ActiveNotificationActor = {
  id: string;
  kind: "organization" | "player";
};

export type NotificationResponseActor =
  | {
      kind: "organization";
      organizationId: string;
    }
  | {
      kind: "player";
      playerProfileId?: string;
    };

export type NotificationResponseIntent =
  | {
      kind: "open";
      notificationId?: string;
      recipientActor?: NotificationResponseActor;
      url: string | null;
    }
  | {
      kind: "approveLeagueMembership";
      leagueId: string;
      membershipId: string;
      notificationId?: string;
      recipientActor?: NotificationResponseActor;
      url: string;
    }
  | {
      kind: "rejectLeagueMembership";
      leagueId: string;
      membershipId: string;
      notificationId?: string;
      recipientActor?: NotificationResponseActor;
    };

type ResolveNotificationResponseIntentInput = {
  actionIdentifier: string;
  data: NotificationResponseData;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const getLeagueRankingUrl = (leagueId: string) =>
  `/leagues/${leagueId}/ranking`;

function getRecipientActor(
  data: NotificationResponseData
): NotificationResponseActor | undefined {
  const actorKind = readString(data.recipientActorKind);

  if (actorKind === "player") {
    const playerProfileId = readString(data.recipientPlayerProfileId);

    return {
      kind: "player",
      ...(playerProfileId ? { playerProfileId } : {}),
    };
  }

  if (actorKind === "organization") {
    const organizationId = readString(data.recipientOrganizationId);

    if (organizationId) {
      return { kind: "organization", organizationId };
    }
  }

  return;
}

function getRecipientActorPayload(data: NotificationResponseData) {
  const recipientActor = getRecipientActor(data);

  return recipientActor ? { recipientActor } : {};
}

export function buildNotificationResponseDataFromFeedItem(
  notification: NotificationFeedResponseItem
): NotificationResponseData {
  return {
    ...notification.data,
    notificationId: notification.id,
    recipientActorKind: notification.recipientActorKind,
    ...(notification.recipientOrganizationId
      ? { recipientOrganizationId: notification.recipientOrganizationId }
      : {}),
    ...(notification.recipientPlayerProfileId
      ? { recipientPlayerProfileId: notification.recipientPlayerProfileId }
      : {}),
  };
}

export function isNotificationRecipientActorActive(input: {
  activeActor?: ActiveNotificationActor | null;
  recipientActor?: NotificationResponseActor;
}) {
  if (!input.recipientActor) {
    return true;
  }

  if (
    !input.activeActor ||
    input.activeActor.kind !== input.recipientActor.kind
  ) {
    return false;
  }

  if (input.recipientActor.kind === "organization") {
    return input.activeActor.id === input.recipientActor.organizationId;
  }

  return input.recipientActor.playerProfileId
    ? input.activeActor.id === input.recipientActor.playerProfileId
    : true;
}

function getOpenIntent(
  data: NotificationResponseData
): NotificationResponseIntent {
  return {
    kind: "open",
    ...(readString(data.notificationId)
      ? { notificationId: readString(data.notificationId) ?? undefined }
      : {}),
    ...getRecipientActorPayload(data),
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
        ...getRecipientActorPayload(input.data),
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
        ...getRecipientActorPayload(input.data),
      };
    }
  }

  return getOpenIntent(input.data);
}
