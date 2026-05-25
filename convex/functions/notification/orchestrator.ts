import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { privateAction, privateMutation } from "../../lib/crpc";
import { z } from "zod";
import type { MutationCtx } from "../generated/server";

import {
  NotificationDeliveryStateSchema,
  NotificationEventTypeSchema,
} from "../../domains/notification/contract";
import {
  buildNotificationContent,
  getNotificationPushCategoryId,
} from "../../domains/notification/definitions";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const MAX_DELIVERIES_PER_BATCH = 100;
const MAX_RETRY_ATTEMPTS = 5;

type ClaimedDelivery = {
  deliveryId: Id<"notificationDelivery">;
  message: {
    body: string;
    channelId: string;
    categoryId?: string;
    data: Record<string, unknown>;
    sound: "default";
    title: string;
    to: string;
  };
};

const createForRecipientsSchema = z.object({
  actorUserId: z.string().nullable(),
  eventType: NotificationEventTypeSchema,
  leagueId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  recipientUserIds: z.array(z.string().min(1)).min(1),
});

const deliveryResultSchema = z.object({
  deliveryId: z.string().min(1),
  errorMessage: z.string().optional(),
  responseId: z.string().optional(),
  state: NotificationDeliveryStateSchema,
});

async function getActorName(ctx: MutationCtx, actorUserId: Id<"user"> | null) {
  if (!actorUserId) {
    return null;
  }

  const [user, playerProfile] = await Promise.all([
    ctx.orm.query.user.findFirst({ where: { id: actorUserId } }),
    ctx.orm.query.playerProfile.findFirst({ where: { userId: actorUserId } }),
  ]);

  return (
    playerProfile?.nickname?.trim() || playerProfile?.fullName || user?.name
  );
}

async function scheduleNextBatch(ctx: MutationCtx, delayMs = 0) {
  const pendingDelivery = await ctx.db
    .query("notificationDelivery")
    .withIndex("state", (q) => q.eq("state", "awaiting_delivery"))
    .first();
  const retryDelivery = await ctx.db
    .query("notificationDelivery")
    .withIndex("state", (q) => q.eq("state", "needs_retry"))
    .first();

  if (pendingDelivery || retryDelivery) {
    await ctx.scheduler.runAfter(
      delayMs,
      internal.notification.orchestrator.sendPending,
      {}
    );
  }
}

export const createForRecipients = privateMutation
  .input(createForRecipientsSchema)
  .mutation(async ({ ctx, input }) => {
    const league = await ctx.orm.query.league.findFirst({
      where: { id: input.leagueId as Id<"league"> },
    });

    if (!league) {
      return null;
    }

    const actorUserId = input.actorUserId as Id<"user"> | null;
    const actorName = await getActorName(ctx, actorUserId);
    const now = Date.now();
    let hasDeliveries = false;

    for (const recipientUserId of new Set(input.recipientUserIds)) {
      if (recipientUserId === input.actorUserId) {
        continue;
      }

      const content = buildNotificationContent({
        actorName,
        eventType: input.eventType,
        leagueId: league.id,
        leagueName: league.name,
        metadata: input.metadata,
        recipientRole:
          recipientUserId === league.managerUserId ? "manager" : "player",
      });

      const feedId = await ctx.db.insert("notificationFeed", {
        actorUserId: actorUserId ?? undefined,
        body: content.body,
        data: content.data,
        eventType: input.eventType,
        isRead: false,
        occurredAt: now,
        recipientUserId: recipientUserId as Id<"user">,
        title: content.title,
      });
      const preference = await ctx.orm.query.notificationPreference.findFirst({
        where: { userId: recipientUserId as Id<"user"> },
      });

      if (!preference?.pushEnabled) {
        continue;
      }

      const devices = await ctx.orm.query.notificationDevice.findMany({
        limit: 100,
        where: { userId: recipientUserId as Id<"user"> },
      });
      const activeDevices = devices.filter(
        (device) => !device.disabledAt && device.permissionStatus === "granted"
      );

      for (const device of activeDevices) {
        await ctx.db.insert("notificationDelivery", {
          attempts: 0,
          deviceId: device.id as Id<"notificationDevice">,
          expoPushToken: device.expoPushToken,
          feedId,
          state: "awaiting_delivery",
        });
        hasDeliveries = true;
      }
    }

    if (hasDeliveries) {
      await ctx.scheduler.runAfter(
        0,
        internal.notification.orchestrator.sendPending,
        {}
      );
    }

    return null;
  });

