import { CRPCError } from "kitcn/server";
import { z } from "zod";

import {
  ListNotificationsSchema,
  MarkNotificationReadSchema,
  notificationFeedItemSchema,
  RemoveNotificationSchema,
} from "../../domains/notification/contract";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../generated/server";

const DEFAULT_FEED_LIMIT = 50;

function serializeNotificationFeedItem(record: {
  _id: Id<"notificationFeed">;
  actorUserId?: Id<"user"> | null;
  body: string;
  data: Record<string, unknown> | unknown;
  eventType: string;
  isRead: boolean;
  occurredAt: number;
  readAt?: number | null;
  recipientUserId: Id<"user">;
  title: string;
}) {
  return notificationFeedItemSchema.parse({
    actorUserId: record.actorUserId ?? null,
    body: record.body,
    data: record.data,
    eventType: record.eventType,
    id: record._id,
    isRead: record.isRead,
    occurredAt: record.occurredAt,
    readAt: record.readAt ?? null,
    recipientUserId: record.recipientUserId,
    title: record.title,
  });
}

async function getOwnedNotificationOrThrow(
  ctx: AuthenticatedCtx<MutationCtx>,
  notificationId: Id<"notificationFeed">,
  userId: Id<"user">
) {
  const notification = await ctx.db.get(notificationId);

  if (!notification || notification.recipientUserId !== userId) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Notificacao nao encontrada.",
    });
  }

  return notification;
}

export const list = authQuery
  .input(ListNotificationsSchema)
  .output(z.array(notificationFeedItemSchema))
  .query(async ({ ctx, input }) => {
    const notifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_occurredAt", (q) =>
        q.eq("recipientUserId", ctx.userId)
      )
      .order("desc")
      .take(input.limit ?? DEFAULT_FEED_LIMIT);

    return notifications.map(serializeNotificationFeedItem);
  });

export const markRead = authMutation
  .input(MarkNotificationReadSchema)
  .output(notificationFeedItemSchema)
  .mutation(async ({ ctx, input }) => {
    const notificationId = input.notificationId as Id<"notificationFeed">;
    const notification = await getOwnedNotificationOrThrow(
      ctx,
      notificationId,
      ctx.userId
    );

    const readAt = notification.readAt ?? Date.now();

    if (!notification.isRead) {
      await ctx.db.patch(notificationId, {
        isRead: true,
        readAt,
      });
    }

    return serializeNotificationFeedItem({
      ...notification,
      isRead: true,
      readAt,
    });
  });

export const markAllRead = authMutation
  .input(z.object({}))
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx }) => {
    const unreadNotifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_isRead", (q) =>
        q.eq("recipientUserId", ctx.userId).eq("isRead", false)
      )
      .take(500);
    const readAt = Date.now();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt,
      });
    }

    return { success: true };
  });

export const remove = authMutation
  .input(RemoveNotificationSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const notificationId = input.notificationId as Id<"notificationFeed">;
    await getOwnedNotificationOrThrow(ctx, notificationId, ctx.userId);

    const deliveries = await ctx.db
      .query("notificationDelivery")
      .withIndex("feedId", (q) => q.eq("feedId", notificationId))
      .collect();

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }

    await ctx.db.delete(notificationId);

    return { success: true };
  });

export const removeAll = authMutation
  .input(z.object({}))
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx }) => {
    const notifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_occurredAt", (q) =>
        q.eq("recipientUserId", ctx.userId)
      )
      .take(500);

    for (const notification of notifications) {
      const deliveries = await ctx.db
        .query("notificationDelivery")
        .withIndex("feedId", (q) => q.eq("feedId", notification._id))
        .collect();

      for (const delivery of deliveries) {
        await ctx.db.delete(delivery._id);
      }

      await ctx.db.delete(notification._id);
    }

    return { success: true };
  });
