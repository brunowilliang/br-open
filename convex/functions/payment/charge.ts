import { eq, unsetToken } from "kitcn/orm";
import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { MutationCtx, QueryCtx } from "../generated/server";
import { tournamentEntry } from "../../domains/tournament/tables";
import {
  isRegistrationOpen,
  registrationClosedMessage,
  resolvePaidActivation,
} from "../../domains/tournament/entry-rules";
import {
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
  CHARGE_EXPIRES_IN_SECONDS,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  computeSplit,
  DEFAULT_PLATFORM_FEE_PERCENT,
  hasUsablePix,
  normalizeProviderStatus,
  ownsPayableSource,
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
import { getViewerContext } from "../viewer/context";
import { isActiveActorManager } from "../../domains/auth/actor-context";

// Source type discriminators: the (sourceType + sourceId) pair says what was
// paid for and drives the webhook dispatch; the constants live in
// `domains/payment/contract.ts` so domain modules don't import this file.

// Charge creation (authAction — calls the provider SDK via a Node action)

const createChargeInput = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
});

/**
 * Newest still-valid PENDING charge of a (sourceType, sourceId) pair, scoped to
 * the caller's own player profile: reuse must never hand out somebody else's PIX.
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
 * Just the chargeId of a still-valid PENDING charge, or null, so a "pay" CTA
 * navigates straight to /checkout/[chargeId] without creating a charge.
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
    // Ownership: filter by the viewer's profile so ids can't be enumerated.
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

    // Reuse the caller's still-valid PENDING charge: no duplicate on a double
    // tap, and "resume checkout" is instant (no provider call).
    const existing = await ctx.runMutation(
      internal.payment.charge.findPendingChargeForSource,
      { sourceId, sourceType, userId: ctx.userId }
    );
    if (existing) {
      return existing;
    }

    const chargeData = await ctx.runMutation(
      internal.payment.charge.resolveSourceForCharge,
      {
        sourceId,
        sourceType,
        userId: ctx.userId,
      }
    );

    const paymentAccount = await ctx.runMutation(
      internal.payment.charge.resolvePaymentAccount,
      { organizationId: chargeData.organizationId }
    );

    const split = computeSplit({
      amountCents: chargeData.amountCents,
      feePercent: chargeData.platformFeePercent,
      recipientPixKey: paymentAccount.pixKey,
    });

    // Call the provider SDK via a Node action — `providerNode.ts` has "use node",
    // so use ctx.runAction (NOT the kitcn caller): importing that module here
    // would break Convex bundling.
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
          comment: `Inscricao: ${asciiSafe(chargeData.sourceLabel)}`,
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

// Checkout context (re-display a charge's QR code by chargeId)

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
    // Ownership: resolve charge -> playerProfile -> userId against the viewer.
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: charge.playerProfileId as Id<"playerProfile"> },
    });
    if (!profile || profile.userId !== ctx.userId) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobranca nao encontrada.",
      });
    }
    // Never read any obligation state from the charge's historical status: a
    // notification link can point at a terminal charge while a newer PIX is
    // open for the same source.

    // The caller may already have a newer PENDING PIX for this source while the
    // link still points at a terminal charge. Read-only, for every source type.
    const pendingCharge = await resolvePendingCheckoutCharge(ctx, {
      nowMs: Date.now(),
      playerProfileId: charge.playerProfileId as Id<"playerProfile">,
      sourceId: charge.sourceId,
      sourceType: charge.sourceType,
    });

    return {
      amountCents: charge.amountCents,
      brCode: charge.brCode ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      pendingCharge,
      qrCodeUrl: charge.qrCodeImage ?? "",
      sourceId: charge.sourceId,
      sourceLabel: charge.sourceLabel ?? null,
      sourceType: charge.sourceType,
      status: (charge.status as PaymentChargeStatus) ?? "PENDING",
    } satisfies CheckoutContext;
  });

// List the viewer's payments (player-facing payment hub)

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

    // sourceLabel is snapshotted on each charge, so list/history skip a join.
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

// Private mutations (called via the kitcn caller from the webhook + cron)

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

    // Always INSERT: the previous upsert collapsed retries onto one row and hid
    // the per-charge history of "my payments".
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
    // `organization.paymentAccount` is embedded JSON (the old
    // `organizationWooviAccount` table is gone): validate before trusting it.
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
          "Esta organização ainda nao esta recebendo pagamentos. O organizador precisa conectar a conta.",
      });
    }

    return {
      name: account.name,
      pixKey: account.pixKey,
      status: account.status,
    };
  });

/**
 * Payable source -> what a charge needs (amount, label, org, player profile),
 * polymorphic over `sourceType`: `tournament_entry` today; other types throw
 * NOT_FOUND. Ownership is per branch — only the player who owns the source can
 * be charged.
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
    // Ownership: a caller without a player profile owns nothing (`userId` is a
    // plain string; the column is an Id).
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

    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Tipo de cobranca nao suportado.",
    });
  });

/**
 * Tournament entry source: the entry must be awaiting payment, INSIDE the
 * registration window (a closed tournament must not mint a PIX at all) and
 * belong to a priced category. The payer is the entry creator (`playerAId`), so
 * `callerProfileId` must be that id and the fee is per entry, not per player.
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
 * The source's live obligation: newest PENDING charge that still carries a
 * usable PIX, else null. A notification link can carry a terminal charge (its
 * PIX expired) while a newer PIX is open for the same source, and the checkout
 * must render THAT one — never the historical state. Read-only, and always
 * scoped to the caller's own profile via `hasUsablePix`, the same rule
 * `createCharge` uses to decide a charge is reusable.
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
 * Atomic "charge paid → apply source side effect" pipeline: the webhook calls
 * this ONE mutation because the previous two transactions (`markChargePaid` →
 * activation) could leave a charge PAID with the source still pending. The side
 * effect runs per source type; other sources stay PAID for a reconciler.
 * `providerTransactionId` is the PIX e2e id
 * (`payload.transaction.transactionID` / `e2eId`), distinct from the charge id.
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
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { correlationId: input.correlationId },
    });

    if (!(charge && canChargeBePaid(charge))) {
      return { activated: false };
    }

    const now = new Date();

    // Mark PAID, keeping the `providerChargeId` captured at creation.
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

    if (charge.sourceType === SOURCE_TYPE_TOURNAMENT_ENTRY) {
      return applyPaidTournamentEntryCharge(ctx, charge);
    }

    return { activated: false };
  });

/**
 * Paid entry charge -> entry active (payment is the only gate in `auto`; in
 * `manual` the entry already passed approval). Notifies creator + partner.
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
    return { activated: false };
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
    return { activated: false };
  }

  // The charge only activates an entry while REGISTRATIONS ARE OPEN. If the
  // window closed between checkout and the webhook the money must come back —
  // refund-pending plus the refund action; never trapped in a dead entry.
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
    return { activated: false };
  }

  const now = new Date();
  // The paid activation is the LAST capacity gate, counting ACTIVE entries only
  // (`awaiting_payment` never reserves a slot). An overflowing payment follows
  // the window-race path above: entry cancelled, charge refund-pending, and a
  // notice to the payer that the category filled up and the money is coming back.
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
    // Cancelled by the paid-activation overflow = terminal entry: free the slots.
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
    return { activated: false };
  }
  await ctx.orm
    .update(tournamentEntry)
    .set({ status: "active", updatedAt: now })
    .where(eq(tournamentEntry.id, entryId));

  // One of the four ACTIVE transitions: the entry joins its bracket at once.
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

  return { activated: true };
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

/**
 * Catches missed webhooks by polling the provider for PENDING charges older than
 * 10 minutes and applying the transition the webhook would have (idempotent via
 * the status guards in `canChargeBePaid` etc.). A privateAction because it needs
 * the Node runtime to reach the provider's REST API; the query that finds stale
 * charges is split into `findStaleChargesForReconciliation` so it can use `ctx.orm`.
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
      // Provider call failed (rate limit, network, …): skip this charge and try
      // again on the next cron run rather than crashing the whole sweep.
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

// DEV ONLY: simulate a PIX payment by calling applyPaidCharge directly, with no
// webhook. Throws unless DEPLOY_ENV !== "production".

export const simulatePayment = authMutation
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(z.object({ activated: z.boolean() }))
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
