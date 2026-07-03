import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { isLeaguePaid } from "../../domains/league/membership-rules";
import { leagueMembership } from "../../domains/league/tables";
import {
  createChargeOutputSchema,
  type PaymentChargeStatus,
  type SplitConfig,
} from "../../domains/payment/contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  computeSplit,
  normalizeWooviStatus,
} from "../../domains/payment/rules";
import { leaguePayment } from "../../domains/payment/tables";
import { getEnv } from "../../lib/get-env";
import { authAction, authQuery, privateMutation } from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { scheduleLeagueNotification } from "../notification/events";
import { getViewerContext } from "../viewer/context";
import { isActiveActorManager } from "../../domains/auth/actor-context";

// ---------------------------------------------------------------------------
// Charge creation (authAction — calls the Woovi SDK via a Node action)
// ---------------------------------------------------------------------------

const createChargeInput = z.object({
  leagueId: z.string().min(1),
  membershipId: z.string().min(1),
});

export const createCharge = authAction
  .input(createChargeInput)
  .output(createChargeOutputSchema)
  .action(async ({ ctx, input }) => {
    const membershipId = input.membershipId as Id<"leagueMembership">;
    const leagueId = input.leagueId as Id<"league">;
    // Validate the membership is awaiting_payment and the league is paid.
    const chargeData = await ctx.runMutation(
      internal.payment.charge.validateMembershipForCharge,
      {
        leagueId,
        membershipId,
        userId: ctx.userId,
      }
    );

    // Require the org to have an ACTIVE Woovi subaccount to receive splits.
    const wooviAccount = await ctx.runMutation(
      internal.payment.charge.resolveWooviAccountForCharge,
      { organizationId: chargeData.organizationId }
    );

    // Compute the split snapshot (organizer vs BR-Open).
    const split = computeSplit({
      amountCents: chargeData.amountCents,
      feePercent: getEnv().WOOVI_PLATFORM_FEE_PERCENT,
      recipientPixKey: wooviAccount.wooviPixKey,
    });

    // Call the Woovi SDK via a Node action (woovi-node.ts has "use node").
    // Use ctx.runAction (NOT the kitcn caller) so this file never imports the
    // "use node" module — that would break Convex bundling.
    let chargeResult: {
      brCode: string;
      correlationId: string;
      expiresDate: string | null;
      paymentLinkUrl: string;
      qrCodeImage: string;
      status: string;
      transactionID: string;
      value: number;
    };
    try {
      chargeResult = await ctx.runAction(
        internal.payment.wooviNode.createChargeWithSplitAction,
        {
          amountCents: chargeData.amountCents,
          comment: `Inscricao - ${asciiSafe(chargeData.leagueName)}`,
          correlationId: buildCorrelationId({
            membershipId,
            timestamp: Date.now(),
          }),
          expiresInSeconds: CHARGE_EXPIRES_IN_SECONDS,
          organizerCents: split.organizerCents,
          recipientPixKey: wooviAccount.wooviPixKey,
        }
      );
    } catch (error) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao criar cobranca: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      });
    }

    const savedCharge = await ctx.runMutation(
      internal.payment.charge.saveCharge,
      {
        amountCents: chargeData.amountCents,
        brCode: chargeResult.brCode,
        correlationId: chargeResult.correlationId,
        expiresAt: chargeResult.expiresDate,
        leagueId,
        membershipId,
        organizationId: chargeData.organizationId,
        playerProfileId: chargeData.playerProfileId,
        qrCodeImage: chargeResult.qrCodeImage,
        splitConfig: split,
        status: normalizeWooviStatus(chargeResult.status),
        wooviChargeId: chargeResult.transactionID,
      }
    );

    return {
      brCode: chargeResult.brCode,
      // Field kept under the legacy name `brCodeBase64` so the checkout
      // screen needs no changes. Woovi returns an HTTPS URL here.
      brCodeBase64: chargeResult.qrCodeImage,
      chargeId: savedCharge.id as Id<"leaguePayment">,
      expiresAt: chargeResult.expiresDate,
      status: normalizeWooviStatus(chargeResult.status),
    };
  });

// ---------------------------------------------------------------------------
// Query for existing charge (to re-display QR code)
// ---------------------------------------------------------------------------

