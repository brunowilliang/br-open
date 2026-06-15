import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../generated/server";
import type { NotificationEventType } from "../../shared/notifications/protocol";

type ScheduleLeagueNotificationInput = {
  actorUserId?: Id<"user"> | null;
  eventType: NotificationEventType;
  leagueId: Id<"league">;
  metadata?: Record<string, unknown>;
  recipientUserIds: Id<"user">[];
};

export function getLeagueNotificationRecipientUserIds<
  UserId extends string,
>(input: { actorUserId?: UserId | null; recipientUserIds: UserId[] }) {
  return Array.from(new Set(input.recipientUserIds));
}

export async function scheduleLeagueNotification(
  ctx: MutationCtx,
  input: ScheduleLeagueNotificationInput
) {
  const recipientUserIds = getLeagueNotificationRecipientUserIds(input);

  if (recipientUserIds.length === 0) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.notification.orchestrator.createForRecipients,
    {
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      leagueId: input.leagueId,
      metadata: input.metadata ?? {},
      recipientUserIds,
    }
  );
}
