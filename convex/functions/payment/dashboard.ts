import { z } from "zod";
import {
  dashboardOverviewSchema,
  dashboardRevenueSeriesSchema,
  paymentAccountSchema,
  SOURCE_TYPE_TOURNAMENT_ENTRY,
  type DashboardOverview,
  type DashboardRecentCharge,
  type DashboardRevenueSeries,
} from "../../domains/payment/contract";
import {
  buildRevenueSeries,
  organizerCentsOf,
  type RevenueCharge,
} from "../../domains/payment/dashboard-rules";
import { authQuery } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";
import type { Id } from "../_generated/dataModel";

/**
 * Read bound for the charge history behind the series: the window reaches 24
 * months, so it reads deeper than `getOverview`'s (month + last month + 5 most
 * recent). Same filter and order as `getOverview`.
 */
const REVENUE_CHARGE_LIMIT = 1000;
const DEFAULT_REVENUE_MONTHS = 6;

export const getOverview = authQuery
  .output(dashboardOverviewSchema)
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);

    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });

    const account = org?.paymentAccount
      ? paymentAccountSchema.safeParse(org.paymentAccount).data
      : null;

    const accountInfo = {
      name: account?.name ?? null,
      pixKey: account?.pixKey ?? null,
      status: account?.status ?? null,
    };

    // If not connected to Woovi, return zeros early.
    if (account?.status !== "active") {
      return {
        account: accountInfo,
        metrics: {
          paymentsThisMonth: 0,
          receivedLastMonthCents: 0,
          receivedThisMonthCents: 0,
        },
        recentCharges: [],
      } satisfies DashboardOverview;
    }

    // --- Date boundaries ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // --- Charges for this org (most recent first) ---
    // Filter by sourceType to avoid mixing in future source types
    // (event_registration, etc.). Cap to the 500 most recent charges: the KPI
    // only needs this month, last month and the 5 recent ones.
    const charges = await ctx.orm.query.paymentCharge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { organizationId, sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY },
    });

    const paidThisMonth = charges.filter(
      (c) => c.status === "PAID" && c.paidAt && c.paidAt >= startOfMonth
    );
    const paidLastMonth = charges.filter(
      (c) =>
        c.status === "PAID" &&
        c.paidAt &&
        c.paidAt >= startOfLastMonth &&
        c.paidAt < startOfMonth
    );

    const receivedThisMonthCents = paidThisMonth.reduce(
      (sum, c) => sum + organizerCentsOf(c),
      0
    );
    const receivedLastMonthCents = paidLastMonth.reduce(
      (sum, c) => sum + organizerCentsOf(c),
      0
    );

    // --- Recent charges (last 5, any status) ---
    const recentRaw = charges.slice(0, 5);
    const recentCharges: DashboardRecentCharge[] = [];

    for (const charge of recentRaw) {
      const profile = await ctx.orm.query.playerProfile.findFirst({
        where: {
          id: charge.playerProfileId as Id<"playerProfile">,
        },
      });
      recentCharges.push({
        amountCents: charge.amountCents,
        chargeId: charge.id as string,
        createdAt: charge.createdAt.toISOString(),
        organizerCents: organizerCentsOf(charge),
        paidAt: charge.paidAt?.toISOString() ?? null,
        playerName: profile?.fullName ?? null,
        sourceLabel: charge.sourceLabel ?? null,
        status: charge.status as DashboardRecentCharge["status"],
      });
    }

    return {
      account: accountInfo,
      metrics: {
        paymentsThisMonth: paidThisMonth.length,
        receivedLastMonthCents,
        receivedThisMonthCents,
      },
      recentCharges,
    } satisfies DashboardOverview;
  });

/**
 * Série mensal de receita da home da organização: charges PAID das inscrições
 * de torneio (o MESMO filtro de `getOverview`), agrupadas pelo mês brasileiro de
 * `paidAt` e valoradas no split do organizador — o mesmo dinheiro que
 * `getOverview` reporta. Todo mês da
 * janela aparece (vazio = zero) e `bySource` abre a mesma janela por competição.
 * Mesmo gate de conta: organização sem conta Woovi ativa recebe série vazia.
 */
export const getRevenueSeries = authQuery
  .input(z.object({ months: z.number().int().min(1).max(24).optional() }))
  .output(dashboardRevenueSeriesSchema)
  .query(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);

    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });
    const account = org?.paymentAccount
      ? paymentAccountSchema.safeParse(org.paymentAccount).data
      : null;
    if (account?.status !== "active") {
      return {
        bySource: [],
        series: [],
        totalCents: 0,
      } satisfies DashboardRevenueSeries;
    }

    const charges = await ctx.orm.query.paymentCharge.findMany({
      limit: REVENUE_CHARGE_LIMIT,
      orderBy: { createdAt: "desc" },
      where: {
        organizationId,
        sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
      },
    });
    const revenueCharges: RevenueCharge[] = charges.map((charge) => ({
      amountCents: charge.amountCents,
      paidAtMs: charge.paidAt?.getTime() ?? null,
      sourceId: charge.sourceId,
      sourceLabel: charge.sourceLabel ?? null,
      sourceType: charge.sourceType,
      splitConfig: charge.splitConfig ?? null,
      status: charge.status,
    }));

    return buildRevenueSeries({
      charges: revenueCharges,
      months: input.months ?? DEFAULT_REVENUE_MONTHS,
      nowMs: Date.now(),
    });
  });