export const getChargeForMembership = authQuery
  .input(z.object({ membershipId: z.string().min(1) }))
  .output(createChargeOutputSchema.nullable())
  .query(async ({ ctx, input }) => {
    const membershipId = input.membershipId as Id<"leagueMembership">;

    const charge = await ctx.orm.query.leaguePayment.findFirst({
      orderBy: { createdAt: "desc" },
      where: { membershipId, status: "PENDING" },
    });

    if (!charge) {
      return null;
    }

    // Ownership check: only the membership's owner may read their charge.
    // Resolve membership -> playerProfile -> userId and verify against viewer.
    const [membership, playerProfile] = await Promise.all([
      ctx.orm.query.leagueMembership.findFirst({ where: { id: membershipId } }),
      charge.playerProfileId
        ? ctx.orm.query.playerProfile.findFirst({
            where: { id: charge.playerProfileId as Id<"playerProfile"> },
          })
        : null,
    ]);

    if (!(membership && playerProfile) || playerProfile.userId !== ctx.userId) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobranca nao encontrada.",
      });
    }

    return {
      brCode: charge.brCode ?? "",
      brCodeBase64: charge.qrCodeImage ?? "",
      chargeId: charge.id as Id<"leaguePayment">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      status: (charge.status as PaymentChargeStatus) ?? "PENDING",
    };
  });

// ---------------------------------------------------------------------------
// Private mutations (called via the kitcn caller from the webhook + cron)
// ---------------------------------------------------------------------------

const saveChargeInput = z.object({
  amountCents: z.number(),
  brCode: z.string(),
  correlationId: z.string(),
  expiresAt: z.string().nullable(),
  leagueId: z.string(),
  membershipId: z.string(),
  organizationId: z.string(),
  playerProfileId: z.string(),
  qrCodeImage: z.string(),
  splitConfig: z.custom<SplitConfig>(
    (v) => typeof v === "object" && v !== null
  ),
  status: z.string(),
  wooviChargeId: z.string(),
});

export const saveCharge = privateMutation
  .input(saveChargeInput)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(Date.now() + CHARGE_EXPIRES_IN_SECONDS * 1000);

    const existing = await ctx.orm.query.leaguePayment.findFirst({
      where: { membershipId: input.membershipId as Id<"leagueMembership"> },
    });

    if (existing) {
      await ctx.orm
        .update(leaguePayment)
        .set({
          amountCents: input.amountCents,
          brCode: input.brCode,
          expiresAt,
          paidAt: null,
          qrCodeImage: input.qrCodeImage,
          splitConfig: input.splitConfig,
          status: input.status,
          updatedAt: now,
          wooviChargeId: input.wooviChargeId,
          wooviCorrelationId: input.correlationId,
        })
        .where(eq(leaguePayment.id, existing.id));
      return existing;
    }

    const row = (
      await ctx.orm
        .insert(leaguePayment)
        .values({
          amountCents: input.amountCents,
          brCode: input.brCode,
          createdAt: now,
          expiresAt,
          leagueId: input.leagueId as Id<"league">,
          membershipId: input.membershipId as Id<"leagueMembership">,
          organizationId: input.organizationId as Id<"organization">,
          paidAt: null,
          playerProfileId: input.playerProfileId as Id<"playerProfile">,
          qrCodeImage: input.qrCodeImage,
          splitConfig: input.splitConfig,
          status: input.status,
          updatedAt: now,
          wooviChargeId: input.wooviChargeId,
          wooviCorrelationId: input.correlationId,
        })
        .returning()
    )[0];

    return row;
  });

export const resolveWooviAccountForCharge = privateMutation
  .input(z.object({ organizationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const account = await ctx.orm.query.organizationWooviAccount.findFirst({
      where: {
        organizationId: input.organizationId as Id<"organization">,
      },
    });

    if (!account || account.status !== "active") {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Esta liga ainda nao esta recebendo pagamentos. O organizador precisa conectar a conta.",
      });
    }

    return {
      name: account.name,
      status: account.status,
      wooviPixKey: account.wooviPixKey,
    };
  });

