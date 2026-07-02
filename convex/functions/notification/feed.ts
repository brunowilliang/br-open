import { CRPCError } from "kitcn/server";
import { z } from "zod";

import {
  ListNotificationsSchema,
  MarkNotificationReadSchema,
  notificationFeedItemSchema,
  RemoveNotificationSchema,
} from "../../domains/notification/contract";
import { isNotificationForActiveActor } from "../../domains/notification/feed-rules";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../generated/server";
import { getViewerContext } from "../viewer/context";

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
  recipientActorKind: string;
  recipientOrganizationId?: Id<"organization"> | null;
  recipientPlayerProfileId?: Id<"playerProfile"> | null;
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
    recipientActorKind: record.recipientActorKind,
    recipientOrganizationId: record.recipientOrganizationId ?? null,
    recipientPlayerProfileId: record.recipientPlayerProfileId ?? null,
    recipientUserId: record.recipientUserId,
    title: record.title,
  });
}

async function getActiveActorNotificationOrThrow(
  ctx: AuthenticatedCtx<MutationCtx>,
  notificationId: Id<"notificationFeed">
) {
  const [notification, viewerContext] = await Promise.all([
    ctx.db.get(notificationId),
    getViewerContext(ctx, ctx.userId),
  ]);

  if (
    !notification ||
    notification.recipientUserId !== ctx.userId ||
    !isNotificationForActiveActor(notification, viewerContext.activeActor)
  ) {
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
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const notifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_actorKind_occurredAt", (q) =>
        q
          .eq("recipientUserId", ctx.userId)
          .eq("recipientActorKind", viewerContext.activeActor.kind)
      )
      .order("desc")
      .take(100);

    return notifications
      .filter((notification) =>
        isNotificationForActiveActor(notification, viewerContext.activeActor)
      )
      .slice(0, input.limit ?? DEFAULT_FEED_LIMIT)
      .map(serializeNotificationFeedItem);
  });

export const markRead = authMutation
  .input(MarkNotificationReadSchema)
  .output(notificationFeedItemSchema)
  .mutation(async ({ ctx, input }) => {
    const notificationId = input.notificationId as Id<"notificationFeed">;
    const notification = await getActiveActorNotificationOrThrow(
      ctx,
      notificationId
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
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const unreadNotifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_actorKind_isRead", (q) =>
        q
          .eq("recipientUserId", ctx.userId)
          .eq("recipientActorKind", viewerContext.activeActor.kind)
          .eq("isRead", false)
      )
      .take(500);
    const readAt = Date.now();

    for (const notification of unreadNotifications) {
      if (
        !isNotificationForActiveActor(notification, viewerContext.activeActor)
      ) {
        continue;
      }

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
    await getActiveActorNotificationOrThrow(ctx, notificationId);

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
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const notifications = await ctx.db
      .query("notificationFeed")
      .withIndex("recipientUserId_actorKind_occurredAt", (q) =>
        q
          .eq("recipientUserId", ctx.userId)
          .eq("recipientActorKind", viewerContext.activeActor.kind)
      )
      .take(500);

    for (const notification of notifications) {
      if (
        !isNotificationForActiveActor(notification, viewerContext.activeActor)
      ) {
        continue;
      }

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