export const claimPendingDeliveries = privateMutation
  .input(z.object({ limit: z.number().int().min(1).max(100).optional() }))
  .output(
    z.array(
      z.object({
        deliveryId: z.string(),
        message: z.object({
          body: z.string(),
          channelId: z.string(),
          categoryId: z.string().optional(),
          data: z.record(z.string(), z.unknown()),
          sound: z.literal("default"),
          title: z.string(),
          to: z.string(),
        }),
      })
    )
  )
  .mutation(async ({ ctx, input }) => {
    const retryDeliveries = await ctx.db
      .query("notificationDelivery")
      .withIndex("state", (q) => q.eq("state", "needs_retry"))
      .take(input.limit ?? MAX_DELIVERIES_PER_BATCH);
    const remainingLimit =
      (input.limit ?? MAX_DELIVERIES_PER_BATCH) - retryDeliveries.length;
    const awaitingDeliveries =
      remainingLimit > 0
        ? await ctx.db
            .query("notificationDelivery")
            .withIndex("state", (q) => q.eq("state", "awaiting_delivery"))
            .take(remainingLimit)
        : [];
    const deliveries = [...retryDeliveries, ...awaitingDeliveries];
    const claimed: ClaimedDelivery[] = [];
    const now = Date.now();

    for (const delivery of deliveries) {
      if (delivery.attempts >= MAX_RETRY_ATTEMPTS) {
        await ctx.db.patch(delivery._id, { state: "unable_to_deliver" });
        continue;
      }

      const feed = await ctx.db.get(delivery.feedId);
      if (!feed) {
        await ctx.db.patch(delivery._id, {
          errorMessage: "Notification feed item not found.",
          state: "failed",
        });
        continue;
      }

      await ctx.db.patch(delivery._id, {
        attempts: delivery.attempts + 1,
        lastAttemptAt: now,
        state: "in_progress",
      });

      const categoryId = getNotificationPushCategoryId(feed.eventType);

      claimed.push({
        deliveryId: delivery._id,
        message: {
          body: feed.body,
          channelId: "default",
          ...(categoryId ? { categoryId } : {}),
          data: {
            ...(feed.data as Record<string, unknown>),
            notificationId: feed._id,
          },
          sound: "default" as const,
          title: feed.title,
          to: delivery.expoPushToken,
        },
      });
    }

    return claimed;
  });

export const markDeliveryResults = privateMutation
  .input(z.object({ results: z.array(deliveryResultSchema) }))
  .mutation(async ({ ctx, input }) => {
    const now = Date.now();

    for (const result of input.results) {
      const deliveryId = result.deliveryId as Id<"notificationDelivery">;
      const delivery = await ctx.db.get(deliveryId);

      if (!delivery) {
        continue;
      }

      if (result.state === "delivered") {
        await ctx.db.patch(deliveryId, {
          deliveredAt: now,
          errorMessage: undefined,
          responseId: result.responseId,
          state: "delivered",
        });
        continue;
      }

      let nextState: "maybe_delivered" | "needs_retry" | "unable_to_deliver";

      if (delivery.attempts >= MAX_RETRY_ATTEMPTS) {
        nextState = "unable_to_deliver";
      } else if (result.state === "maybe_delivered") {
        nextState = "maybe_delivered";
      } else {
        nextState = "needs_retry";
      }

      await ctx.db.patch(deliveryId, {
        errorMessage: result.errorMessage,
        responseId: result.responseId,
        state: nextState,
      });
    }

    await scheduleNextBatch(ctx, 1000);
    return null;
  });

export const sendPending = privateAction
  .input(z.object({}))
  .action(async ({ ctx }) => {
    const deliveries = await ctx.runMutation(
      internal.notification.orchestrator.claimPendingDeliveries,
      { limit: MAX_DELIVERIES_PER_BATCH }
    );

    if (deliveries.length === 0) {
      return null;
    }

    let response: Response;

    try {
      response = await fetch(EXPO_PUSH_SEND_URL, {
        body: JSON.stringify(deliveries.map((delivery) => delivery.message)),
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      await ctx.runMutation(
        internal.notification.orchestrator.markDeliveryResults,
        {
          results: deliveries.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Network request failed.",
            state: "failed" as const,
          })),
        }
      );
      return null;
    }

    if (!response.ok) {
      await ctx.runMutation(
        internal.notification.orchestrator.markDeliveryResults,
        {
          results: deliveries.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            errorMessage: `Expo push request failed with ${response.status}.`,
            state: "maybe_delivered" as const,
          })),
        }
      );
      return null;
    }

    const responseBody = (await response.json()) as {
      data?: Array<
        | { id: string; status: "ok" }
        | { details?: { error?: string }; message?: string; status: "error" }
      >;
    };

    await ctx.runMutation(
      internal.notification.orchestrator.markDeliveryResults,
      {
        results: deliveries.map((delivery, index) => {
          const result = responseBody.data?.[index];

          if (result?.status === "ok") {
            return {
              deliveryId: delivery.deliveryId,
              responseId: result.id,
              state: "delivered" as const,
            };
          }

          return {
            deliveryId: delivery.deliveryId,
            errorMessage: result?.message ?? result?.details?.error,
            state: "failed" as const,
          };
        }),
      }
    );

    return null;
  });