/**
 * Atomic "charge paid → activate membership" pipeline.
 *
 * Replaces the previous two-step `markChargePaid` → `activateMembership`
 * sequence that ran as separate transactions and could leave a charge PAID
 * with the membership still `awaiting_payment` if the second step failed.
 *
 * The webhook now calls this single mutation so the full transition
 * (charge → PAID, capacity re-check, membership → active, refund on
 * overflow, payment_confirmed notification) commits atomically.
 *
 * `wooviTransactionStatus` carries the Woovi transaction status string
 * (the payload's `transaction.status`, e.g. "COMPLETED") — not an id. The
 * previous field name (`wooviTransactionId`) was misleading.
 */
export const applyPaidCharge = privateMutation
  .input(
    z.object({
      correlationId: z.string(),
      wooviTransactionStatus: z.string().optional(),
    })
  )
  .output(
    z.object({
      activated: z.boolean(),
      membershipId: z.string().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.leaguePayment.findFirst({
      where: { wooviCorrelationId: input.correlationId },
    });

    if (!(charge && canChargeBePaid(charge))) {
      return { activated: false, membershipId: null };
    }

    const membershipId = charge.membershipId as Id<"leagueMembership">;
    const now = new Date();

    // Step 1: mark charge PAID.
    await ctx.orm
      .update(leaguePayment)
      .set({
        paidAt: now,
        status: "PAID",
        updatedAt: now,
        ...(input.wooviTransactionStatus
          ? { wooviChargeId: input.wooviTransactionStatus }
          : {}),
      })
      .where(eq(leaguePayment.id, charge.id));

    // Step 2: load membership for activation.
    const membership = await ctx.orm.query.leagueMembership.findFirst({
      where: { id: membershipId },
    });

    if (!(membership && canMembershipBeCharged(membership))) {
      // Charge is PAID but membership is not in a chargeable state — leave
      // it; a reconciler (future) can recover. Avoid reverting the charge.
      return { activated: false, membershipId };
    }

    // Step 3: capacity re-check (over-enrollment guard).
    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: membership.leagueId as Id<"league"> },
    });
    if (!currentLeague) {
      return { activated: false, membershipId };
    }

    const { maxPlayers } = currentLeague;
    if (maxPlayers !== null && maxPlayers !== undefined) {
      const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
        limit: 500,
        where: {
          leagueId: membership.leagueId as Id<"league">,
          status: "active",
        },
      });
      if (activeMemberships.length >= maxPlayers) {
        // League filled up between charge creation and webhook. Refund and
        // revert membership to `left`. markChargeRefunded is a separate
        // mutation that runs in its own transaction; we accept the small
        // window (refund failure leaves charge PAID, membership awaiting).
        await ctx.runMutation(internal.payment.charge.markChargeRefunded, {
          correlationId: charge.wooviCorrelationId,
        });
        return { activated: false, membershipId };
      }
    }

    // Step 4: activate membership.
    await ctx.orm
      .update(leagueMembership)
      .set({
        reviewedAt: now,
        status: "active",
        updatedAt: now,
      })
      .where(eq(leagueMembership.id, membershipId));

    // Step 5: payment_confirmed notification.
    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: membership.playerProfileId as Id<"playerProfile"> },
    });
    if (playerProfile?.userId) {
      await scheduleLeagueNotification(ctx, {
        eventType: "league.membership.payment_confirmed",
        leagueId: membership.leagueId as Id<"league">,
        recipientUserIds: [playerProfile.userId as Id<"user">],
      });
    }

    return { activated: true, membershipId };
  });

export const markChargeExpired = privateMutation
  .input(z.object({ correlationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.leaguePayment.findFirst({
      where: { wooviCorrelationId: input.correlationId },
    });

    if (!charge) {
      return null;
    }

    if (!canChargeBeExpired(charge)) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(leaguePayment)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(leaguePayment.id, charge.id));

    return {
      leagueId: charge.leagueId as Id<"league">,
      membershipId: charge.membershipId as Id<"leagueMembership">,
      playerProfileId: charge.playerProfileId as Id<"playerProfile">,
    };
  });

