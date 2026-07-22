import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { isLeaguePaid } from "../../domains/league/membership-rules";
import { leagueMembership } from "../../domains/league/tables";
import {
  checkoutContextSchema,
  createChargeOutputSchema,
  listMyPaymentsOutputSchema,
  paymentAccountSchema,
  type CheckoutContext,
  type PaymentChargeStatus,
  type SplitConfig,
} from "../../domains/payment/contract";
import {
  DEFAULT_LEAGUE_APPROVAL_MODE,
  DEFAULT_LEAGUE_GRACE_PERIOD_DAYS,
  DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
  DEFAULT_PLATFORM_FEE_PERCENT,
} from "../../domains/league/contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  computeSplit,
  normalizeProviderStatus,
  shouldMarkPaymentDue,
  shouldSendRenewalReminder,
  shouldSuspend,
} from "../../domains/payment/rules";
import { paymentCharge } from "../../domains/payment/tables";
import { getEnv } from "../../lib/get-env";
import {
  authAction,
  authMutation,
  authQuery,
  privateAction,
  privateMutation,
} from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { scheduleLeagueNotification } from "../notification/events";
import { getViewerContext } from "../viewer/context";
import { isActiveActorManager } from "../../domains/auth/actor-context";

// Source type discriminator. Today only league membership charges exist; the
// polymorphic pair (sourceType + sourceId) is ready for future sources
// (event_registration, tournament_entry, ...).
const SOURCE_TYPE_LEAGUE_MEMBERSHIP = "league_membership";

// ---------------------------------------------------------------------------
// Charge creation (authAction — calls the provider SDK via a Node action)
// ---------------------------------------------------------------------------

const createChargeInput = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
});

/**
 * Finds a still-valid PENDING charge for a (sourceType, sourceId) pair.
 * "Still-valid" means status === PENDING and expiresAt is in the future.
 * Called by `createCharge` before hitting the provider API — if a reusable
 * charge exists we return it instead of creating a duplicate.
 */
export const findPendingChargeForSource = privateMutation
  .input(
    z.object({
      sourceId: z.string().min(1),
      sourceType: z.string().min(1),
    })
  )
  .output(createChargeOutputSchema.nullable())
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        status: "PENDING",
      },
    });

    // No pending charge, or it has already expired — caller should create new.
    if (!charge?.expiresAt || charge.expiresAt <= now) {
      return null;
    }

    return {
      brCode: charge.brCode ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt.toISOString(),
      qrCodeUrl: charge.qrCodeImage ?? "",
      status: "PENDING",
    };
  });

/**
 * Public authQuery: returns just the chargeId of a still-valid PENDING charge
 * for a (sourceType, sourceId) pair, or null. Used by the league footer to
 * pre-fetch the pending charge so the "pay" button navigates instantly to
 * /checkout/[chargeId] without waiting for createCharge round-trip.
 */
export const getPendingCharge = authQuery
  .input(
    z.object({
      sourceId: z.string().min(1),
      sourceType: z.string().min(1),
    })
  )
  .output(z.object({ chargeId: z.string() }).nullable())
  .query(async ({ ctx, input }) => {
    // Ownership: resolve playerProfile from viewer, filter by it so a user
    // can't enumerate other players' charge ids.
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: ctx.userId },
    });
    if (!profile) {
      return null;
    }

    const now = new Date();
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        playerProfileId: profile.id as Id<"playerProfile">,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        status: "PENDING",
      },
    });

    if (!charge?.expiresAt || charge.expiresAt <= now) {
      return null;
    }

    return { chargeId: charge.id as string };
  });

