import { eq, unsetToken } from "kitcn/orm";
import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { isLeaguePaid } from "../../domains/league/membership-rules";
import type { MutationCtx, QueryCtx } from "../generated/server";
import { tournamentEntry } from "../../domains/tournament/tables";
import {
  isRegistrationOpen,
  registrationClosedMessage,
  resolvePaidActivation,
} from "../../domains/tournament/entry-rules";
import { leagueMembership } from "../../domains/league/tables";
import {
  SOURCE_TYPE_LEAGUE_MEMBERSHIP,
  SOURCE_TYPE_TOURNAMENT_ENTRY,
  checkoutContextSchema,
  createChargeOutputSchema,
  listMyPaymentsOutputSchema,
  paymentAccountSchema,
  type CheckoutCharge,
  type CheckoutContext,
  type PaymentChargeStatus,
  type SplitConfig,
} from "../../domains/payment/contract";
import {
  DEFAULT_LEAGUE_APPROVAL_MODE,
  DEFAULT_LEAGUE_GRACE_PERIOD_DAYS,
  DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
  DEFAULT_PLATFORM_FEE_PERCENT,
  LEAGUE_MEMBERSHIP_STATUSES,
} from "../../domains/league/contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  computeSplit,
  computeStackedPeriodEndMs,
  hasUsablePix,
  normalizeProviderStatus,
  ownsPayableSource,
  renewalDaysLeft,
  resolveBillingIntervalMs,
  shouldMarkPaymentDue,
  shouldSendRenewalReminder,
  shouldSuspend,
  wouldExceedLeagueCapacity,
} from "../../domains/payment/rules";
import { paymentCharge } from "../../domains/payment/tables";
import {
  membershipDueMsFromCharge,
  resolveMembershipDueMs,
} from "../../domains/payment/membership-billing";
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
import { buildNotificationContent } from "../../domains/notification/definitions";
import { notificationFeed } from "../../domains/notification/tables";
import { getViewerContext } from "../viewer/context";
import { isActiveActorManager } from "../../domains/auth/actor-context";
import type { NotificationEventType } from "../../shared/notifications/protocol";

// Source type discriminators. The polymorphic pair (sourceType + sourceId)
// identifies what was paid for (league memberships and tournament entries
// today); the webhook/handlers dispatch on it. The constants live in
// `domains/payment/contract.ts` so domain modules that interpret a source
// don't have to import this function file.
const LEAGUE_MEMBERSHIP_SOURCE_ENTITY_TYPE = "leagueMembership";
const RENEWAL_REMINDER_EVENT_TYPE =
  "league.membership.renewal_reminder" as const satisfies NotificationEventType;

// ---------------------------------------------------------------------------
// Charge creation (authAction — calls the provider SDK via a Node action)
// ---------------------------------------------------------------------------

const createChargeInput = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
});

/**
 * Finds a still-valid PENDING charge for a (sourceType, sourceId) pair, owned
 * by the caller. "Still-valid" means status === PENDING and expiresAt is in the
 * future; "owned" means the charge was created for the caller's own player
 * profile (BUG-0022 — reuse must never hand out somebody else's PIX).
 *
 * Called by `createCharge` before hitting the provider API — if a reusable
 * charge exists we return it instead of creating a duplicate.
 */
