import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../generated/server";
import {
  TournamentByIdSchema,
  tournamentDiscoverySchema,
  tournamentSchema,
  type TournamentGender,
  type TournamentModality,
} from "../../domains/tournament/contract";
import type { tournament } from "../../domains/tournament/tables";
import {
  resolveCallerEligibility,
  selectViewerTournamentEntryIds,
} from "../../domains/tournament/entry-rules";
import { authQuery } from "../../lib/crpc";
import { getViewerContext } from "../viewer/context";
import {
  isDiscoverable,
  serializeCategory,
  serializeTournament,
} from "./_shared/guards";

type TournamentRecord = InferSelectModel<typeof tournament>;

async function countActiveEntries(
  ctx: QueryCtx,
  tournamentId: Id<"tournament">
) {
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: 10,
    where: { tournamentId },
  });
  let count = 0;
  for (const category of categories) {
    const entries = await ctx.orm.query.tournamentEntry.findMany({
      limit: 200,
      where: {
        categoryId: category.id as Id<"tournamentCategory">,
        status: "active",
      },
    });
    count += entries.length;
  }
  return count;
}

export const getById = authQuery
  .input(TournamentByIdSchema)
  .output(tournamentDiscoverySchema)
  .query(async ({ ctx, input }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const record = await ctx.orm.query.tournament.findFirst({
      where: { id: input.tournamentId as Id<"tournament"> },
    });
    if (!record) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Torneio não encontrado.",
      });
    }

    const isTournamentOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === record.organizationId;

    // Compute the viewer's entries BEFORE the visibility gate: a participant of
    // THIS tournament (non-cancelled entry in one of its categories) can always
    // open the detail, even when private. The category filter ties participation
    // to the tournament, so a foreign entry neither unlocks the gate nor leaks.
    const categoryRecords = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    const viewerEntryIds: string[] = [];
    const isViewerPlayer = viewerContext.activeActor.kind === "player";
    let viewerPlayerGender: null | string = null;
    if (viewerContext.activeActor.kind === "player") {
      const playerProfileId = viewerContext.activeActor
        .id as Id<"playerProfile">;
      const [asA, asB, viewerProfile] = await Promise.all([
        ctx.orm.query.tournamentEntry.findMany({
          limit: 100,
          where: { playerAId: playerProfileId },
        }),
        ctx.orm.query.tournamentEntry.findMany({
          limit: 100,
          where: { playerBId: playerProfileId },
        }),
        ctx.orm.query.playerProfile.findFirst({
          where: { id: playerProfileId },
        }),
      ]);
      viewerPlayerGender = viewerProfile?.gender ?? null;
      viewerEntryIds.push(
        ...selectViewerTournamentEntryIds({
          categoryIds: categoryRecords.map((category) => category.id as string),
          entries: [...asA, ...asB],
        })
      );
    }

    if (
      !(
        isTournamentOrganizer ||
        isDiscoverable(record) ||
        viewerEntryIds.length > 0
      )
    ) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Torneio não encontrado.",
      });
    }

    // Per-category CALLER gate (same pure rule as `entries.create`) read from the
    // server. null = no active player profile (organizer/guest), nothing to gate.
    const categories = categoryRecords.map((category) => {
      const eligibility = isViewerPlayer
        ? resolveCallerEligibility({
            gender: category.gender as TournamentGender,
            modality: category.modality as TournamentModality,
            playerAGender: viewerPlayerGender,
          })
        : null;

      return {
        ...serializeCategory(category),
        viewerEligible: eligibility?.eligible ?? null,
        // Badge sem espaço pra frase: o rótulo curto (≤2 palavras) vem do
        // mesmo resultado da regra; a mensagem longa fica no erro do create.
        viewerIneligibleReason: eligibility?.label ?? null,
      };
    });

    return tournamentDiscoverySchema.parse({
      ...(await serializeTournament(ctx, record)),
      activeEntryCount: await countActiveEntries(
        ctx,
        record.id as Id<"tournament">
      ),
      categories,
      isTournamentOrganizer,
      viewerEntryIds,
    });
  });

export const listAvailable = authQuery
  .output(z.array(tournamentSchema))
  .query(async ({ ctx }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const records = await ctx.orm.query.tournament.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
    });

    const visible = records.filter((record) => {
      const isTournamentOrganizer =
        viewerContext.activeActor.kind === "organization" &&
        record.organizationId === viewerContext.activeActor.id;
      return isTournamentOrganizer || isDiscoverable(record);
    });

    return Promise.all(
      visible.map((record) => serializeTournament(ctx, record))
    );
  });

export const listParticipating = authQuery
  .output(z.array(tournamentSchema))
  .query(async ({ ctx }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    if (viewerContext.activeActor.kind !== "player") {
      return [];
    }

    const playerProfileId = viewerContext.activeActor.id as Id<"playerProfile">;
    const [asA, asB] = await Promise.all([
      ctx.orm.query.tournamentEntry.findMany({
        limit: 100,
        where: { playerAId: playerProfileId },
      }),
      ctx.orm.query.tournamentEntry.findMany({
        limit: 100,
        where: { playerBId: playerProfileId },
      }),
    ]);

    const categoryIds = [
      ...new Set(
        [...asA, ...asB]
          .filter((entry) => entry.status !== "cancelled")
          .map((entry) => entry.categoryId as Id<"tournamentCategory">)
      ),
    ];

    const tournamentIds = new Set<Id<"tournament">>();
    for (const categoryId of categoryIds) {
      const category = await ctx.orm.query.tournamentCategory.findFirst({
        where: { id: categoryId },
      });
      if (category) {
        tournamentIds.add(category.tournamentId as Id<"tournament">);
      }
    }

    const records = await Promise.all(
      [...tournamentIds].map((id) =>
        ctx.orm.query.tournament.findFirst({ where: { id } })
      )
    );

    return Promise.all(
      records
        .filter((record): record is TournamentRecord => Boolean(record))
        .map((record) => serializeTournament(ctx, record))
    );
  });
