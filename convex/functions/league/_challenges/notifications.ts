import type { Id } from "../../../functions/_generated/dataModel";
import type { NotificationEventType } from "../../../shared/notifications/protocol";
import { scheduleLeagueNotification } from "../../notification/events";
import { internal } from "../../_generated/api";
import { getMembershipRecordByIdOrThrow } from "./record_guards";
import type { LeagueChallengeRecord, OrmMutationCtx } from "./types";

export async function scheduleChallengeNotification(input: {
  actorUserId: Id<"user">;
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  eventType: NotificationEventType;
  metadata?: Record<string, unknown>;
  recipientMembershipIds: Id<"leagueMembership">[];
}) {
  const memberships = await Promise.all(
    Array.from(new Set(input.recipientMembershipIds)).map((membershipId) =>
      getMembershipRecordByIdOrThrow(input.ctx, membershipId)
    )
  );
  const recipientUserIds = await Promise.all(
    memberships.map(async (membership) => {
      const currentPlayerProfile =
        await input.ctx.orm.query.playerProfile.findFirst({
          where: {
            id: membership.playerProfileId as Id<"playerProfile">,
          },
        });

      return currentPlayerProfile?.userId as Id<"user"> | undefined;
    })
  );

  await scheduleLeagueNotification(input.ctx, {
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    leagueId: input.challenge.leagueId as Id<"league">,
    metadata: {
      challengeId: input.challenge.id,
      ...input.metadata,
    },
    recipientUserIds: recipientUserIds.filter((userId): userId is Id<"user"> =>
      Boolean(userId)
    ),
    sourceEntityId: input.challenge.id,
    sourceEntityType: "leagueChallenge",
  });
}

/**
 * Retracts prior feed rows tied to this challenge before emitting a
 * superseding event (cancel, reschedule via counter-propose, admin
 * cancel/reopen). Prevents stale "Novo desafio" / "Proposta recebida"
 * notifications from lingering in the in-app feed after the challenge has
 * moved on.
 */
export async function retractChallengeNotifications(
  ctx: OrmMutationCtx,
  challengeId: Id<"leagueChallenge"> | string
) {
  await ctx.runMutation(
    internal.notification.orchestrator.retractNotifications,
    {
      sourceEntityId: challengeId,
      sourceEntityType: "leagueChallenge",
    }
  );
}

export function buildTodayUtcKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