export const createCharge = authAction
  .input(createChargeInput)
  .output(createChargeOutputSchema)
  .action(async ({ ctx, input }) => {
    const sourceId = input.sourceId;
    const sourceType = input.sourceType;

    // Reuse an existing PENDING charge if it's still valid (not expired).
    // This prevents duplicate charges when the player taps "pay" multiple
    // times, and makes the "resume checkout" path instant (no provider call).
    const existing = await ctx.runMutation(
      internal.payment.charge.findPendingChargeForSource,
      { sourceId, sourceType }
    );
    if (existing) {
      return existing;
    }

    // Validate the source is chargeable and gather amount + human label.
    const chargeData = await ctx.runMutation(
      internal.payment.charge.resolveSourceForCharge,
      {
        sourceId,
        sourceType,
        userId: ctx.userId,
      }
    );

    // Require the org to have an ACTIVE payment account to receive splits.
    const paymentAccount = await ctx.runMutation(
      internal.payment.charge.resolvePaymentAccount,
      { organizationId: chargeData.organizationId }
    );

    // Compute the split snapshot (organizer vs BR-Open).
    const split = computeSplit({
      amountCents: chargeData.amountCents,
      feePercent: chargeData.platformFeePercent,
      recipientPixKey: paymentAccount.pixKey,
    });

    // Call the provider SDK via a Node action (providerNode.ts has "use node").
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
        internal.payment.providerNode.createChargeWithSplitAction,
        {
          amountCents: chargeData.amountCents,
          comment: `Inscricao - ${asciiSafe(chargeData.sourceLabel)}`,
          correlationId: buildCorrelationId({
            sourceId,
            sourceType,
            timestamp: Date.now(),
          }),
          expiresInSeconds: CHARGE_EXPIRES_IN_SECONDS,
          organizerCents: split.organizerCents,
          recipientPixKey: paymentAccount.pixKey,
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
        organizationId: chargeData.organizationId,
        playerProfileId: chargeData.playerProfileId,
        providerChargeId: chargeResult.transactionID,
        qrCodeImage: chargeResult.qrCodeImage,
        sourceId,
        sourceLabel: chargeData.sourceLabel,
        sourceType,
        splitConfig: split,
        status: normalizeProviderStatus(chargeResult.status),
      }
    );

    return {
      brCode: chargeResult.brCode,
      chargeId: savedCharge.id as Id<"paymentCharge">,
      expiresAt: chargeResult.expiresDate,
      // Provider returns an HTTPS URL for the QR PNG (not a base64 string).
      qrCodeUrl: chargeResult.qrCodeImage,
      status: normalizeProviderStatus(chargeResult.status),
    };
  });

// ---------------------------------------------------------------------------
// Checkout context (re-display a charge's QR code by chargeId)
// ---------------------------------------------------------------------------

export const getCheckoutContext = authQuery
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(checkoutContextSchema)
  .query(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });
    if (!charge) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobranca nao encontrada.",
      });
    }
    // Ownership check: only the charge's owner may read it. Resolve
    // paymentCharge -> playerProfile -> userId and verify against viewer.
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: charge.playerProfileId as Id<"playerProfile"> },
    });
    if (!profile || profile.userId !== ctx.userId) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobranca nao encontrada.",
      });
    }
    return {
      amountCents: charge.amountCents,
      brCode: charge.brCode ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      qrCodeUrl: charge.qrCodeImage ?? "",
      sourceId: charge.sourceId,
      sourceLabel: charge.sourceLabel ?? null,
      sourceType: charge.sourceType,
      status: (charge.status as PaymentChargeStatus) ?? "PENDING",
    } satisfies CheckoutContext;
  });

// ---------------------------------------------------------------------------
// List the viewer's payments (player-facing payment hub)
// ---------------------------------------------------------------------------

export const listMine = authQuery
  .output(listMyPaymentsOutputSchema)
  .query(async ({ ctx }) => {
    // Resolve the viewer's active player profile (a user may have at most one).
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: ctx.userId },
    });
    if (!profile) {
      return { items: [] };
    }

    const charges = await ctx.orm.query.paymentCharge.findMany({
      limit: 50,
      orderBy: { createdAt: "desc" },
      where: {
        playerProfileId: profile.id as Id<"playerProfile">,
      },
    });

    // No league join/cache needed: sourceLabel is snapshotted on each charge.
    const items = charges.map((charge) => ({
      amountCents: charge.amountCents,
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      paidAt: charge.paidAt?.toISOString() ?? null,
      sourceId: charge.sourceId,
      sourceLabel: charge.sourceLabel ?? null,
      sourceType: charge.sourceType,
      status: (charge.status as PaymentChargeStatus) ?? "PENDING",
    }));

    return { items };
  });