export const markChargeRefunded = privateMutation
  .input(z.object({ correlationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.leaguePayment.findFirst({
      where: { wooviCorrelationId: input.correlationId },
    });

    if (!charge) {
      return null;
    }

    if (!canChargeBeRefunded(charge)) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(leaguePayment)
      .set({
        status: "REFUNDED",
        updatedAt: now,
      })
      .where(eq(leaguePayment.id, charge.id));

    await ctx.orm
      .update(leagueMembership)
      .set({
        rankingPosition: null,
        status: "left",
        updatedAt: now,
      })
      .where(
        eq(leagueMembership.id, charge.membershipId as Id<"leagueMembership">)
      );

    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: charge.playerProfileId as Id<"playerProfile"> },
    });
    if (playerProfile?.userId) {
      await scheduleLeagueNotification(ctx, {
        eventType: "league.membership.payment_refunded",
        leagueId: charge.leagueId as Id<"league">,
        recipientUserIds: [playerProfile.userId as Id<"user">],
      });
    }

    return charge.id;
  });

export const expireChargeForMembership = privateMutation
  .input(z.object({ membershipId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.leaguePayment.findFirst({
      where: {
        membershipId: input.membershipId as Id<"leagueMembership">,
        status: "PENDING",
      },
    });

    if (!charge) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(leaguePayment)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(leaguePayment.id, charge.id));

    return charge.id;
  });

export const validateMembershipForCharge = privateMutation
  .input(
    z.object({
      leagueId: z.string(),
      membershipId: z.string(),
      userId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const membershipId = input.membershipId as Id<"leagueMembership">;
    const leagueId = input.leagueId as Id<"league">;

    const membership = await ctx.orm.query.leagueMembership.findFirst({
      where: { id: membershipId, leagueId },
    });

    if (!membership) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Solicitacao nao encontrada.",
      });
    }

    if (!canMembershipBeCharged(membership)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esta solicitacao nao esta aguardando pagamento.",
      });
    }

    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: leagueId },
    });

    if (!currentLeague) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Liga nao encontrada.",
      });
    }

    if (!isLeaguePaid(currentLeague)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esta liga nao e paga.",
      });
    }

    return {
      amountCents: currentLeague.monthlyPriceCents ?? 0,
      leagueName: currentLeague.name,
      organizationId: currentLeague.organizationId as string,
      playerProfileId: membership.playerProfileId as string,
    };
  });

export const expireStaleCharges = privateMutation.mutation(async ({ ctx }) => {
  if (getEnv().DEPLOY_ENV !== "production") {
    return { expiredCount: 0 };
  }
  const now = new Date();
  const stale = await ctx.orm.query.leaguePayment.findMany({
    limit: 100,
    where: { status: "PENDING" },
  });
  const expired = stale.filter(
    (charge) => charge.expiresAt && charge.expiresAt < now
  );

  for (const charge of expired) {
    await ctx.orm
      .update(leaguePayment)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(leaguePayment.id, charge.id));

    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: charge.playerProfileId as Id<"playerProfile"> },
    });
    if (playerProfile?.userId) {
      await scheduleLeagueNotification(ctx, {
        eventType: "league.membership.payment_expired",
        leagueId: charge.leagueId as Id<"league">,
        recipientUserIds: [playerProfile.userId as Id<"user">],
      });
    }
  }

  return { expiredCount: expired.length };
});

export const resolveOrganizationForOnboarding = privateMutation
  .input(z.object({ organizationId: z.string() }))
  .output(z.object({ name: z.string().nullable() }))
  .mutation(async ({ ctx, input }) => {
    const org = await ctx.orm.query.organization.findFirst({
      where: { id: input.organizationId as Id<"organization"> },
    });
    return { name: org?.name ?? null };
  });

/**
 * Resolves the active manager's organization id from a userId. Used by the
 * onboarding authAction (which has no ctx.orm) via the kitcn caller.
 */
export const resolveActiveManagerOrg = privateMutation
  .input(z.object({ userId: z.string() }))
  .output(z.object({ organizationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const viewerContext = await getViewerContext(
      ctx as unknown as Parameters<typeof getViewerContext>[0],
      input.userId as Id<"user">
    );
    const { activeActor } = viewerContext;
    if (
      activeActor.kind !== "organization" ||
      !isActiveActorManager(activeActor)
    ) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Voce precisa ser gestor da organizacao para isso.",
      });
    }
    return {
      organizationId: activeActor.id as Id<"organization">,
    };
  });

// ---------------------------------------------------------------------------
// Cron entry (Phase 3.2): manual renewal reminders.
//
// For each PAID charge, computes nextDue = paidAt + billingInterval. Sends
// renewal_reminder (≤3 days before due) or marks the membership `suspended`
// and emits renewal_due (past due + no newer PAID charge for the membership).
// ---------------------------------------------------------------------------