export const findPendingChargeForSource = privateMutation
  .input(
    z.object({
      sourceId: z.string().min(1),
      sourceType: z.string().min(1),
      userId: z.string().min(1),
    })
  )
  .output(createChargeOutputSchema.nullable())
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    // `userId` arrives as a plain string; the column is an Id (same cast the
    // other procedures in this file do).
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: input.userId as Id<"user"> },
    });
    if (!profile) {
      return null;
    }

    const charge = await ctx.orm.query.paymentCharge.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        status: "PENDING",
      },
    });

    // No pending charge, it belongs to another player, or it has already
    // expired — caller should create a new one.
    if (
      !(
        charge &&
        ownsPayableSource({
          callerProfileId: profile.id,
          ownerProfileId: charge.playerProfileId,
        }) &&
        hasUsablePix({ charge, nowMs: now.getTime() })
      )
    ) {
      return null;
    }

    return {
      brCode: charge.brCode ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
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

    if (!(charge && hasUsablePix({ charge, nowMs: now.getTime() }))) {
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

    // Reuse an existing PENDING charge if it's still valid (not expired) AND it
    // belongs to the caller. This prevents duplicate charges when the player
    // taps "pay" multiple times, and makes the "resume checkout" path instant
    // (no provider call).
    const existing = await ctx.runMutation(
      internal.payment.charge.findPendingChargeForSource,
      { sourceId, sourceType, userId: ctx.userId }
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
    // Live membership state (IBX-0040): an old notification link can point at a
    // charge that is PAID while the membership is back to `payment_due` or
    // `suspended`, so the screen must not read the billing situation from the
    // charge's historical status. Non-membership sources report nulls.
    const membershipState =
      charge.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP
        ? await resolveMembershipCheckoutState(ctx, charge.sourceId)
        : null;

    // Live obligation of the source (BUG-0025): the caller may already have a
    // new PENDING PIX for this source while the link still points at a terminal
    // charge. Resolved generically (every source type) and read-only.
    const pendingCharge = await resolvePendingCheckoutCharge(ctx, {
      nowMs: Date.now(),
      playerProfileId: charge.playerProfileId as Id<"playerProfile">,
      sourceId: charge.sourceId,
      sourceType: charge.sourceType,
    });

    return {
      amountCents: charge.amountCents,
      brCode: charge.brCode ?? "",
      canRenew: membershipState?.canRenew ?? false,
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      membershipDueAt: membershipState?.membershipDueAt ?? null,
      membershipStatus: membershipState?.membershipStatus ?? null,
      pendingCharge,
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
    // Resolve membership chargeability so the UI can hide "Gerar novo Pix" when
    // the source (e.g. a cancelled join request) can no longer be charged.
    const membershipIds = [
      ...new Set(
        charges
          .filter((c) => c.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP)
          .map((c) => c.sourceId as Id<"leagueMembership">)
      ),
    ];
    const memberships = await Promise.all(
      membershipIds.map((id) =>
        ctx.orm.query.leagueMembership.findFirst({ where: { id } })
      )
    );
    const membershipById = new Map(
      memberships
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .map((m) => [m.id, m])
    );

    // Renewal context (IBX-0039): an `active` membership can only be charged
    // once the league's renewal window opens, so the hub resolves each
    // membership's current due date the same way the checkout does. The cycle
    // end comes from the charges already loaded above (no extra read) and the
    // leagues are fetched in a single query.
    const leagueIds = [
      ...new Set(
        memberships
          .filter((m): m is NonNullable<typeof m> => m !== null)
          .map((m) => m.leagueId as Id<"league">)
      ),
    ];
    const leagues = leagueIds.length
      ? await ctx.orm.query.league.findMany({
          limit: 100,
          where: { id: { in: leagueIds } },
        })
      : [];
    const leagueById = new Map(leagues.map((record) => [record.id, record]));
    const latestPaidChargeByMembership = new Map<
      string,
      (typeof charges)[number]
    >();
    for (const charge of charges) {
      if (
        charge.sourceType !== SOURCE_TYPE_LEAGUE_MEMBERSHIP ||
        charge.status !== "PAID"
      ) {
        continue;
      }
      const current = latestPaidChargeByMembership.get(charge.sourceId);
      if (
        !current ||
        (charge.paidAt?.getTime() ?? 0) > (current.paidAt?.getTime() ?? 0)
      ) {
        latestPaidChargeByMembership.set(charge.sourceId, charge);
      }
    }
    const nowMs = Date.now();

    const items = charges.map((charge) => {
      const membership =
        charge.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP
          ? membershipById.get(charge.sourceId as Id<"leagueMembership">)
          : undefined;
      const league = membership
        ? leagueById.get(membership.leagueId as Id<"league">)
        : undefined;
      const nextDueMs =
        membership?.status === LEAGUE_MEMBERSHIP_STATUSES.ACTIVE
          ? membershipDueMsFromCharge({
              charge: latestPaidChargeByMembership.get(membership.id),
              intervalMs: resolveBillingIntervalMs(
                league?.priceBillingInterval
              ),
            })
          : null;
      const renewal =
        nextDueMs === null
          ? null
          : {
              nextDueMs,
              nowMs,
              reminderDaysBefore:
                league?.reminderDaysBefore ??
                DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
            };
      const canRegenerate = Boolean(
        membership && canMembershipBeCharged(membership, renewal)
      );

      return {
        amountCents: charge.amountCents,
        canRegenerate,
        chargeId: charge.id as Id<"paymentCharge">,
        expiresAt: charge.expiresAt?.toISOString() ?? null,
        paidAt: charge.paidAt?.toISOString() ?? null,
        sourceId: charge.sourceId,
        sourceLabel: charge.sourceLabel ?? null,
        sourceType: charge.sourceType,
        status: (charge.status as PaymentChargeStatus) ?? "PENDING",
      };
    });

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

    if (account?.status !== "active") {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Esta liga ainda nao esta recebendo pagamentos. O organizador precisa conectar a conta.",
      });
    }

    return {
      name: account.name,
      pixKey: account.pixKey,
      status: account.status,
    };
  });