// ---------------------------------------------------------------------------
// Private mutations (called via the kitcn caller from the webhook + cron)
// ---------------------------------------------------------------------------

const saveChargeInput = z.object({
  amountCents: z.number(),
  brCode: z.string(),
  correlationId: z.string(),
  expiresAt: z.string().nullable(),
  organizationId: z.string(),
  playerProfileId: z.string(),
  providerChargeId: z.string(),
  qrCodeImage: z.string(),
  sourceId: z.string(),
  sourceLabel: z.string(),
  sourceType: z.string(),
  splitConfig: z.custom<SplitConfig>(
    (v) => typeof v === "object" && v !== null
  ),
  status: z.string(),
});

export const saveCharge = privateMutation
  .input(saveChargeInput)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(Date.now() + CHARGE_EXPIRES_IN_SECONDS * 1000);

    // Always INSERT a new row. This gives a real per-charge history for the
    // player-facing "my payments" list (the previous upsert collapsed
    // retries onto a single row, hiding history).
    const row = (
      await ctx.orm
        .insert(paymentCharge)
        .values({
          amountCents: input.amountCents,
          brCode: input.brCode,
          correlationId: input.correlationId,
          createdAt: now,
          expiresAt,
          organizationId: input.organizationId as Id<"organization">,
          paidAt: null,
          playerProfileId: input.playerProfileId as Id<"playerProfile">,
          providerChargeId: input.providerChargeId,
          qrCodeImage: input.qrCodeImage,
          sourceId: input.sourceId,
          sourceLabel: input.sourceLabel,
          sourceType: input.sourceType,
          splitConfig: input.splitConfig,
          status: input.status,
          updatedAt: now,
        })
        .returning()
    )[0];

    return row;
  });

export const resolvePaymentAccount = privateMutation
  .input(z.object({ organizationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // The payment account is now embedded JSON on `organization.paymentAccount`
    // (the old `organizationWooviAccount` table was removed). Validate it with
    // `paymentAccountSchema` before trusting the raw JSON.
    const org = await ctx.orm.query.organization.findFirst({
      where: { id: input.organizationId as Id<"organization"> },
    });
    const account = org?.paymentAccount
      ? paymentAccountSchema.safeParse(org.paymentAccount).data
      : null;

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
      pixKey: account.pixKey,
    };
  });

/**
 * Resolves a payable source into the data needed to create a charge
 * (amount, human label, owning org, player profile).
 *
 * Polymorphic over `sourceType` + `sourceId`. Today only
 * `league_membership` is supported (sourceId is a `leagueMembership` id);
 * other source types throw NOT_FOUND until a handler is added.
 */
export const resolveSourceForCharge = privateMutation
  .input(
    z.object({
      sourceId: z.string(),
      sourceType: z.string(),
      userId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.sourceType !== SOURCE_TYPE_LEAGUE_MEMBERSHIP) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Tipo de cobranca nao suportado.",
      });
    }

    const membershipId = input.sourceId as Id<"leagueMembership">;

    const membership = await ctx.orm.query.leagueMembership.findFirst({
      where: { id: membershipId },
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
      where: { id: membership.leagueId as Id<"league"> },
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
      organizationId: currentLeague.organizationId as string,
      platformFeePercent:
        currentLeague.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT,
      playerProfileId: membership.playerProfileId as string,
      sourceLabel: currentLeague.name,
    };
  });

/**
 * Atomic "charge paid → apply source side effect" pipeline.
 *
 * Replaces the previous two-step `markChargePaid` → `activateMembership`
 * sequence that ran as separate transactions and could leave a charge PAID
 * with the membership still `awaiting_payment` if the second step failed.
 *
 * The webhook calls this single mutation so the full transition commits
 * atomically. The source-specific side effect (capacity re-check, membership
 * activation, refund on overflow, notifications) runs inside a
 * `sourceType === "league_membership"` branch; other source types just leave
 * the charge PAID for a reconciler.
 *
 * `providerTransactionId` carries the PIX end-to-end transaction identifier
 * (from `payload.transaction.transactionID` / `e2eId`), captured for
 * reconciliation. It is distinct from `providerChargeId` (the charge id).
 */
