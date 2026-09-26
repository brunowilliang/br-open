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

export type NotificationResponseIntent = {
  kind: "open";
  notificationId?: string;
  recipientActor?: NotificationResponseActor;
  url: string | null;
};

type ResolveNotificationResponseIntentInput = {
  actionIdentifier: string;
  data: NotificationResponseData;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

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
  return getOpenIntent(input.data);
}