/**
 * Resolves a payable source into the data needed to create a charge
 * (amount, human label, owning org, player profile).
 *
 * Polymorphic over `sourceType` + `sourceId`: `league_membership` (sourceId is
 * a `leagueMembership` id) and `tournament_entry` (a `tournamentEntry` id).
 * Other source types throw NOT_FOUND until a handler is added. Ownership is
 * enforced per branch: only the player who owns the source can be charged
 * (BUG-0022).
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
    // Ownership (BUG-0022): the caller must own the source. One lookup serves
    // both branches — a caller without a player profile owns nothing.
    // (`userId` arrives as a plain string; the column is an Id.)
    const callerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: input.userId as Id<"user"> },
    });

    if (input.sourceType === SOURCE_TYPE_TOURNAMENT_ENTRY) {
      return resolveTournamentEntrySource(
        ctx,
        input.sourceId,
        callerProfile?.id
      );
    }

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

    if (
      !ownsPayableSource({
        callerProfileId: callerProfile?.id,
        ownerProfileId: membership.playerProfileId,
      })
    ) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa cobranca nao pertence a voce.",
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

    // Early renewal (IBX-0039): an `active` membership becomes chargeable once
    // the league renewal window opens, so the next period can be paid before
    // the current one lapses. The paid period stacks on the current due date.
    const nextDueMs = await resolveMembershipDueMs(ctx, {
      membershipId,
      priceBillingInterval: currentLeague.priceBillingInterval,
    });
    const renewal =
      nextDueMs === null
        ? null
        : {
            nextDueMs,
            nowMs: Date.now(),
            reminderDaysBefore:
              currentLeague.reminderDaysBefore ??
              DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
          };

    if (!canMembershipBeCharged(membership, renewal)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          membership.status === LEAGUE_MEMBERSHIP_STATUSES.ACTIVE
            ? "A renovacao desta liga ainda nao esta aberta."
            : "Esta solicitacao nao esta aguardando pagamento.",
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
 * Tournament entry source resolution: entry must be awaiting payment,
 * INSIDE the registration window (same single source as the entry
 * mutations — IBX-0067 review MEDIUM-2: a closed tournament must not mint
 * a PIX at all) and belong to a priced category. The payer is the entry
 * creator (`playerAId`); the amount is the category's entry fee (one
 * charge per entry, not per player).
 *
 * Only the payer may be charged (BUG-0022): `callerProfileId` must be the
 * entry's `playerAId`. The app only offers the pay button to that player.
 */
async function resolveTournamentEntrySource(
  ctx: MutationCtx,
  sourceId: string,
  callerProfileId: null | string | undefined
) {
  const entry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { id: sourceId as Id<"tournamentEntry"> },
  });
  if (!entry) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Inscrição não encontrada.",
    });
  }
  if (
    !ownsPayableSource({
      callerProfileId,
      ownerProfileId: entry.playerAId,
    })
  ) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Essa cobranca nao pertence a voce.",
    });
  }
  if (entry.status !== "awaiting_payment") {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Essa inscrição não está aguardando pagamento.",
    });
  }

  const category = await ctx.orm.query.tournamentCategory.findFirst({
    where: { id: entry.categoryId as Id<"tournamentCategory"> },
  });
  if (!category) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Categoria não encontrada.",
    });
  }
  const tournamentRecord = await ctx.orm.query.tournament.findFirst({
    where: { id: category.tournamentId as Id<"tournament"> },
  });
  if (!tournamentRecord) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Torneio não encontrado.",
    });
  }

  const window = {
    nowMs: Date.now(),
    registrationDeadlineMs: tournamentRecord.registrationDeadlineAt.getTime(),
    status: tournamentRecord.status,
  };
  if (!isRegistrationOpen(window)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: registrationClosedMessage(window),
    });
  }

  const playerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { id: entry.playerAId as Id<"playerProfile"> },
  });

  return {
    amountCents: category.entryFeeCents,
    organizationId: tournamentRecord.organizationId as string,
    platformFeePercent:
      tournamentRecord.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT,
    playerProfileId: (playerProfile?.id ?? entry.playerAId) as string,
    sourceLabel: `${tournamentRecord.name} — ${category.displayName}`,
  };
}