export const applyPaidCharge = privateMutation
  .input(
    z.object({
      correlationId: z.string(),
      providerTransactionId: z.string().optional(),
    })
  )
  .output(
    z.object({
      activated: z.boolean(),
      membershipId: z.string().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { correlationId: input.correlationId },
    });

    if (!(charge && canChargeBePaid(charge))) {
      return { activated: false, membershipId: null };
    }

    const now = new Date();

    // Step 1: mark charge PAID. Persist the PIX transaction id when present;
    // do NOT overwrite `providerChargeId` (captured at creation).
    await ctx.orm
      .update(paymentCharge)
      .set({
        paidAt: now,
        status: "PAID",
        updatedAt: now,
        ...(input.providerTransactionId
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
      })
      .where(eq(paymentCharge.id, charge.id));

    // Dispatch on source type. Today only league_membership has a side
    // effect; other sources leave the charge PAID for a reconciler.
    if (charge.sourceType !== SOURCE_TYPE_LEAGUE_MEMBERSHIP) {
      return { activated: false, membershipId: null };
    }

    const membershipId = charge.sourceId as Id<"leagueMembership">;

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
        // revert membership to `left`. markChargeRefunded runs in its own
        // transaction; we accept the small window (refund failure leaves
        // charge PAID, membership awaiting).
        await ctx.runMutation(internal.payment.charge.markChargeRefunded, {
          correlationId: charge.correlationId,
        });
        return { activated: false, membershipId };
      }
    }

    // Step 4: decide the membership's next status.
    // - Paid league + approvalMode `auto`   -> `active` (PIX was the only gate).
    // - Paid league + approvalMode `manual` -> `pending` (manager must still
    //   approve; payment is already confirmed so approval just flips to active).
    const approvalMode =
      currentLeague.approvalMode ?? DEFAULT_LEAGUE_APPROVAL_MODE;
    const requiresManualApproval = approvalMode === "manual";

    await ctx.orm
      .update(leagueMembership)
      .set({
        reviewedAt: requiresManualApproval ? null : now,
        status: requiresManualApproval ? "pending" : "active",
        updatedAt: now,
      })
      .where(eq(leagueMembership.id, membershipId));

    // Step 5: notify — payment_confirmed for auto, requested-style for manual.
    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: membership.playerProfileId as Id<"playerProfile"> },
    });
    if (playerProfile?.userId) {
      if (requiresManualApproval) {
        // Tell the player their payment was received and is pending approval.
        await scheduleLeagueNotification(ctx, {
          eventType: "league.membership.payment_confirmed",
          leagueId: membership.leagueId as Id<"league">,
          metadata: { chargeId: charge.id, membershipId },
          recipientUserIds: [playerProfile.userId as Id<"user">],
        });
        // Tell the managers there's a paid membership waiting for approval.
        // The member table is owned by the auth domain; org admins/owners
        // are the managers who approve join requests.
        const orgMembers = await ctx.orm.query.member.findMany({
          limit: 100,
          where: {
            organizationId: currentLeague.organizationId as Id<"organization">,
          },
        });
        const managerUserIds = orgMembers
          .filter((m) => m.role === "owner" || m.role === "admin")
          .map((m) => m.userId as Id<"user">);
        if (managerUserIds.length > 0) {
          await scheduleLeagueNotification(ctx, {
            actorUserId: playerProfile.userId,
            eventType: "league.membership.requested",
            leagueId: membership.leagueId as Id<"league">,
            metadata: { chargeId: charge.id, membershipId },
            recipientUserIds: managerUserIds,
          });
        }
      } else {
        await scheduleLeagueNotification(ctx, {
          eventType: "league.membership.payment_confirmed",
          leagueId: membership.leagueId as Id<"league">,
          metadata: { chargeId: charge.id, membershipId },
          recipientUserIds: [playerProfile.userId as Id<"user">],
        });
      }
    }

    return { activated: !requiresManualApproval, membershipId };
  });

