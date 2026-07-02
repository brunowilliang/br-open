import { eq } from "kitcn/orm";
import { z } from "zod";

import {
  NotificationPermissionStatusSchema,
  notificationStatusSchema,
  SetNotificationPreferenceSchema,
  UpsertNotificationDeviceSchema,
} from "../../domains/notification/contract";
import { isNotificationForActiveActor } from "../../domains/notification/feed-rules";
import { resolvePushReadiness } from "../../domains/notification/state";
import {
  notificationDevice,
  notificationPreference,
} from "../../domains/notification/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../generated/server";
import { getViewerContext } from "../viewer/context";

function getPreference(ctx: AuthenticatedCtx<QueryCtx | MutationCtx>) {
  return ctx.orm.query.notificationPreference.findFirst({
    where: { userId: ctx.userId },
  });
}

async function getActiveActorUnreadCount(
  ctx: AuthenticatedCtx<QueryCtx | MutationCtx>
) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const unreadNotifications = await ctx.db
    .query("notificationFeed")
    .withIndex("recipientUserId_actorKind_isRead", (q) =>
      q
        .eq("recipientUserId", ctx.userId)
        .eq("recipientActorKind", viewerContext.activeActor.kind)
        .eq("isRead", false)
    )
    .collect();

  return unreadNotifications.filter((notification) =>
    isNotificationForActiveActor(notification, viewerContext.activeActor)
  ).length;
}

async function upsertPreference(
  ctx: AuthenticatedCtx<MutationCtx>,
  input: { pushEnabled: boolean; userId: Id<"user"> }
) {
  const now = new Date();
  const existingPreference =
    await ctx.orm.query.notificationPreference.findFirst({
      where: { userId: input.userId },
    });

  if (!existingPreference) {
    await ctx.orm.insert(notificationPreference).values({
      pushEnabled: input.pushEnabled,
      updatedAt: now,
      userId: input.userId,
    });
    return;
  }

  await ctx.orm
    .update(notificationPreference)
    .set({ pushEnabled: input.pushEnabled, updatedAt: now })
    .where(eq(notificationPreference.id, existingPreference.id)!)
    .execute();
}

export const status = authQuery
  .input(z.object({}))
  .output(notificationStatusSchema)
  .query(async ({ ctx }) => {
    const [preference, devices, unreadCount] = await Promise.all([
      getPreference(ctx),
      ctx.orm.query.notificationDevice.findMany({
        limit: 100,
        where: { userId: ctx.userId },
      }),
      getActiveActorUnreadCount(ctx),
    ]);
    const activeDevices = devices.filter((device) => !device.disabledAt);
    const permissionStatus = NotificationPermissionStatusSchema.parse(
      activeDevices.find((device) => device.permissionStatus === "granted")
        ?.permissionStatus ??
        activeDevices.at(0)?.permissionStatus ??
        "undetermined"
    );
    const readiness = resolvePushReadiness({
      deviceCount: activeDevices.length,
      permissionStatus,
      pushEnabled: preference?.pushEnabled ?? false,
    });

    return notificationStatusSchema.parse({
      canReceivePush: readiness.canReceivePush,
      deviceCount: activeDevices.length,
      permissionStatus,
      pushEnabled: preference?.pushEnabled ?? false,
      readinessReason: readiness.reason,
      unreadCount,
    });
  });

export const setPreference = authMutation
  .input(SetNotificationPreferenceSchema)
  .output(notificationStatusSchema)
  .mutation(async ({ ctx, input }) => {
    await upsertPreference(ctx, {
      pushEnabled: input.pushEnabled,
      userId: ctx.userId,
    });

    const [devices, unreadCount] = await Promise.all([
      ctx.orm.query.notificationDevice.findMany({
        limit: 100,
        where: { userId: ctx.userId },
      }),
      getActiveActorUnreadCount(ctx),
    ]);
    const activeDevices = devices.filter((device) => !device.disabledAt);
    const permissionStatus = NotificationPermissionStatusSchema.parse(
      activeDevices.find((device) => device.permissionStatus === "granted")
        ?.permissionStatus ??
        activeDevices.at(0)?.permissionStatus ??
        "undetermined"
    );
    const readiness = resolvePushReadiness({
      deviceCount: activeDevices.length,
      permissionStatus,
      pushEnabled: input.pushEnabled,
    });

    return notificationStatusSchema.parse({
      canReceivePush: readiness.canReceivePush,
      deviceCount: activeDevices.length,
      permissionStatus,
      pushEnabled: input.pushEnabled,
      readinessReason: readiness.reason,
      unreadCount,
    });
  });

export const upsertDevice = authMutation
  .input(UpsertNotificationDeviceSchema)
  .output(notificationStatusSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const existingDevice = await ctx.orm.query.notificationDevice.findFirst({
      where: { expoPushToken: input.expoPushToken },
    });

    if (existingDevice) {
      await ctx.orm
        .update(notificationDevice)
        .set({
          disabledAt: null,
          lastSeenAt: now,
          permissionStatus: input.permissionStatus,
          platform: input.platform,
          userId: ctx.userId,
        })
        .where(eq(notificationDevice.id, existingDevice.id)!)
        .execute();
    } else {
      await ctx.orm.insert(notificationDevice).values({
        disabledAt: null,
        expoPushToken: input.expoPushToken,
        lastSeenAt: now,
        permissionStatus: input.permissionStatus,
        platform: input.platform,
        registeredAt: now,
        userId: ctx.userId,
      });
    }

    const preference = await getPreference(ctx);
    const devices = await ctx.orm.query.notificationDevice.findMany({
      limit: 100,
      where: { userId: ctx.userId },
    });
    const activeDevices = devices.filter((device) => !device.disabledAt);
    const readiness = resolvePushReadiness({
      deviceCount: activeDevices.length,
      permissionStatus: input.permissionStatus,
      pushEnabled: preference?.pushEnabled ?? false,
    });
    const unreadCount = await getActiveActorUnreadCount(ctx);

    return notificationStatusSchema.parse({
      canReceivePush: readiness.canReceivePush,
      deviceCount: activeDevices.length,
      permissionStatus: input.permissionStatus,
      pushEnabled: preference?.pushEnabled ?? false,
      readinessReason: readiness.reason,
      unreadCount,
    });
  });