const RENEWAL_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const BILLING_INTERVAL_MS: Record<string, number> = {
  month: 30 * 24 * 60 * 60 * 1000,
  once: Number.POSITIVE_INFINITY, // no renewal for one-time charges
  quarter: 90 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export const sendRenewalReminders = privateMutation.mutation(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { processed: 0 };
    }
    const now = Date.now();
    // Sweep PAID charges in batches of 100.
    const paid = await ctx.orm.query.leaguePayment.findMany({
      limit: 100,
      where: { status: "PAID" },
    });

    for (const charge of paid) {
      if (!charge.paidAt) {
        continue;
      }
      const league = await ctx.orm.query.league.findFirst({
        where: { id: charge.leagueId as Id<"league"> },
      });
      if (!league) {
        continue;
      }

      // "once" charges never renew.
      const intervalMs =
        BILLING_INTERVAL_MS[league.priceBillingInterval ?? "month"] ??
        BILLING_INTERVAL_MS.month!;
      if (intervalMs === Number.POSITIVE_INFINITY) {
        continue;
      }

      const nextDueMs = charge.paidAt.getTime() + intervalMs;

      // Already past due: check if there's a newer PAID charge for this
      // membership (the player renewed). If yes, skip. If not, suspend + notify.
      if (nextDueMs <= now) {
        const newer = await ctx.orm.query.leaguePayment.findFirst({
          orderBy: { paidAt: "desc" },
          where: {
            membershipId: charge.membershipId as Id<"leagueMembership">,
            status: "PAID",
          },
        });
        // If `charge` IS the latest PAID one (no newer), it's overdue.
        if (!newer || newer.id === charge.id) {
          const membership = await ctx.orm.query.leagueMembership.findFirst({
            where: { id: charge.membershipId as Id<"leagueMembership"> },
          });
          // Only suspend + notify on the active->suspended transition. Once
          // suspended, subsequent daily runs skip (no spam).
          if (membership && membership.status === "active") {
            await ctx.orm
              .update(leagueMembership)
              .set({
                status: "suspended",
                updatedAt: new Date(now),
              })
              .where(eq(leagueMembership.id, membership.id));
            const playerProfile = await ctx.orm.query.playerProfile.findFirst({
              where: { id: membership.playerProfileId as Id<"playerProfile"> },
            });
            if (playerProfile?.userId) {
              await scheduleLeagueNotification(ctx, {
                eventType: "league.membership.renewal_due",
                leagueId: charge.leagueId as Id<"league">,
                recipientUserIds: [playerProfile.userId as Id<"user">],
              });
            }
          }
        }
        continue;
      }

      // Within the reminder window: send renewal_reminder, deduped to once
      // per 24h via lastRenewalReminderSentAt on the membership.
      if (nextDueMs - now <= RENEWAL_REMINDER_WINDOW_MS) {
        const membershipForReminder =
          await ctx.orm.query.leagueMembership.findFirst({
            where: { id: charge.membershipId as Id<"leagueMembership"> },
          });
        const lastSentMs =
          membershipForReminder?.lastRenewalReminderSentAt?.getTime() ?? 0;
        if (now - lastSentMs >= 24 * 60 * 60 * 1000) {
          const playerProfile = await ctx.orm.query.playerProfile.findFirst({
            where: { id: charge.playerProfileId as Id<"playerProfile"> },
          });
          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.renewal_reminder",
              leagueId: charge.leagueId as Id<"league">,
              recipientUserIds: [playerProfile.userId as Id<"user">],
            });
          }
          if (membershipForReminder) {
            await ctx.orm
              .update(leagueMembership)
              .set({
                lastRenewalReminderSentAt: new Date(now),
                updatedAt: new Date(now),
              })
              .where(eq(leagueMembership.id, membershipForReminder.id));
          }
        }
      }
    }

    return { processed: paid.length };
  }
);

function buildCorrelationId(args: {
  membershipId: string;
  timestamp: number;
}): string {
  return `bropen:${args.membershipId}:${args.timestamp}`;
}

function asciiSafe(value: string): string {
  return Array.from(value.normalize("NFKD"))
    .filter((ch) => ch.codePointAt(0)! <= 0x7f)
    .join("");
}