export const markChargeExpired = privateMutation
  .input(z.object({ correlationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { correlationId: input.correlationId },
    });

    if (!charge) {
      return null;
    }

    if (!canChargeBeExpired(charge)) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    return {
      playerProfileId: charge.playerProfileId as Id<"playerProfile">,
      sourceId: charge.sourceId,
      sourceType: charge.sourceType,
    };
  });

export const markChargeRefunded = privateMutation
  .input(z.object({ correlationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { correlationId: input.correlationId },
    });

    if (!charge) {
      return null;
    }

    if (!canChargeBeRefunded(charge)) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set({
        status: "REFUNDED",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    // Source-specific refund side effects.
    if (charge.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP) {
      const membershipId = charge.sourceId as Id<"leagueMembership">;
      const membership = await ctx.orm.query.leagueMembership.findFirst({
        where: { id: membershipId },
      });
      await ctx.orm
        .update(leagueMembership)
        .set({
          rankingPosition: null,
          status: "left",
          updatedAt: now,
        })
        .where(eq(leagueMembership.id, membershipId));

      const playerProfile = await ctx.orm.query.playerProfile.findFirst({
        where: { id: charge.playerProfileId as Id<"playerProfile"> },
      });
      if (playerProfile?.userId) {
        await scheduleLeagueNotification(ctx, {
          eventType: "league.membership.payment_refunded",
          leagueId: membership?.leagueId as Id<"league">,
          metadata: { chargeId: charge.id },
          recipientUserIds: [playerProfile.userId as Id<"user">],
        });
      }
    }

    return charge.id;
  });

export const expireChargeForMembership = privateMutation
  .input(z.object({ sourceId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Today only called for league_membership sources; `sourceId` is the
    // leagueMembership id. Expire the most recent PENDING charge for it.
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        sourceId: input.sourceId,
        sourceType: SOURCE_TYPE_LEAGUE_MEMBERSHIP,
        status: "PENDING",
      },
    });

    if (!charge) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    return charge.id;
  });

export const expireStaleCharges = privateMutation.mutation(async ({ ctx }) => {
  if (getEnv().DEPLOY_ENV !== "production") {
    return { expiredCount: 0 };
  }
  const now = new Date();
  const stale = await ctx.orm.query.paymentCharge.findMany({
    limit: 100,
    where: { status: "PENDING" },
  });
  const expired = stale.filter(
    (charge) => charge.expiresAt && charge.expiresAt < now
  );

  for (const charge of expired) {
    await ctx.orm
      .update(paymentCharge)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    // Source-specific notification.
    if (charge.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP) {
      const membership = await ctx.orm.query.leagueMembership.findFirst({
        where: { id: charge.sourceId as Id<"leagueMembership"> },
      });
      if (membership) {
        const playerProfile = await ctx.orm.query.playerProfile.findFirst({
          where: { id: charge.playerProfileId as Id<"playerProfile"> },
        });
        if (playerProfile?.userId) {
          await scheduleLeagueNotification(ctx, {
            eventType: "league.membership.payment_expired",
            leagueId: membership.leagueId as Id<"league">,
            metadata: { chargeId: charge.id },
            recipientUserIds: [playerProfile.userId as Id<"user">],
          });
        }
      }
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
        message: "Voce precisa ser organizador da organização para isso.",
      });
    }
    return {
      organizationId: activeActor.id as Id<"organization">,
    };
  });

// ---------------------------------------------------------------------------
// Cron entry: renewal timeline with configurable grace period.
//
// For each PAID league_membership charge, computes nextDue = paidAt +
// billingInterval. Then applies the timeline:
//
//   D-reminderDaysBefore  → send renewal_reminder (deduped 24h)
//   D-0 (due)             → mark membership payment_due (still playable)
//   D+gracePeriodDays     → suspend membership + send renewal_due
//
// The cron reads `reminderDaysBefore` and `gracePeriodDays` from the league
// at runtime (not snapshotted) so organizers can adjust after creation.
// ---------------------------------------------------------------------------

