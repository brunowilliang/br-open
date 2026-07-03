import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { privateAction, privateMutation } from "../../lib/crpc";
import { getEnv } from "../../lib/get-env";
import { z } from "zod";
import type { MutationCtx } from "../generated/server";

import {
  NotificationDeliveryStateSchema,
  NotificationEventTypeSchema,
} from "../../domains/notification/contract";
import { eq } from "kitcn/orm";
import {
  buildNotificationContent,
  getNotificationPushCategoryId,
} from "../../domains/notification/definitions";
import {
  notificationDelivery,
  notificationFeed,
} from "../../domains/notification/tables";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const MAX_DELIVERIES_PER_BATCH = 100;
const MAX_RETRY_ATTEMPTS = 5;
const SEND_PENDING_LOCK_KEY = "sendPending";
// Long enough that a crashed runner releases the pipeline without manual
// intervention, short enough that a normal batch (claim -> fetch -> mark) of
// 100 deliveries always completes well within the window.
const SEND_PENDING_LOCK_TTL_MS = 60_000;

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
  sourceEntityId: z.string().min(1).optional(),
  sourceEntityType: z.string().min(1).optional(),
});

type RecipientActor =
  | {
      kind: "organization";
      organizationId: Id<"organization">;
      playerProfileId: null;
      userId: Id<"user">;
    }
  | {
      kind: "player";
      organizationId: null;
      playerProfileId: Id<"playerProfile">;
      userId: Id<"user">;
    };

type LeagueNotificationRecord = {
  id: string;
  name: string;
  organizationId: Id<"organization">;
};

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

async function resolveRecipientActor(input: {
  ctx: MutationCtx;
  eventType: z.infer<typeof NotificationEventTypeSchema>;
  league: LeagueNotificationRecord;
  recipientUserId: Id<"user">;
}): Promise<RecipientActor | null> {
  if (input.eventType === "league.membership.requested") {
    return {
      kind: "organization",
      organizationId: input.league.organizationId as Id<"organization">,
      playerProfileId: null,
      userId: input.recipientUserId,
    };
  }

  const playerProfile = await input.ctx.orm.query.playerProfile.findFirst({
    where: { userId: input.recipientUserId },
  });

  if (!playerProfile) {
    return null;
  }

  return {
    kind: "player",
    organizationId: null,
    playerProfileId: playerProfile.id as Id<"playerProfile">,
    userId: input.recipientUserId,
  };
}

/**
 * Acquires the `sendPending` lock and schedules a runner, but only when there
 * is pending work AND no other runner currently holds an unexpired lock. The
 * lock prevents `createForRecipients` (one kickoff per recipient batch) and
 * the self-chaining `markDeliveryResults -> scheduleNextBatch` from each
 * enqueueing redundant `sendPending` runs.
 */
async function scheduleNextBatch(ctx: MutationCtx, delayMs = 0) {
  const pendingDelivery = await ctx.db
    .query("notificationDelivery")
    .withIndex("state", (q) => q.eq("state", "awaiting_delivery"))
    .first();
  const retryDelivery = await ctx.db
    .query("notificationDelivery")
    .withIndex("state", (q) => q.eq("state", "needs_retry"))
    .first();
  const maybeDelivery = await ctx.db
    .query("notificationDelivery")
    .withIndex("state", (q) => q.eq("state", "maybe_delivered"))
    .first();

  if (!(pendingDelivery || retryDelivery || maybeDelivery)) {
    return;
  }

  const now = Date.now();
  const existingLock = await ctx.db
    .query("notificationDeliveryLock")
    .withIndex("key", (q) => q.eq("key", SEND_PENDING_LOCK_KEY))
    .first();

  if (existingLock && existingLock.expiresAt > now) {
    // Another runner owns the pipeline; it will self-chain via
    // markDeliveryResults when it finishes.
    return;
  }

  const expiresAt = now + SEND_PENDING_LOCK_TTL_MS;
  if (existingLock) {
    await ctx.db.patch(existingLock._id, { claimedAt: now, expiresAt });
  } else {
    await ctx.db.insert("notificationDeliveryLock", {
      key: SEND_PENDING_LOCK_KEY,
      claimedAt: now,
      expiresAt,
    });
  }

  await ctx.scheduler.runAfter(
    delayMs,
    internal.notification.orchestrator.sendPending,
    {}
  );
}

