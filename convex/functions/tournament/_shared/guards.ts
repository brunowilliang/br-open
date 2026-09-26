import { CRPCError } from "kitcn/server";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../generated/server";
import type { AuthenticatedCtx } from "../../../lib/crpc";
import { internal } from "../../_generated/api";
import { getViewerContext } from "../../viewer/context";
import type {
  tournament,
  tournamentCategory,
} from "../../../domains/tournament/tables";
import {
  tournamentCategorySchema,
  tournamentSchema,
} from "../../../domains/tournament/contract";
import type { NotificationEventType } from "../../../shared/notifications/protocol";
import { resolveStorageUrl } from "../../../shared/media-rules";

export type TournamentRecord = InferSelectModel<typeof tournament>;
export type TournamentCategoryRecord = InferSelectModel<
  typeof tournamentCategory
>;
export type OrmCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
export type OrmMutationCtx = AuthenticatedCtx<MutationCtx>;

const DISCOVERABLE_STATUSES = [
  "published",
  "drawn",
  "ongoing",
  "finished",
] as const;

/**
 * Public + not-cancelled: tournaments any viewer can discover. Shared by the
 * discovery detail gate and the entries listing gate.
 */
export function isDiscoverable(record: TournamentRecord) {
  return (
    record.visibility === "public" &&
    (DISCOVERABLE_STATUSES as readonly string[]).includes(record.status)
  );
}

export async function getTournamentRecordOrThrow(
  ctx: OrmCtx,
  tournamentId: Id<"tournament">
) {
  const record = await ctx.orm.query.tournament.findFirst({
    where: { id: tournamentId },
  });
  if (!record) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Torneio não encontrado.",
    });
  }
  return record;
}

/** Ownership guard for organizer-owned tournaments. */
export async function getManagedTournamentOrThrow(
  ctx: OrmCtx,
  tournamentId: Id<"tournament">
) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const record = await getTournamentRecordOrThrow(ctx, tournamentId);
  if (
    viewerContext.activeActor.kind !== "organization" ||
    viewerContext.activeActor.id !== record.organizationId
  ) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Torneio não encontrado para esse organizador.",
    });
  }
  return record;
}

export function assertTournamentStatus(
  record: TournamentRecord,
  allowed: TournamentRecord["status"][]
) {
  if (!allowed.includes(record.status)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O estado atual do torneio não permite essa ação.",
    });
  }
}

export async function getCategoryRecordOrThrow(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">
) {
  const record = await ctx.orm.query.tournamentCategory.findFirst({
    where: { id: categoryId },
  });
  if (!record) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Categoria não encontrada.",
    });
  }
  return record;
}

export async function serializeTournament(
  ctx: QueryCtx | MutationCtx,
  record: TournamentRecord
) {
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveStorageUrl(ctx, record.avatarStorageId, { isDeletable: () => true }),
    resolveStorageUrl(ctx, record.coverStorageId, { isDeletable: () => true }),
  ]);

  return tournamentSchema.parse({
    ...record,
    approvalMode: record.approvalMode ?? "auto",
    avatarStorageId: record.avatarStorageId ?? null,
    avatarUrl,
    courts: record.courts ?? [],
    coverStorageId: record.coverStorageId ?? null,
    coverUrl,
    createdAt: record.createdAt.getTime(),
    description: record.description ?? null,
    locationNotes: record.locationNotes ?? null,
    registrationDeadlineAt: record.registrationDeadlineAt.getTime(),
    startDate: record.startDate.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

export function serializeCategory(record: TournamentCategoryRecord) {
  return tournamentCategorySchema.parse({
    displayName: record.displayName,
    entryFeeCents: record.entryFeeCents,
    gender: record.gender,
    id: record.id,
    maxEntries: record.maxEntries ?? null,
    modality: record.modality,
    tournamentId: record.tournamentId,
  });
}

/**
 * Tournament notifications go through the orchestrator pipeline via the
 * generic source resolution by tournamentId.
 */
export async function scheduleTournamentNotification(
  ctx: MutationCtx,
  input: {
    actorUserId?: Id<"user"> | null;
    eventType: NotificationEventType;
    metadata?: Record<string, unknown>;
    recipientUserIds: Id<"user">[];
    sourceEntityId?: string;
    sourceEntityType?: string;
    tournamentId: Id<"tournament">;
  }
) {
  const unique = [...new Set(input.recipientUserIds)];
  if (unique.length === 0) {
    return;
  }
  await ctx.scheduler.runAfter(
    0,
    internal.notification.orchestrator.createForRecipients,
    {
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      recipientUserIds: unique,
      ...(input.sourceEntityType && input.sourceEntityId
        ? {
            sourceEntityId: input.sourceEntityId,
            sourceEntityType: input.sourceEntityType,
          }
        : {}),
      tournamentId: input.tournamentId,
    }
  );
}

/**
 * Player card for read surfaces (bracket/entries/invite search): profile
 * basics + auth username. `username` comes from the auth user (lowercase
 * canonical form); null when the profile/user has no username yet.
 */
export async function serializePlayerCard(
  ctx: QueryCtx | MutationCtx,
  input: {
    avatarStorageId: string | null | undefined;
    fullName: string | null | undefined;
    nickname: string | null | undefined;
    playerProfileId: string;
    username: string | null | undefined;
  }
) {
  const avatarUrl = await resolveStorageUrl(
    ctx,
    input.avatarStorageId ?? null,
    {
      isDeletable: () => true,
    }
  );
  return {
    avatarUrl,
    fullName: input.fullName ?? null,
    nickname: input.nickname ?? null,
    playerProfileId: input.playerProfileId,
    username: input.username ?? null,
  };
}

/** Manager user ids (owner/admin) of the tournament's organization. */
export async function getTournamentManagerUserIds(
  ctx: OrmCtx,
  organizationId: Id<"organization">
) {
  const members = await ctx.orm.query.member.findMany({
    limit: 100,
    where: { organizationId },
  });
  return members
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => m.userId as Id<"user">);
}