const BILLING_INTERVAL_MS: Record<string, number> = {
  month: 30 * 24 * 60 * 60 * 1000,
  once: Number.POSITIVE_INFINITY, // no renewal for one-time charges
  quarter: 90 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

const REMINDER_DEDUPE_MS = 24 * 60 * 60 * 1000; // 24h

export const sendRenewalReminders = privateMutation.mutation(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { processed: 0 };
    }
    const now = Date.now();
    const nowDate = new Date(now);

    // Sweep PAID charges in batches of 100.
    const paid = await ctx.orm.query.paymentCharge.findMany({
      limit: 100,
      where: { status: "PAID" },
    });

    for (const charge of paid) {
      if (!charge.paidAt) {
        continue;
      }
      if (charge.sourceType !== SOURCE_TYPE_LEAGUE_MEMBERSHIP) {
        continue;
      }

      const membership = await ctx.orm.query.leagueMembership.findFirst({
        where: { id: charge.sourceId as Id<"leagueMembership"> },
      });
      if (!membership) {
        continue;
      }

      const league = await ctx.orm.query.league.findFirst({
        where: { id: membership.leagueId as Id<"league"> },
      });
      if (!league) {
        continue;
      }

      const intervalMs =
        BILLING_INTERVAL_MS[league.priceBillingInterval ?? "month"] ??
        BILLING_INTERVAL_MS.month!;
      if (intervalMs === Number.POSITIVE_INFINITY) {
        continue;
      }

      const nextDueMs = charge.paidAt.getTime() + intervalMs;

      // Check if there's a newer PAID charge for this membership (player
      // already renewed). If `charge` is not the latest PAID, skip entirely.
      const newer = await ctx.orm.query.paymentCharge.findFirst({
        orderBy: { paidAt: "desc" },
        where: {
          sourceId: charge.sourceId,
          sourceType: SOURCE_TYPE_LEAGUE_MEMBERSHIP,
          status: "PAID",
        },
      });
      if (newer && newer.id !== charge.id) {
        continue;
      }

      const gracePeriodDays =
        league.gracePeriodDays ?? DEFAULT_LEAGUE_GRACE_PERIOD_DAYS;
      const reminderDaysBefore =
        league.reminderDaysBefore ?? DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE;

      const playerProfile = await ctx.orm.query.playerProfile.findFirst({
        where: { id: membership.playerProfileId as Id<"playerProfile"> },
      });

      // --- Phase 3: grace period elapsed → suspend ---
      if (shouldSuspend({ nextDueMs, nowMs: now, gracePeriodDays })) {
        // Only on active/payment_due → suspended transition (avoid re-spam).
        if (
          membership.status === "active" ||
          membership.status === "payment_due"
        ) {
          await ctx.orm
            .update(leagueMembership)
            .set({
              status: "suspended",
              updatedAt: nowDate,
            })
            .where(eq(leagueMembership.id, membership.id));

          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.renewal_due",
              leagueId: membership.leagueId as Id<"league">,
              metadata: {
                chargeId: charge.id,
                membershipId: charge.sourceId,
              },
              recipientUserIds: [playerProfile.userId as Id<"user">],
            });
          }
        }
        continue;
      }

      // --- Phase 2: due date passed → mark payment_due ---
      if (shouldMarkPaymentDue({ nextDueMs, nowMs: now })) {
        if (membership.status === "active") {
          await ctx.orm
            .update(leagueMembership)
            .set({
              status: "payment_due",
              updatedAt: nowDate,
            })
            .where(eq(leagueMembership.id, membership.id));

          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.payment_due",
              leagueId: membership.leagueId as Id<"league">,
              metadata: {
                chargeId: charge.id,
                membershipId: charge.sourceId,
              },
              recipientUserIds: [playerProfile.userId as Id<"user">],
            });
          }
        }
        continue;
      }

      // --- Phase 1: approaching due date → send reminder ---
      if (
        shouldSendRenewalReminder({
          nextDueMs,
          nowMs: now,
          reminderDaysBefore,
        })
      ) {
        const lastSentMs = membership.lastRenewalReminderSentAt?.getTime() ?? 0;
        if (now - lastSentMs >= REMINDER_DEDUPE_MS) {
          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.renewal_reminder",
              leagueId: membership.leagueId as Id<"league">,
              metadata: {
                chargeId: charge.id,
                membershipId: charge.sourceId,
              },
              recipientUserIds: [playerProfile.userId as Id<"user">],
            });
          }
          await ctx.orm
            .update(leagueMembership)
            .set({
              lastRenewalReminderSentAt: nowDate,
              updatedAt: nowDate,
            })
            .where(eq(leagueMembership.id, membership.id));
        }
      }
    }

    return { processed: paid.length };
  }
);