/**
 * Live obligation of a source for the caller (BUG-0025): the newest PENDING
 * charge that still carries a usable PIX, or null when there is none.
 *
 * A notification link can carry a terminal charge (the PIX it pointed at
 * expired) while a newer PIX is open for the same source; the checkout must
 * render THAT one instead of the historical state.
 *
 * Read-only — opening the checkout never creates a charge. Ownership comes from
 * the caller's own player profile id (BUG-0022), the very profile whose charge
 * the link carries and which `getCheckoutContext` already verified against the
 * viewer, so this can only ever return the caller's own PIX. The pair
 * (sourceType, sourceId) is resolved generically, for every payable source.
 *
 * `hasUsablePix` is the same rule `createCharge` goes through to decide whether
 * an existing charge is reusable, so the PIX on screen is the one the "Gerar
 * novo Pix" CTA would hand back.
 */
async function resolvePendingCheckoutCharge(
  ctx: Pick<QueryCtx, "orm">,
  args: {
    nowMs: number;
    playerProfileId: Id<"playerProfile">;
    sourceId: string;
    sourceType: string;
  }
) {
  const charge = await ctx.orm.query.paymentCharge.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      playerProfileId: args.playerProfileId,
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      status: "PENDING",
    },
  });

  if (!(charge && hasUsablePix({ charge, nowMs: args.nowMs }))) {
    return null;
  }

  return {
    amountCents: charge.amountCents,
    brCode: charge.brCode ?? "",
    chargeId: charge.id as string,
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    qrCodeUrl: charge.qrCodeImage ?? "",
    status: charge.status as PaymentChargeStatus,
  } satisfies CheckoutCharge;
}

/**
 * Current billing state of a league membership, resolved fresh from the
 * membership and its league — never from a charge's historical status
 * (IBX-0040).
 *
 * `membershipDueAt` comes from `resolveMembershipDueMs` (the same source the
 * renewal cron uses) and `canRenew` is `canMembershipBeCharged` fed with the
 * league renewal window, which is exactly the signal `listMine.canRegenerate`
 * publishes. Null when the membership or its league is gone.
 */
async function resolveMembershipCheckoutState(
  ctx: Pick<QueryCtx, "orm">,
  membershipId: string
): Promise<{
  canRenew: boolean;
  membershipDueAt: null | number;
  membershipStatus: string;
} | null> {
  const membership = await ctx.orm.query.leagueMembership.findFirst({
    where: { id: membershipId as Id<"leagueMembership"> },
  });
  if (!membership) {
    return null;
  }

  const league = await ctx.orm.query.league.findFirst({
    where: { id: membership.leagueId as Id<"league"> },
  });
  if (!league) {
    return null;
  }

  const dueMs = await resolveMembershipDueMs(ctx, {
    membershipId,
    priceBillingInterval: league.priceBillingInterval,
  });

  return {
    canRenew: canMembershipBeCharged(
      membership,
      dueMs === null
        ? null
        : {
            nextDueMs: dueMs,
            nowMs: Date.now(),
            reminderDaysBefore:
              league.reminderDaysBefore ?? DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
          }
    ),
    membershipDueAt: dueMs,
    membershipStatus: membership.status,
  };
}

/**
 * Membership, its league and the due date of the cycle it currently pays for,
 * resolved while a new charge for it is still PENDING.
 *
 * That due date is the base the next period stacks on (IBX-0039) and the key
 * of the notification cycle. Null when the membership or its league is gone.
 */
