import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineNotificationRelations = (
  r: RelationsBuilder<typeof tables>
) => ({
  notificationPreference: {
    user: r.one.user({
      from: r.notificationPreference.userId,
      to: r.user.id,
    }),
  },
  notificationDevice: {
    user: r.one.user({
      from: r.notificationDevice.userId,
      to: r.user.id,
    }),
    deliveries: r.many.notificationDelivery({
      from: r.notificationDevice.id,
      to: r.notificationDelivery.deviceId,
    }),
  },
  notificationFeed: {
    actor: r.one.user({
      alias: "actor",
      from: r.notificationFeed.actorUserId,
      to: r.user.id,
    }),
    deliveries: r.many.notificationDelivery({
      from: r.notificationFeed.id,
      to: r.notificationDelivery.feedId,
    }),
    recipient: r.one.user({
      from: r.notificationFeed.recipientUserId,
      to: r.user.id,
    }),
  },
  notificationDelivery: {
    device: r.one.notificationDevice({
      from: r.notificationDelivery.deviceId,
      to: r.notificationDevice.id,
    }),
    feed: r.one.notificationFeed({
      from: r.notificationDelivery.feedId,
      to: r.notificationFeed.id,
    }),
  },
});