/**
 * Reconciliation cron — catches missed webhooks by polling the provider for
 * PENDING charges that are older than 10 minutes. If the provider says the
 * charge was paid or expired, applies the same transition the webhook would
 * have (idempotent via the status guards in `canChargeBePaid` etc.).
 *
 * Runs every 30 minutes (registered in crons.ts).
 *
 * `reconcileCharges` is a privateAction because it needs `ctx.runAction` to
 * call the provider's REST API via the Node runtime. The ORM query that
 * finds stale charges is split into `findStaleChargesForReconciliation`
 * (privateMutation) so it can use `ctx.orm`.
 */
export const findStaleChargesForReconciliation = privateMutation.mutation(
  async ({ ctx }) => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const pending = await ctx.orm.query.paymentCharge.findMany({
      limit: 50,
      where: { status: "PENDING" },
    });
    return pending
      .filter((charge) => charge.createdAt < tenMinutesAgo)
      .map((charge) => ({
        correlationId: charge.correlationId,
        status: charge.status,
      }));
  }
);

export const reconcileCharges = privateAction.action(async ({ ctx }) => {
  if (getEnv().DEPLOY_ENV !== "production") {
    return { reconciled: 0 };
  }

  const stale = await ctx.runMutation(
    internal.payment.charge.findStaleChargesForReconciliation,
    {}
  );

  let reconciled = 0;
  for (const charge of stale) {
    try {
      const result = await ctx.runAction(
        internal.payment.providerNode.getChargeStatusAction,
        { correlationId: charge.correlationId }
      );
      const normalizedStatus = normalizeProviderStatus(result.status);

      if (normalizedStatus === "PAID") {
        await ctx.runMutation(internal.payment.charge.applyPaidCharge, {
          correlationId: charge.correlationId,
        });
        reconciled++;
      } else if (normalizedStatus === "EXPIRED") {
        await ctx.runMutation(internal.payment.charge.markChargeExpired, {
          correlationId: charge.correlationId,
        });
        reconciled++;
      }
    } catch (error) {
      // Provider call failed (rate limit, network, etc.) — skip this charge
      // and try again on the next cron run. Don't crash the whole sweep.
      console.warn(
        `[reconcileCharges] failed for ${charge.correlationId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return { reconciled };
});

function buildCorrelationId(args: {
  sourceId: string;
  sourceType: string;
  timestamp: number;
}): string {
  return `bropen:${args.sourceType}:${args.sourceId}:${args.timestamp}`;
}

function asciiSafe(value: string): string {
  return Array.from(value.normalize("NFKD"))
    .filter((ch) => ch.codePointAt(0)! <= 0x7f)
    .join("");
}

// ---------------------------------------------------------------------------
// DEV ONLY: simulate a PIX payment for testing checkout flow.
// Calls applyPaidCharge directly, bypassing the webhook. Only callable when
// DEPLOY_ENV !== "production".
// ---------------------------------------------------------------------------

export const simulatePayment = authMutation
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(
    z.object({ activated: z.boolean(), membershipId: z.string().nullable() })
  )
  .mutation(async ({ ctx, input }) => {
    if (getEnv().DEPLOY_ENV === "production") {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Simulação de pagamento desativada em produção.",
      });
    }

    const chargeId = input.chargeId as Id<"paymentCharge">;
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: chargeId },
    });

    if (!charge) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobrança não encontrada.",
      });
    }

    return ctx.runMutation(internal.payment.charge.applyPaidCharge, {
      correlationId: charge.correlationId,
      providerTransactionId: `dev-simulated-${Date.now()}`,
    });
  });