async function resolveMembershipCycle(
  ctx: MutationCtx,
  membershipId: Id<"leagueMembership">
) {
  const membership = await ctx.orm.query.leagueMembership.findFirst({
    where: { id: membershipId },
  });
  if (!membership) {
    return null;
  }

  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: membership.leagueId as Id<"league"> },
  });
  if (!currentLeague) {
    return null;
  }

  return {
    dueMs: await resolveMembershipDueMs(ctx, {
      membershipId,
      priceBillingInterval: currentLeague.priceBillingInterval,
    }),
    league: currentLeague,
    membership,
  };
}

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
    const isMembershipCharge =
      charge.sourceType === SOURCE_TYPE_LEAGUE_MEMBERSHIP;
    const membershipId = isMembershipCharge
      ? (charge.sourceId as Id<"leagueMembership">)
      : null;

    // Resolve the cycle this charge must stack on BEFORE marking it PAID: the
    // due date the member already paid for comes from the latest PAID charge of
    // the membership, so it has to be read while this one is still PENDING
    // (which also makes the computation idempotent).
    const previousCycle =
      membershipId === null
        ? null
        : await resolveMembershipCycle(ctx, membershipId);

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

    // Dispatch on source type: league_membership and tournament_entry have
    // side effects; other sources leave the charge PAID for a reconciler.
    if (charge.sourceType === SOURCE_TYPE_TOURNAMENT_ENTRY) {
      return applyPaidTournamentEntryCharge(ctx, charge);
    }

    if (!(membershipId && previousCycle)) {
      return { activated: false, membershipId };
    }

    const {
      dueMs: currentDueMs,
      league: currentLeague,
      membership,
    } = previousCycle;

    // Step 2: the membership must accept this payment. `active` is accepted
    // while the league renewal window is open (IBX-0039 early renewal).
    const renewal =
      currentDueMs === null
        ? null
        : {
            nextDueMs: currentDueMs,
            nowMs: now.getTime(),
            reminderDaysBefore:
              currentLeague.reminderDaysBefore ??
              DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
          };

    if (!canMembershipBeCharged(membership, renewal)) {
      // Charge is PAID but membership is not in a chargeable state — leave
      // it; a reconciler (future) can recover. Avoid reverting the charge.
      return { activated: false, membershipId };
    }

    // Step 2b: is this a renewal of a membership that already holds a slot?
    // Decided before the capacity check, which must not treat it as a new
    // occupant (BUG-0023).
    const isEarlyRenewal =
      membership.status === LEAGUE_MEMBERSHIP_STATUSES.ACTIVE;

    // Step 3: capacity re-check (over-enrollment guard).
    // The guard exists to stop a NEW member from entering a full league, and the
    // membership being charged is never counted as a new occupant — see
    // `wouldExceedLeagueCapacity` (BUG-0023: a renewal that skipped this used to
    // be refunded and dropped to `left`, losing the member's own slot).
    const { maxPlayers } = currentLeague;
    if (maxPlayers !== null && maxPlayers !== undefined) {
      const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
        limit: 500,
        where: {
          leagueId: membership.leagueId as Id<"league">,
          status: "active",
        },
      });
      const otherActiveMembers = activeMemberships.filter(
        (candidate) => candidate.id !== membershipId
      ).length;
      if (
        wouldExceedLeagueCapacity({
          isRenewal: isEarlyRenewal,
          maxPlayers,
          otherActiveMembers,
        })
      ) {
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
    // Early renewal (IBX-0039): a member who is already `active` keeps that
    // status — the manual approval gate is for the initial join, and demoting a
    // paying member to `pending` would cut their access mid-cycle.
    const requiresManualApproval = approvalMode === "manual" && !isEarlyRenewal;

    await ctx.orm
      .update(leagueMembership)
      .set({
        reviewedAt: requiresManualApproval ? null : now,
        status: requiresManualApproval ? "pending" : "active",
        updatedAt: now,
      })
      .where(eq(leagueMembership.id, membershipId));

    // Step 4b: stamp the end of the period this charge bought. Renewing inside
    // the window stacks on the due date already paid for instead of restarting
    // from `paidAt`; one-time leagues (`once`) never get a cycle end.
    const intervalMs = resolveBillingIntervalMs(
      currentLeague.priceBillingInterval
    );
    if (Number.isFinite(intervalMs)) {
      await ctx.orm
        .update(paymentCharge)
        .set({
          periodEndAt: new Date(
            computeStackedPeriodEndMs({
              currentDueMs,
              intervalMs,
              paidAtMs: now.getTime(),
            })
          ),
          updatedAt: now,
        })
        .where(eq(paymentCharge.id, charge.id));
    }

    // The cycle the member was reminded about is over (paid, or renewed early):
    // retire the live reminder so the next cycle starts a fresh one (IBX-0039).
    await retractMembershipRenewalReminders(ctx, membershipId);

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

/**
 * Paid tournament entry charge → entry active (payment is the only gate in
 * approvalMode auto; in manual, the entry already passed approval before
 * checkout). Notifies creator + partner with `tournament.entry.confirmed`.
 */
async function applyPaidTournamentEntryCharge(
  ctx: MutationCtx,
  charge: InferSelectModel<typeof paymentCharge>
) {
  const entryId = charge.sourceId as Id<"tournamentEntry">;
  const entry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { id: entryId },
  });
  if (!(entry && entry.status === "awaiting_payment")) {
    // Charge PAID but entry no longer awaiting — reconciler territory.
    return { activated: false, membershipId: null };
  }

  const category = await ctx.orm.query.tournamentCategory.findFirst({
    where: { id: entry.categoryId as Id<"tournamentCategory"> },
  });
  const tournamentRecord = category
    ? await ctx.orm.query.tournament.findFirst({
        where: { id: category.tournamentId as Id<"tournament"> },
      })
    : null;
  if (!(category && tournamentRecord)) {
    return { activated: false, membershipId: null };
  }

  // M1 (IBX-0067): the charge only activates an entry while REGISTRATIONS
  // ARE OPEN — published or drawn, before the deadline. If the window
  // closed between checkout and the webhook (race), the money must come
  // back — mark refund-pending and hand off to the refund action; it never
  // stays trapped in a dead entry.
  if (
    !isRegistrationOpen({
      nowMs: Date.now(),
      registrationDeadlineMs: tournamentRecord.registrationDeadlineAt.getTime(),
      status: tournamentRecord.status,
    })
  ) {
    const refundAt = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set({ refundStatus: "pending", updatedAt: refundAt })
      .where(eq(paymentCharge.id, charge.id as Id<"paymentCharge">));
    await ctx.scheduler.runAfter(
      0,
      internal.tournament.lifecycle.processRefunds,
      { tournamentId: tournamentRecord.id as string }
    );
    return { activated: false, membershipId: null };
  }

  const now = new Date();
  // IBX-0067 review HIGH-1: the paid activation is the LAST capacity gate —
  // counting ACTIVE entries only (awaiting_payment never reserves a slot).
  // An overflowing payment follows the M1 pattern: entry cancelled, charge
  // refund-pending, the proven refund pipeline, and a notice to the payer
  // that the category filled up and the money is coming back.
  const activeEntries = await ctx.orm.query.tournamentEntry.findMany({
    limit: 300,
    where: {
      categoryId: entry.categoryId as Id<"tournamentCategory">,
      status: "active",
    },
  });
  if (
    resolvePaidActivation({
      activeCount: activeEntries.length,
      maxEntries: category.maxEntries,
    }) === "refund"
  ) {
    // Cancelled by the paid-activation overflow = terminal entry: free the
    // category slots (IBX-0074 r19).
    await ctx.orm
      .update(tournamentEntry)
      .set({
        activeAId: unsetToken,
        activeBId: unsetToken,
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(tournamentEntry.id, entryId));
    await ctx.orm
      .update(paymentCharge)
      .set({ refundStatus: "pending", updatedAt: now })
      .where(eq(paymentCharge.id, charge.id as Id<"paymentCharge">));
    await ctx.scheduler.runAfter(
      0,
      internal.tournament.lifecycle.processRefunds,
      { tournamentId: tournamentRecord.id as string }
    );
    if (entry.createdByUserId) {
      await ctx.scheduler.runAfter(
        0,
        internal.notification.orchestrator.createForRecipients,
        {
          actorUserId: null,
          eventType: "tournament.entry.refund_requested",
          metadata: { reason: "category_full" },
          recipientUserIds: [entry.createdByUserId as Id<"user">],
          sourceEntityId: entryId,
          sourceEntityType: "tournamentEntry",
          tournamentId: tournamentRecord.id,
        }
      );
    }
    return { activated: false, membershipId: null };
  }
  await ctx.orm
    .update(tournamentEntry)
    .set({ status: "active", updatedAt: now })
    .where(eq(tournamentEntry.id, entryId));

  // IBX-0067: payment confirmation is one of the four ACTIVE transitions —
  // the entry joins its category bracket at once (incremental placement).
  await ctx.runMutation(internal.tournament.placement.placeActiveEntry, {
    categoryId: entry.categoryId as string,
    entryId: entryId as string,
  });

  const recipients = [
    ...(entry.createdByUserId ? [entry.createdByUserId as Id<"user">] : []),
    ...(entry.partnerUserId ? [entry.partnerUserId as Id<"user">] : []),
  ];
  if (recipients.length > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.notification.orchestrator.createForRecipients,
      {
        actorUserId: null,
        eventType: "tournament.entry.confirmed",
        metadata: { chargeId: charge.id },
        recipientUserIds: recipients,
        sourceEntityId: entryId,
        sourceEntityType: "tournamentEntry",
        tournamentId: tournamentRecord.id,
      }
    );
  }

  return { activated: true, membershipId: null };
}

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
            // No `chargeId`: the expired charge is gone and there is no PENDING
            // one at this point, so the deep link falls back to the league
            // (where the player generates a new PIX). IBX-0039 / C4.
            metadata: { membershipId: charge.sourceId },
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
// Renewal reminder lifecycle (IBX-0039)
//
// Exactly ONE live feed row per (membership, billing cycle). The daily cron
// rewrites that row with the real days left instead of pushing a new
// notification every day, so the unread counter never grows; the row is
// retracted when the cycle closes (paid, due or suspended).
// ---------------------------------------------------------------------------