/**
 * Releases the `sendPending` lock so the next `scheduleNextBatch` can acquire
 * it immediately instead of waiting for the TTL. Called by the runner when it
 * has drained its batch (success or empty).
 */
async function releaseSendPendingLock(ctx: MutationCtx) {
  const existingLock = await ctx.db
    .query("notificationDeliveryLock")
    .withIndex("key", (q) => q.eq("key", SEND_PENDING_LOCK_KEY))
    .first();
  if (existingLock) {
    await ctx.db.delete(existingLock._id);
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
      const recipientActor = await resolveRecipientActor({
        ctx,
        eventType: input.eventType,
        league,
        recipientUserId: recipientUserId as Id<"user">,
      });

      if (!recipientActor) {
        continue;
      }

      const content = buildNotificationContent({
        actorName,
        eventType: input.eventType,
        leagueId: league.id,
        leagueName: league.name,
        metadata: input.metadata,
        recipientRole:
          recipientActor.kind === "organization" ? "manager" : "player",
      });

      const feedId = await ctx.db.insert("notificationFeed", {
        actorUserId: actorUserId ?? undefined,
        body: content.body,
        data: content.data,
        eventType: input.eventType,
        isRead: false,
        occurredAt: now,
        recipientActorKind: recipientActor.kind,
        recipientOrganizationId: recipientActor.organizationId ?? undefined,
        recipientPlayerProfileId: recipientActor.playerProfileId ?? undefined,
        recipientUserId: recipientActor.userId,
        sourceEntityId: input.sourceEntityId,
        sourceEntityType: input.sourceEntityType,
        status: "active",
        title: content.title,
      });
      const preference = await ctx.orm.query.notificationPreference.findFirst({
        where: { userId: recipientActor.userId },
      });

      if (!preference?.pushEnabled) {
        continue;
      }

      const devices = await ctx.orm.query.notificationDevice.findMany({
        limit: 100,
        where: { userId: recipientActor.userId },
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
    const remainingAfterAwaiting = remainingLimit - awaitingDeliveries.length;
    const maybeDeliveries =
      remainingAfterAwaiting > 0
        ? await ctx.db
            .query("notificationDelivery")
            .withIndex("state", (q) => q.eq("state", "maybe_delivered"))
            .take(remainingAfterAwaiting)
        : [];
    const deliveries = [
      ...retryDeliveries,
      ...awaitingDeliveries,
      ...maybeDeliveries,
    ];
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
            recipientActorKind: feed.recipientActorKind,
            recipientOrganizationId: feed.recipientOrganizationId,
            recipientPlayerProfileId: feed.recipientPlayerProfileId,
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

    // Release this runner's lock before re-scheduling, so a legitimate
    // follow-up batch can acquire it immediately.
    await releaseSendPendingLock(ctx);
    await scheduleNextBatch(ctx, 1000);
    return null;
  });

export const releaseLock = privateMutation
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    await releaseSendPendingLock(ctx);
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
      // Nothing to send: release the lock so the next schedule isn't blocked.
      await ctx.runMutation(internal.notification.orchestrator.releaseLock, {});
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

const retractNotificationsSchema = z.object({
  exceptEventTypes: z.array(z.string()).optional(),
  sourceEntityId: z.string().min(1),
  sourceEntityType: z.string().min(1),
});

/**
 * Retracts feed rows tied to a source entity (e.g. a challenge that was
 * cancelled/rescheduled). Sets their `status` to "retracted" and aborts any
 * pending deliveries by flipping them to "failed".
 *
 * Typical caller: `challenges.ts` cancel/counterPropose/admin branches,
 * invoked via `internal.notification.orchestrator.retractNotifications`
 * BEFORE emitting the new superseding event.
 */
export const retractNotifications = privateMutation
  .input(retractNotificationsSchema)
  .output(z.object({ retractedCount: z.number().int().nonnegative() }))
  .mutation(async ({ ctx, input }) => {
    // Query by sourceEntityType (more selective than sourceEntityId), then
    // filter in JS by sourceEntityId. kitcn's findMany where-clause is an
    // object literal of column -> value; compound and()/eq() is only wired
    // for update/delete in this ORM. With the sourceEntity index on
    // (sourceEntityType, sourceEntityId), the JS filter is cheap.
    const candidateRows = await ctx.orm.query.notificationFeed.findMany({
      limit: 500,
      where: { sourceEntityType: input.sourceEntityType },
    });
    const feedRows = candidateRows.filter(
      (row) => row.sourceEntityId === input.sourceEntityId
    );

    const targetRows = input.exceptEventTypes
      ? feedRows.filter(
          (row) => !input.exceptEventTypes?.includes(row.eventType)
        )
      : feedRows;

    if (targetRows.length === 0) {
      return { retractedCount: 0 };
    }

    const now = new Date();
    const feedIds = targetRows.map((row) => row.id as Id<"notificationFeed">);

    for (const row of targetRows) {
      await ctx.orm
        .update(notificationFeed)
        .set({
          retractedAt: now,
          status: "retracted",
        })
        .where(eq(notificationFeed.id, row.id));
    }

    // Abort pending deliveries tied to the retracted feed rows.
    const deliveries = await ctx.orm.query.notificationDelivery.findMany({
      where: { feedId: { in: feedIds } },
    });
    const reclamationStates = new Set([
      "awaiting_delivery",
      "in_progress",
      "maybe_delivered",
      "needs_retry",
    ]);
    for (const delivery of deliveries) {
      if (reclamationStates.has(delivery.state)) {
        await ctx.orm
          .update(notificationDelivery)
          .set({
            errorMessage: "retracted",
            state: "failed",
          })
          .where(eq(notificationDelivery.id, delivery.id));
      }
    }

    return { retractedCount: targetRows.length };
  });

const STALE_IN_PROGRESS_THRESHOLD_MS = 90_000; // 90s

/**
 * Recovers `in_progress` deliveries left orphaned by a crashed runner.
 *
 * `claimPendingDeliveries` only re-claims `needs_retry`, `awaiting_delivery`,
 * and `maybe_delivered` — never `in_progress`. If a runner dies after claiming
 * but before `markDeliveryResults`, those deliveries stay `in_progress`
 * forever. This sweeper (cron @ 1min) finds them by `lastAttemptAt` age and
 * resets them to `needs_retry` so the pipeline picks them up again.
 *
 * Gated by `DEPLOY_ENV === "production"` so dev/preview crons no-op.
 */
export const sweepStaleInProgressDeliveries = privateMutation.mutation(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { recoveredCount: 0 };
    }
    const now = Date.now();
    const cutoff = now - STALE_IN_PROGRESS_THRESHOLD_MS;
    const inProgress = await ctx.db
      .query("notificationDelivery")
      .withIndex("state", (q) => q.eq("state", "in_progress"))
      .take(100);
    const stale = inProgress.filter((delivery) => {
      const lastAttempt = delivery.lastAttemptAt ?? 0;
      return lastAttempt < cutoff;
    });
    for (const delivery of stale) {
      await ctx.db.patch(delivery._id, {
        errorMessage: "stale in_progress recovered",
        state: "needs_retry",
      });
    }
    return { recoveredCount: stale.length };
  }
);
