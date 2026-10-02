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
  normalizeStoredTournamentAddress,
  tournamentCategorySchema,
  tournamentSchema,
} from "../../../domains/tournament/contract";
import { isBracketReleased } from "../../../domains/tournament/scheduling-rules";
import type { NotificationEventType } from "../../../shared/notifications/protocol";
import { resolveStorageUrl } from "../../../shared/media-rules";
import { PLAYER_REMOVED_NAME } from "../../../domains/player/identity";

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
 * Net de corrida dos indices unicos: o cliente ve um erro tratado do dominio,
 * nunca o 500 cru do indice. Os guards de codigo tornam a colisao quase
 * impossivel, mas dois writes concorrentes ainda podem intercalar.
 */
export function isUniqueIndexViolation(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Unique index") &&
    error.message.includes("violation")
  );
}

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
    address: normalizeStoredTournamentAddress(record.address),
    approvalMode: record.approvalMode ?? "auto",
    avatarStorageId: record.avatarStorageId ?? null,
    avatarUrl,
    bracketReleaseAt: record.bracketReleaseAt?.getTime() ?? null,
    bracketReleased: isBracketReleased(record),
    courts: record.courts ?? [],
    coverStorageId: record.coverStorageId ?? null,
    coverUrl,
    createdAt: record.createdAt.getTime(),
    description: record.description ?? null,
    endDate: record.endDate?.getTime() ?? null,
    locationNotes: record.locationNotes ?? null,
    registrationDeadlineAt: record.registrationDeadlineAt.getTime(),
    startDate: record.startDate.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

export function serializeCategory(record: TournamentCategoryRecord) {
  return tournamentCategorySchema.parse({
    entryFeeCents: record.entryFeeCents,
    gender: record.gender,
    id: record.id,
    maxEntries: record.maxEntries ?? null,
    modality: record.modality,
    name: record.name,
    tournamentId: record.tournamentId,
  });
}

/** Nome da quadra para copy e leitura; quadra removida do torneio cai no rotulo generico. */
export function resolveTournamentCourtName(input: {
  courtId: null | string | undefined;
  courts: Record<string, unknown>[] | null | undefined;
}): null | string {
  if (typeof input.courtId !== "string") {
    return null;
  }
  const court = (input.courts ?? []).find((row) => row.id === input.courtId);
  return typeof court?.name === "string" ? court.name : null;
}

/** Bloqueios do torneio: por dia na porta de agendamento, todos na listagem. */
export function listTournamentUnavailability(
  ctx: OrmCtx,
  input: { date?: string; tournamentId: Id<"tournament"> }
) {
  return ctx.orm.query.tournamentUnavailability.findMany({
    limit: input.date ? 50 : 200,
    where: input.date
      ? { date: input.date, tournamentId: input.tournamentId }
      : { tournamentId: input.tournamentId },
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
 * canonical form); null when the profile/user has no username yet. The avatar
 * falls back to the auth user image (Google), like the dashboard card.
 */
export async function serializePlayerCard(
  ctx: QueryCtx | MutationCtx,
  input: {
    avatarStorageId: string | null | undefined;
    fullName: string | null | undefined;
    image: string | null | undefined;
    nickname: string | null | undefined;
    playerProfileId: string;
    removed?: boolean;
    username: string | null | undefined;
  }
) {
  if (input.removed) {
    return {
      avatarUrl: null,
      fullName: PLAYER_REMOVED_NAME,
      nickname: null,
      playerProfileId: input.playerProfileId,
      username: null,
    };
  }
  const avatarUrl = await resolveStorageUrl(
    ctx,
    input.avatarStorageId ?? null,
    {
      isDeletable: () => true,
    }
  );
  return {
    avatarUrl: avatarUrl ?? input.image ?? null,
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