type RenewalReminderRow = InferSelectModel<typeof notificationFeed>;

/** Billing cycle a reminder row belongs to (`cycleEndMs` in its metadata). */
function readReminderCycleEndMs(row: RenewalReminderRow): number | null {
  const { cycleEndMs } = row.data;
  return typeof cycleEndMs === "number" ? cycleEndMs : null;
}

/** Live (non-retracted) renewal reminders of a membership. */
async function findLiveRenewalReminders(
  ctx: MutationCtx,
  membershipId: string
): Promise<RenewalReminderRow[]> {
  // Uses the `sourceEntity` index on (sourceEntityType, sourceEntityId), so the
  // window only holds this membership's notifications; retracted cycles are
  // filtered out below.
  const rows = await ctx.orm.query.notificationFeed.findMany({
    limit: 100,
    where: {
      sourceEntityId: membershipId,
      sourceEntityType: LEAGUE_MEMBERSHIP_SOURCE_ENTITY_TYPE,
    },
  });
  return rows.filter(
    (row) =>
      row.eventType === RENEWAL_REMINDER_EVENT_TYPE &&
      row.status !== "retracted"
  );
}

/** Retires every live renewal reminder of a membership. */
async function retractMembershipRenewalReminders(
  ctx: MutationCtx,
  membershipId: string
): Promise<void> {
  await ctx.runMutation(
    internal.notification.orchestrator.retractNotifications,
    {
      eventTypes: [RENEWAL_REMINDER_EVENT_TYPE],
      sourceEntityId: membershipId,
      sourceEntityType: LEAGUE_MEMBERSHIP_SOURCE_ENTITY_TYPE,
    }
  );
}

