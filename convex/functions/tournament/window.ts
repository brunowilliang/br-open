import { eq } from "kitcn/orm";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../generated/server";
import { MAX_TOURNAMENT_CATEGORIES } from "../../domains/tournament/contract";
import {
  brazilDayKey,
  matchNeedsSchedule,
  resolveTournamentWindow,
  shouldNotifyWindowOverflow,
} from "../../domains/tournament/window-rules";
import { tournament } from "../../domains/tournament/tables";
import { privateMutation } from "../../lib/crpc";
import {
  getTournamentManagerUserIds,
  scheduleTournamentNotification,
  type OrmCtx,
} from "./_shared/guards";

/**
 * Cron (de hora em hora): a JANELA venceu e ficou confronto sem horario. Avisa
 * o organizador no dia do fim e de novo a cada dia enquanto persistir, nunca
 * encerrando nada: a conclusao e ato dele. O marcador `windowNoticeSentAt`
 * segura a repeticao dentro do mesmo dia.
 */
export const notifyWindowOverflow = privateMutation
  .input(z.object({}))
  .output(z.object({ notified: z.number().int().nonnegative() }))
  .mutation(async ({ ctx }) => {
    const ormCtx = ctx as unknown as OrmCtx;
    const eligible = await ormCtx.orm.query.tournament.findMany({
      limit: 100,
      where: { status: { in: ["drawn", "ongoing"] } },
    });

    const now = new Date();
    const nowMs = now.getTime();
    let notified = 0;

    for (const record of eligible) {
      const window = resolveTournamentWindow({
        endDateMs: record.endDate?.getTime() ?? null,
        startDateMs: record.startDate.getTime(),
      });
      if (window.endDayKey === null) {
        continue;
      }

      const categories = await ormCtx.orm.query.tournamentCategory.findMany({
        limit: MAX_TOURNAMENT_CATEGORIES,
        where: { tournamentId: record.id as Id<"tournament"> },
      });
      let unscheduledMatchCount = 0;
      for (const category of categories) {
        const matches = await ormCtx.orm.query.tournamentMatch.findMany({
          limit: 300,
          where: { categoryId: category.id as Id<"tournamentCategory"> },
        });
        unscheduledMatchCount += matches.filter(matchNeedsSchedule).length;
      }

      const shouldNotify = shouldNotifyWindowOverflow({
        lastNotifiedDayKey: record.windowNoticeSentAt
          ? brazilDayKey(record.windowNoticeSentAt.getTime())
          : null,
        nowMs,
        status: record.status,
        unscheduledMatchCount,
        window,
      });
      if (!shouldNotify) {
        continue;
      }

      const recipients = await getTournamentManagerUserIds(
        ormCtx,
        record.organizationId as Id<"organization">
      );
      if (recipients.length > 0) {
        await scheduleTournamentNotification(ctx as MutationCtx, {
          eventType: "tournament.window_expired",
          metadata: { endDate: window.endDayKey },
          recipientUserIds: recipients,
          tournamentId: record.id as Id<"tournament">,
        });
      }
      await ctx.orm
        .update(tournament)
        .set({ windowNoticeSentAt: now })
        .where(eq(tournament.id, record.id as Id<"tournament">));
      notified += 1;
    }

    return { notified };
  });
