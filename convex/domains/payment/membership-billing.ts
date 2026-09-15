/**
 * League membership billing cycle — resolves the due date a membership has
 * already paid for.
 *
 * Shared by charge creation/renewal (`functions/payment/charge.ts`) and by the
 * league detail query that exposes `viewerMembershipDueAt`
 * (`functions/league/discovery.ts`).
 *
 * The cycle end is snapshotted on the charge that bought the period
 * (`paymentCharge.periodEndAt`), so an early renewal stacks on top of the
 * current due date instead of restarting from the payment date (IBX-0039).
 * Charges created before that column existed (and non-recurring sources) fall
 * back to `paidAt + billingInterval`, which is the previous behaviour.
 */

import type { InferSelectModel } from "kitcn/orm";
import type { QueryCtx } from "../../functions/generated/server";
import { SOURCE_TYPE_LEAGUE_MEMBERSHIP } from "./contract";
import { resolveBillingIntervalMs } from "./rules";
import type { paymentCharge } from "./tables";

type BillingCtx = Pick<QueryCtx, "orm">;
type ChargeBillingSnapshot = Pick<
  InferSelectModel<typeof paymentCharge>,
  "paidAt" | "periodEndAt"
>;

/**
 * Due date (epoch ms) carried by a PAID charge, or null when it doesn't cover a
 * recurring period (`periodEndAt` null and no `paidAt`, or a one-time billing
 * interval). `intervalMs` is `Infinity` for one-time leagues.
 */
export function membershipDueMsFromCharge(args: {
  charge: ChargeBillingSnapshot | null | undefined;
  intervalMs: number;
}): number | null {
  if (!(args.charge?.paidAt && Number.isFinite(args.intervalMs))) {
    return null;
  }

  return (
    args.charge.periodEndAt?.getTime() ??
    args.charge.paidAt.getTime() + args.intervalMs
  );
}

/**
 * Due date (epoch ms) of the period a membership is currently paying for, read
 * from its latest PAID charge. Null when the membership never concluded a
 * payment (checkout still open), the league is one-time (`once`) or the league
 * has an unknown billing interval.
 */
export async function resolveMembershipDueMs(
  ctx: BillingCtx,
  args: { membershipId: string; priceBillingInterval?: null | string }
): Promise<number | null> {
  const charge = await ctx.orm.query.paymentCharge.findFirst({
    orderBy: { paidAt: "desc" },
    where: {
      sourceId: args.membershipId,
      sourceType: SOURCE_TYPE_LEAGUE_MEMBERSHIP,
      status: "PAID",
    },
  });

  return membershipDueMsFromCharge({
    charge,
    intervalMs: resolveBillingIntervalMs(args.priceBillingInterval),
  });
}