/**
 * Creates or refreshes the cycle's single reminder.
 *
 * Refreshing rewrites title/body/data (the days left) and `occurredAt`, and
 * deliberately leaves `isRead` alone: an update is not a new unread
 * notification and creates no delivery, so no push is sent again.
 */
async function upsertRenewalReminder(
  ctx: MutationCtx,
  args: {
    cycleEndMs: number;
    daysLeft: number;
    leagueId: Id<"league">;
    leagueName: string;
    membershipId: string;
    pendingChargeId: null | string;
    recipientUserId: Id<"user">;
  }
): Promise<void> {
  const metadata = {
    cycleEndMs: args.cycleEndMs,
    daysLeft: args.daysLeft,
    membershipId: args.membershipId,
    ...(args.pendingChargeId ? { chargeId: args.pendingChargeId } : {}),
  };
  const content = buildNotificationContent({
    eventType: RENEWAL_REMINDER_EVENT_TYPE,
    leagueId: args.leagueId,
    leagueName: args.leagueName,
    metadata,
    recipientRole: "player",
  });

  const cycleReminder = (
    await findLiveRenewalReminders(ctx, args.membershipId)
  ).find((row) => readReminderCycleEndMs(row) === args.cycleEndMs);

  if (cycleReminder) {
    await ctx.orm
      .update(notificationFeed)
      .set({
        body: content.body,
        data: content.data,
        occurredAt: new Date(),
        title: content.title,
      })
      .where(eq(notificationFeed.id, cycleReminder.id));
    return;
  }

  // First reminder of this cycle: drop leftovers from previous cycles first so
  // only one reminder stays live, then create it (the only run that delivers a
  // push).
  await retractMembershipRenewalReminders(ctx, args.membershipId);
  await scheduleLeagueNotification(ctx, {
    eventType: RENEWAL_REMINDER_EVENT_TYPE,
    leagueId: args.leagueId,
    metadata,
    recipientUserIds: [args.recipientUserId],
    sourceEntityId: args.membershipId,
    sourceEntityType: LEAGUE_MEMBERSHIP_SOURCE_ENTITY_TYPE,
  });
}

