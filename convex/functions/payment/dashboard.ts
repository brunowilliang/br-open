import {
  dashboardOverviewSchema,
  paymentAccountSchema,
  type DashboardOverview,
  type DashboardRecentCharge,
} from "../../domains/payment/contract";
import { authQuery } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";
import type { Id } from "../_generated/dataModel";

function organizerCentsOf(charge: {
  amountCents: number;
  splitConfig: { organizerCents?: number } | null;
}): number {
  return charge.splitConfig?.organizerCents ?? charge.amountCents ?? 0;
}

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
    if (!account || account.status !== "active") {
      return {
        account: accountInfo,
        metrics: {
          receivedThisMonthCents: 0,
          receivedLastMonthCents: 0,
          activeSubscribers: 0,
          overdueCount: 0,
          paymentsThisMonth: 0,
          projectedMonthlyCents: 0,
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
    // (event_registration, tournament_entry, etc.).
    const charges = await ctx.orm.query.paymentCharge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { organizationId, sourceType: "league_membership" },
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

    // --- Paid leagues for this org ---
    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      where: { organizationId },
    });
    const paidLeagueIds = leagues
      .filter((l) => (l.monthlyPriceCents ?? 0) > 0)
      .map((l) => l.id as Id<"league">);

    // --- Membership counts in paid leagues ---
    let activeSubscribers = 0;
    let overdueCount = 0;
    let projectedMonthlyCents = 0;

    for (const leagueId of paidLeagueIds) {
      const memberships = await ctx.orm.query.leagueMembership.findMany({
        limit: 500,
        where: { leagueId },
      });
      const active = memberships.filter((m) => m.status === "active");
      const overdue = memberships.filter(
        (m) => m.status === "payment_due" || m.status === "suspended"
      );
      activeSubscribers += active.length;
      overdueCount += overdue.length;

      const leagueData = leagues.find((l) => l.id === leagueId);
      if (leagueData) {
        const interval = leagueData.priceBillingInterval ?? "month";
        const monthlyMultiplier =
          interval === "year"
            ? 1 / 12
            : interval === "quarter"
              ? 1 / 3
              : interval === "week"
                ? 4.33
                : interval === "once"
                  ? 0
                  : 1;
        projectedMonthlyCents += Math.round(
          (leagueData.monthlyPriceCents ?? 0) *
            monthlyMultiplier *
            active.length
        );
      }
    }

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
        activeSubscribers,
        overdueCount,
        paymentsThisMonth: paidThisMonth.length,
        projectedMonthlyCents,
        receivedLastMonthCents,
        receivedThisMonthCents,
      },
      recentCharges,
    } satisfies DashboardOverview;
  });
