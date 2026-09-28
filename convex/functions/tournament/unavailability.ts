import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { InferSelectModel } from "kitcn/orm";
import {
  RemoveTournamentUnavailabilitySchema,
  SetTournamentUnavailabilitySchema,
  TournamentByIdSchema,
  tournamentUnavailabilitySchema,
} from "../../domains/tournament/contract";
import { validateTournamentEditStatus } from "../../domains/tournament/management-rules";
import { findDuplicateUnavailability } from "../../domains/tournament/unavailability-rules";
import type { TournamentStatus } from "../../domains/tournament/contract";
import { tournamentUnavailability } from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import { getViewerContext } from "../viewer/context";
import {
  getManagedTournamentOrThrow,
  getTournamentRecordOrThrow,
  listTournamentUnavailability,
  resolveTournamentCourtName,
} from "./_shared/guards";

type UnavailabilityRecord = InferSelectModel<typeof tournamentUnavailability>;

function serializeUnavailability(
  record: UnavailabilityRecord,
  courts: Record<string, unknown>[] | null | undefined
) {
  return tournamentUnavailabilitySchema.parse({
    courtId: record.courtId ?? null,
    courtName: resolveTournamentCourtName({
      courtId: record.courtId,
      courts,
    }),
    createdAt: record.createdAt.getTime(),
    date: record.date,
    endMinute: record.endMinute ?? null,
    id: record.id,
    reason: record.reason,
    startMinute: record.startMinute ?? null,
  });
}

/**
 * Fecha dia, período ou quadra da agenda. Repetir o MESMO bloqueio só troca o
 * motivo (chave natural = data + quadra + faixa), nunca duplica a linha.
 */
export const set = authMutation
  .input(SetTournamentUnavailabilitySchema)
  .output(tournamentUnavailabilitySchema)
  .mutation(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const statusError = validateTournamentEditStatus(
      record.status as TournamentStatus
    );
    if (statusError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: statusError });
    }
    const courts = record.courts ?? [];
    if (
      input.courtId !== null &&
      !courts.some((court: { id: string }) => court.id === input.courtId)
    ) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Quadra inválida." });
    }

    const duplicate = findDuplicateUnavailability({
      blocks: await listTournamentUnavailability(ctx, {
        date: input.date,
        tournamentId: record.id as Id<"tournament">,
      }),
      courtId: input.courtId,
      date: input.date,
      endMinute: input.endMinute,
      startMinute: input.startMinute,
    });
    if (duplicate) {
      const [updated] = await ctx.orm
        .update(tournamentUnavailability)
        .set({
          createdByUserId: ctx.userId as Id<"user">,
          reason: input.reason,
        })
        .where(
          eq(
            tournamentUnavailability.id,
            duplicate.id as Id<"tournamentUnavailability">
          )
        )
        .returning();
      return serializeUnavailability(updated, courts);
    }

    const now = new Date();
    const [created] = await ctx.orm
      .insert(tournamentUnavailability)
      .values({
        courtId: input.courtId ?? undefined,
        createdAt: now,
        createdByUserId: ctx.userId as Id<"user">,
        date: input.date,
        endMinute: input.endMinute ?? undefined,
        reason: input.reason,
        startMinute: input.startMinute ?? undefined,
        tournamentId: record.id as Id<"tournament">,
      })
      .returning();
    return serializeUnavailability(created, courts);
  });

/** Desbloqueia: o período volta a aceitar agendamento na hora. */
export const remove = authMutation
  .input(RemoveTournamentUnavailabilitySchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const block = await ctx.orm.query.tournamentUnavailability.findFirst({
      where: {
        id: input.unavailabilityId as Id<"tournamentUnavailability">,
      },
    });
    if (!block) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Bloqueio não encontrado.",
      });
    }
    const record = await getManagedTournamentOrThrow(
      ctx,
      block.tournamentId as Id<"tournament">
    );
    const statusError = validateTournamentEditStatus(
      record.status as TournamentStatus
    );
    if (statusError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: statusError });
    }

    await ctx.orm
      .delete(tournamentUnavailability)
      .where(
        eq(
          tournamentUnavailability.id,
          block.id as Id<"tournamentUnavailability">
        )
      );
    return { success: true };
  });

/** Mesmo gate das leituras da agenda: organizador ou torneio em andamento. */
export const list = authQuery
  .input(TournamentByIdSchema)
  .output(z.array(tournamentUnavailabilitySchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const isOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === record.organizationId;
    if (
      !isOrganizer &&
      record.status !== "ongoing" &&
      record.status !== "finished"
    ) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "A agenda ainda não está disponível.",
      });
    }
    const rows = await listTournamentUnavailability(ctx, {
      tournamentId: record.id as Id<"tournament">,
    });
    const courts = record.courts ?? [];
    return rows.map((row) => serializeUnavailability(row, courts));
  });