// ---------------------------------------------------------------------------
// Cron entry: renewal timeline with configurable grace period.
//
// The membership's due date is the cycle end snapshotted on its latest PAID
// charge (`periodEndAt`, IBX-0039). Charges created before that column existed
// fall back to paidAt + billingInterval, which is the previous behaviour.
//
//   D-reminderDaysBefore  → one live renewal_reminder per cycle, rewritten
//                           daily with the real days left (no daily push)
//   D-0 (due)             → mark membership payment_due (still playable),
//                           retire the reminder, send payment_due
//   D+gracePeriodDays     → suspend membership + send renewal_due
//
// The cron reads `reminderDaysBefore` and `gracePeriodDays` from the league
// at runtime (not snapshotted) so organizers can adjust after creation.
// ---------------------------------------------------------------------------

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

      const intervalMs = resolveBillingIntervalMs(league.priceBillingInterval);
      if (!Number.isFinite(intervalMs)) {
        continue;
      }

      // Due date of the cycle this charge bought (IBX-0039). Legacy charges
      // (created before `periodEndAt` existed) keep the paidAt + interval
      // estimate that was used before.
      const nextDueMs =
        charge.periodEndAt?.getTime() ?? charge.paidAt.getTime() + intervalMs;

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
      if (shouldSuspend({ gracePeriodDays, nextDueMs, nowMs: now })) {
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

          // The overdue notice supersedes the reminder: retire it so the
          // player keeps a single live billing notice (IBX-0039).
          await retractMembershipRenewalReminders(ctx, membership.id);

          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.renewal_due",
              leagueId: membership.leagueId as Id<"league">,
              // No `chargeId`: there is no PENDING charge at this point, so the
              // deep link points to the league (C4).
              metadata: { membershipId: membership.id },
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

          // The overdue notice supersedes the reminder: retire it so the
          // player keeps a single live billing notice (IBX-0039).
          await retractMembershipRenewalReminders(ctx, membership.id);

          if (playerProfile?.userId) {
            await scheduleLeagueNotification(ctx, {
              eventType: "league.membership.payment_due",
              leagueId: membership.leagueId as Id<"league">,
              // No `chargeId`: renewing opens a fresh checkout on the league,
              // and there is no PENDING charge right now (C4).
              metadata: { membershipId: membership.id },
              recipientUserIds: [playerProfile.userId as Id<"user">],
            });
          }
        }
        continue;
      }

      // --- Phase 1: approaching due date → one live reminder per cycle ---
      if (
        shouldSendRenewalReminder({
          nextDueMs,
          nowMs: now,
          reminderDaysBefore,
        })
      ) {
        // Re-run guard: the per-cycle dedupe is the reminder row itself (it is
        // rewritten, never duplicated), so this only avoids double work when
        // the cron fires twice within a day (e.g. before the previous run's
        // feed row has landed).
        const lastSentMs = membership.lastRenewalReminderSentAt?.getTime() ?? 0;
        if (now - lastSentMs >= REMINDER_DEDUPE_MS) {
          if (playerProfile?.userId) {
            // Deep link target (C4): a PENDING charge when one exists, otherwise
            // the league page — never the PAID charge that opened this cycle.
            const pendingCharge = await ctx.runMutation(
              internal.payment.charge.findPendingChargeForSource,
              {
                sourceId: membership.id,
                sourceType: SOURCE_TYPE_LEAGUE_MEMBERSHIP,
                // The lookup enforces ownership, so it must run as the
                // membership's own player (BUG-0022).
                userId: playerProfile.userId,
              }
            );

            await upsertRenewalReminder(ctx, {
              cycleEndMs: nextDueMs,
              daysLeft: renewalDaysLeft({ nextDueMs, nowMs: now }),
              leagueId: membership.leagueId as Id<"league">,
              leagueName: league.name,
              membershipId: membership.id,
              pendingChargeId: pendingCharge?.chargeId ?? null,
              recipientUserId: playerProfile.userId as Id<"user">,
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

    // Ownership: only the charge owner can simulate its payment.
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: ctx.userId },
    });
    if (
      !profile ||
      charge.playerProfileId !== (profile.id as Id<"playerProfile">)
    ) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para simular este pagamento.",
      });
    }

    return ctx.runMutation(internal.payment.charge.applyPaidCharge, {
      correlationId: charge.correlationId,
      providerTransactionId: `dev-simulated-${Date.now()}`,
    });
  });
