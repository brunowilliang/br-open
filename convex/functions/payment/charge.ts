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
  type CreateChargeOutput,
  type PaymentChargeStatus,
  type SplitConfig,
} from "../../domains/payment/contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  CHARGE_CANCEL_CONFIRMED,
  CHARGE_CANCEL_FAILED,
  CHARGE_CANCEL_PENDING,
  CHARGE_REFUNDED_FIELDS,
  CHARGE_STATUS_CANCELED,
  CHARGE_STATUS_EXPIRED,
  CHARGE_STATUS_FAILED,
  CHARGE_STATUS_PAID,
  CHARGE_STATUS_PENDING,
  canChargeBeCanceled,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canRequestRefund,
  computeSplit,
  DEFAULT_PLATFORM_FEE_PERCENT,
  hasUsablePix,
  normalizeProviderStatus,
  ownsPayableSource,
  shouldRefundLatePayment,
} from "../../domains/payment/rules";
import {
  PROVIDER_PROBE_UNREACHABLE,
  resolveChargeCancellationOutcome,
  toProviderCancelProbe,
  type CancelProbeStatus,
} from "../../domains/payment/cancel-rules";
import { shouldReconcileCharge } from "../../domains/payment/reconcile-rules";
import { resolveCheckoutSourceIdentity } from "../../domains/payment/checkout-source";
import { paymentCharge } from "../../domains/payment/tables";
import { getEnv } from "../../lib/get-env";
import {
  authAction,
  authMutation,
  authQuery,
  privateAction,
  privateMutation,
  privateQuery,
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
 * PENDING utilizavel do par (sourceType, sourceId) para o MESMO dono. Chamada
 * antes de falar com o provedor e de novo na mutation do insert: dois runtimes
 * (2o device, app restaurado) nao podem deixar duas cobrancas vivas para a
 * mesma inscricao.
 */
async function findReusablePendingCharge(
  ctx: Pick<MutationCtx, "orm">,
  args: {
    nowMs: number;
    playerProfileId: string;
    sourceId: string;
    sourceType: string;
  }
) {
  const charge = await ctx.orm.query.paymentCharge.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      status: CHARGE_STATUS_PENDING,
    },
  });

  return charge &&
    ownsPayableSource({
      callerProfileId: args.playerProfileId,
      ownerProfileId: charge.playerProfileId,
    }) &&
    hasUsablePix({ charge, nowMs: args.nowMs })
    ? charge
    : null;
}

/** Projecao do PIX que o app consome (criacao e reuso falam a mesma lingua). */
function toChargeOutput(charge: {
  brCode: null | string;
  expiresAt: null | Date;
  id: string;
  qrCodeImage: null | string;
  status: string;
}): CreateChargeOutput {
  return {
    brCode: charge.brCode ?? "",
    chargeId: charge.id,
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    qrCodeUrl: charge.qrCodeImage ?? "",
    status: charge.status as PaymentChargeStatus,
  };
}

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
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: input.userId as Id<"user"> },
    });
    if (!profile) {
      return null;
    }

    const charge = await findReusablePendingCharge(ctx, {
      nowMs: Date.now(),
      playerProfileId: profile.id,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    });

    return charge ? toChargeOutput(charge) : null;
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

    if (savedCharge.reused) {
      // Outro runtime (2o device) venceu a corrida entre o reuso e o POST: a
      // copia nasceu CANCELED e ja esta no DELETE agendado.
      console.warn(
        `[createCharge] PIX orfao cancelado em ${sourceType}:${sourceId} (reusando ${savedCharge.charge.chargeId})`
      );
    }

    return savedCharge.charge;
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

    const source = await loadCheckoutSourceIdentity(ctx, charge);

    return {
      amountCents: charge.amountCents,
      brCode: charge.brCode ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      pendingCharge,
      qrCodeUrl: charge.qrCodeImage ?? "",
      sourceCategory: source.category,
      sourceId: charge.sourceId,
      sourceLabel: source.label,
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
  .output(z.object({ charge: createChargeOutputSchema, reused: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(Date.now() + CHARGE_EXPIRES_IN_SECONDS * 1000);

    // Decide-e-insere na MESMA transacao: se outro runtime ja deixou um PIX vivo
    // para este source, esta cobranca nasce MORTA (nunca reusavel nem pagavel) e
    // o DELETE agendado mata o PIX recem-criado — o POST ao provedor nao cabe na
    // transacao, entao esta copia precisa ser cancelada como qualquer outra.
    const duplicate = await findReusablePendingCharge(ctx, {
      nowMs: now.getTime(),
      playerProfileId: input.playerProfileId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    });

    // Always INSERT (o historico de "meus pagamentos" e por charge): o reuso
    // devolve a linha viva e esta fica como registro do PIX descartado.
    const row = (
      await ctx.orm
        .insert(paymentCharge)
        .values({
          amountCents: input.amountCents,
          brCode: input.brCode,
          cancelStatus: duplicate ? CHARGE_CANCEL_PENDING : null,
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
          status: duplicate ? CHARGE_STATUS_CANCELED : input.status,
          updatedAt: now,
        })
        .returning()
    )[0];

    if (duplicate) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment.charge.processChargeCancellation,
        { chargeId: row.id as string }
      );
    }

    return {
      charge: toChargeOutput(duplicate ?? row),
      reused: Boolean(duplicate),
    };
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

/** Tres leituras pontuais (entry -> categoria -> torneio) para o titulo vivo do
 * checkout; salto faltando devolve o par nulo. */
async function loadCheckoutSourceIdentity(
  ctx: Pick<QueryCtx, "orm">,
  charge: { sourceId: string; sourceLabel: null | string; sourceType: string }
) {
  if (charge.sourceType !== SOURCE_TYPE_TOURNAMENT_ENTRY) {
    return resolveCheckoutSourceIdentity({
      category: null,
      snapshotLabel: charge.sourceLabel,
      sourceType: charge.sourceType,
      tournament: null,
    });
  }

  const entry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { id: charge.sourceId as Id<"tournamentEntry"> },
  });
  const category = entry
    ? await ctx.orm.query.tournamentCategory.findFirst({
        where: { id: entry.categoryId as Id<"tournamentCategory"> },
      })
    : undefined;
  const tournament = category
    ? await ctx.orm.query.tournament.findFirst({
        where: { id: category.tournamentId as Id<"tournament"> },
      })
    : undefined;

  return resolveCheckoutSourceIdentity({
    category: category ?? null,
    snapshotLabel: charge.sourceLabel,
    sourceType: charge.sourceType,
    tournament: tournament ?? null,
  });
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

    if (!charge) {
      return { activated: false };
    }

    // Cobranca que o app ja considerava morta (cancelada pelo jogador, expirada
    // ou falhada) recebeu dinheiro: NUNCA engolir — vira PAID com estorno
    // pendente, e o estorno pontual roda fora da transacao. PAID/REFUNDED nao
    // entram aqui (webhook duplicado e estorno ja feito).
    if (!canChargeBePaid(charge)) {
      if (shouldRefundLatePayment(charge) && canRequestRefund(charge)) {
        const paidAt = new Date();
        await ctx.orm
          .update(paymentCharge)
          .set({
            paidAt,
            refundStatus: "pending",
            status: CHARGE_STATUS_PAID,
            updatedAt: paidAt,
            ...(input.providerTransactionId
              ? { providerTransactionId: input.providerTransactionId }
              : {}),
          })
          .where(eq(paymentCharge.id, charge.id));

        await ctx.scheduler.runAfter(
          0,
          internal.tournament.lifecycle.refundLatePaymentForCharge,
          { chargeId: charge.id as string }
        );
      }

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
 * Cobranca PAID sem o que ativar: marca estorno pendente e dispara o estorno
 * pontual (fora da transacao). "pending"/"refunded" nunca sao sobrescritos.
 */
async function handOffPaidChargeToRefund(
  ctx: MutationCtx,
  charge: InferSelectModel<typeof paymentCharge>
) {
  if (!canRequestRefund(charge)) {
    return;
  }

  const now = new Date();
  await ctx.orm
    .update(paymentCharge)
    .set({ refundStatus: "pending", updatedAt: now })
    .where(eq(paymentCharge.id, charge.id as Id<"paymentCharge">));

  await ctx.scheduler.runAfter(
    0,
    internal.tournament.lifecycle.refundLatePaymentForCharge,
    { chargeId: charge.id as string }
  );
}

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
    // Charge PAID but entry no longer awaiting (cancelada, aprovada, rejeitada
    // ou ja ativada por outra cobranca) — o dinheiro entrou e nao tem o que
    // ativar: vai para estorno, nunca fica parado.
    await handOffPaidChargeToRefund(ctx, charge);
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
    await handOffPaidChargeToRefund(ctx, charge);
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

    // A inscricao morreu: nenhuma OUTRA cobranca ainda PENDING do mesmo source
    // pode continuar pagavel (a paga acima ja esta no estorno).
    await cancelPendingChargesForSourceCore(ctx, {
      sourceIds: [entryId as string],
      sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
    });

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
        // status e refundStatus fecham JUNTOS: um REFUNDED com refundStatus preso
        // em pending|failed nao tem mais escritor e a reserva de saque desconta o
        // organizador para sempre.
        ...CHARGE_REFUNDED_FIELDS,
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    return charge.id;
  });

// Cancelamento da cobranca: `status: CANCELED` entra na MESMA mutation que
// cancela a inscricao (a cobranca sai do reuso na hora, sem esperar o provedor) e
// `cancelStatus` registra depois se o PIX realmente morreu no provedor.

/** Cap do lote: as cobrancas PENDING de um source sao poucas (o reuso segura a
 * maioria), mas o torneio cancela ate 300 inscricoes por categoria de uma vez. */
const MAX_CHARGES_PER_CANCEL_BATCH = 300;

/** Cobrancas com cancelamento ainda sem confirmacao do provedor no sweep. */
const MAX_PENDING_CANCELLATIONS_PER_SWEEP = 100;

/** Backoff entre tentativas do MESMO cancelamento (abaixo do intervalo do cron,
 * para todo tick ter trabalho). Sem ele as 100 mais antigas ocupariam a fila
 * para sempre e uma cobranca nova nunca seria retentada. */
const CANCEL_RETRY_BACKOFF_MS = 10 * 60 * 1000;

export const getChargeForProviderCommand = privateQuery
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(
    z
      .object({
        amountCents: z.number().int(),
        correlationId: z.string(),
        refundStatus: z.string().nullable(),
        status: z.string(),
      })
      .nullable()
  )
  .query(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { id: input.chargeId as Id<"paymentCharge"> },
    });

    return charge
      ? {
          amountCents: charge.amountCents,
          correlationId: charge.correlationId,
          // Coluna opcional: o ORM devolve `undefined` quando nunca houve estorno
          // e o output declara `nullable()` — normalize antes de devolver.
          refundStatus: charge.refundStatus ?? null,
          status: charge.status,
        }
      : null;
  });

/**
 * Nucleo do cancelamento: mata as cobrancas PENDING do lote (CANCELED +
 * `cancelStatus: pending`) e agenda o DELETE no provedor. SO PENDING entra —
 * PAID segue o caminho de estorno que ja existe, e uma cobranca ja CANCELED nao
 * tem nada a fazer (idempotente por status). Funcao do modulo (nao procedure)
 * para o caminho de ativacao paga cancelar na MESMA transacao.
 */
async function cancelPendingChargesForSourceCore(
  ctx: MutationCtx,
  args: { sourceIds: string[]; sourceType: string }
) {
  const charges = await ctx.orm.query.paymentCharge.findMany({
    limit: MAX_CHARGES_PER_CANCEL_BATCH,
    where: {
      sourceId: { in: args.sourceIds },
      sourceType: args.sourceType,
      status: CHARGE_STATUS_PENDING,
    },
  });

  const now = new Date();
  let canceledCount = 0;

  for (const charge of charges) {
    if (!canChargeBeCanceled(charge)) {
      continue;
    }

    await ctx.orm
      .update(paymentCharge)
      .set({
        cancelStatus: CHARGE_CANCEL_PENDING,
        status: CHARGE_STATUS_CANCELED,
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    await ctx.scheduler.runAfter(
      0,
      internal.payment.charge.processChargeCancellation,
      { chargeId: charge.id as string }
    );
    canceledCount += 1;
  }

  return { canceledCount };
}

/** Porta do nucleo para os outros modulos (o torneio cancela inscricoes e
 * chama via `ctx.runMutation`). */
export const cancelPendingChargesForSource = privateMutation
  .input(
    z.object({
      sourceIds: z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_CHARGES_PER_CANCEL_BATCH),
      sourceType: z.string().min(1),
    })
  )
  .output(z.object({ canceledCount: z.number().int().nonnegative() }))
  .mutation(async ({ ctx, input }) =>
    cancelPendingChargesForSourceCore(ctx, {
      sourceIds: input.sourceIds,
      sourceType: input.sourceType,
    })
  );

/** Grava o desfecho do comando no provedor; o `status` ja e CANCELED desde a
 * mutation e nao volta atras — so o pedido muda de `pending` para confirmado. */
export const applyChargeCancelOutcome = privateMutation
  .input(
    z.object({
      chargeId: z.string().min(1),
      outcome: z.enum(["canceled", "failed"]),
    })
  )
  .output(z.object({ cancelStatus: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const cancelStatus =
      input.outcome === "canceled"
        ? CHARGE_CANCEL_CONFIRMED
        : CHARGE_CANCEL_FAILED;
    const now = new Date();

    await ctx.orm
      .update(paymentCharge)
      .set({ cancelStatus, updatedAt: now })
      .where(eq(paymentCharge.id, input.chargeId as Id<"paymentCharge">));

    return { cancelStatus };
  });

/**
 * DELETE da cobranca no provedor + desfecho. So `deleted`/`not_found` confirmam
 * o cancelamento; PAID vai para estorno e o resto fica `failed` para o sweep.
 */
export const processChargeCancellation = privateAction
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(
    z.object({
      outcome: z.enum(["canceled", "failed", "late_payment", "skipped"]),
    })
  )
  .action(async ({ ctx, input }) => {
    const charge = await ctx.runQuery(
      internal.payment.charge.getChargeForProviderCommand,
      { chargeId: input.chargeId }
    );

    // Idempotente: so age na cobranca que ESTE pipeline marcou como cancelada.
    if (!charge || charge.status !== CHARGE_STATUS_CANCELED) {
      return { outcome: "skipped" as const };
    }

    let deleted = false;
    try {
      const result = await ctx.runAction(
        internal.payment.providerNode.deleteChargeAction,
        { correlationId: charge.correlationId }
      );
      deleted = result.deleted;
    } catch {
      // Timeout/rede: cai no probe abaixo, que decide sem inventar desfecho.
    }

    let providerStatus: CancelProbeStatus = "not_found";
    if (!deleted) {
      try {
        const probe = await ctx.runAction(
          internal.payment.providerNode.getChargeStatusAction,
          { correlationId: charge.correlationId }
        );
        providerStatus =
          probe.status === null
            ? "not_found"
            : normalizeProviderStatus(probe.status);
      } catch {
        // Provedor mudo: NAO da para confirmar nada — `unreachable` mantem o
        // pedido sem confirmacao (e grava `failed` + `updatedAt`, para o sweep
        // devolver a vez as outras cobrancas).
        providerStatus = PROVIDER_PROBE_UNREACHABLE;
      }
    }

    const outcome = resolveChargeCancellationOutcome(
      toProviderCancelProbe({ deleted, providerStatus })
    );

    if (outcome === "late_payment") {
      // O dinheiro entrou: o cancelamento fecha aqui (senao o sweep ficaria
      // retentando uma cobranca que ja saiu de CANCELED) e o estorno assume.
      await ctx.runMutation(internal.payment.charge.applyChargeCancelOutcome, {
        chargeId: input.chargeId,
        outcome: "canceled",
      });
      await ctx.runMutation(internal.payment.charge.applyPaidCharge, {
        correlationId: charge.correlationId,
      });
      return { outcome };
    }

    await ctx.runMutation(internal.payment.charge.applyChargeCancelOutcome, {
      chargeId: input.chargeId,
      outcome,
    });

    return { outcome };
  });

/**
 * Cron (15 min): re-tenta o DELETE das CANCELED ainda sem confirmacao do
 * provedor, das mais antigas para as mais novas e so depois do backoff. PIX
 * pago antes disso cai no estorno de `applyPaidCharge`.
 */
export const sweepPendingChargeCancellations = privateMutation.mutation(
  async ({ ctx }) => {
    if (getEnv().DEPLOY_ENV !== "production") {
      return { processed: 0 };
    }

    const retryBefore = new Date(Date.now() - CANCEL_RETRY_BACKOFF_MS);
    const chargeLists = await Promise.all([
      ctx.orm.query.paymentCharge.findMany({
        limit: MAX_PENDING_CANCELLATIONS_PER_SWEEP,
        orderBy: { updatedAt: "asc" },
        where: {
          cancelStatus: CHARGE_CANCEL_PENDING,
          status: CHARGE_STATUS_CANCELED,
        },
      }),
      ctx.orm.query.paymentCharge.findMany({
        limit: MAX_PENDING_CANCELLATIONS_PER_SWEEP,
        orderBy: { updatedAt: "asc" },
        where: {
          cancelStatus: CHARGE_CANCEL_FAILED,
          status: CHARGE_STATUS_CANCELED,
        },
      }),
    ]);

    let processed = 0;
    for (const charge of chargeLists.flat()) {
      if (!(charge.updatedAt && charge.updatedAt < retryBefore)) {
        continue;
      }
      await ctx.scheduler.runAfter(
        0,
        internal.payment.charge.processChargeCancellation,
        { chargeId: charge.id as string }
      );
      processed += 1;
    }

    return { processed };
  }
);

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

/** Cap por bucket de status: o cron roda a cada 30 min e o que sobrar entra na
 * proxima volta (a ordem por `createdAt` garante que nada fica preso fora). */
const MAX_RECONCILED_CHARGES_PER_SWEEP = 50;

/**
 * Cobrancas que o provedor precisa reconferir (webhook perdido): PENDING velha e
 * o terminal que AINDA pode receber dinheiro (EXPIRED/CANCELED-sem-confirmacao/
 * FAILED recentes) — ver `shouldReconcileCharge`. Query separada da action
 * porque so aqui existe `ctx.orm`.
 */
export const findStaleChargesForReconciliation = privateMutation.mutation(
  async ({ ctx }) => {
    const now = new Date();
    // PENDING mais ANTIGAS primeiro (a divida mais velha); terminais mais
    // RECENTES primeiro (a janela do pagamento tardio) — cada bucket com cap
    // proprio para o cron nunca ficar sem olhar o outro.
    const [pending, terminal] = await Promise.all([
      ctx.orm.query.paymentCharge.findMany({
        limit: MAX_RECONCILED_CHARGES_PER_SWEEP,
        orderBy: { createdAt: "asc" },
        where: { status: CHARGE_STATUS_PENDING },
      }),
      ctx.orm.query.paymentCharge.findMany({
        limit: MAX_RECONCILED_CHARGES_PER_SWEEP,
        orderBy: { createdAt: "desc" },
        where: {
          status: {
            in: [
              CHARGE_STATUS_EXPIRED,
              CHARGE_STATUS_CANCELED,
              CHARGE_STATUS_FAILED,
            ],
          },
        },
      }),
    ]);

    return [...pending, ...terminal]
      .filter((charge) =>
        shouldReconcileCharge({
          cancelStatus: charge.cancelStatus ?? null,
          createdAtMs: charge.createdAt.getTime(),
          nowMs: now.getTime(),
          status: charge.status as PaymentChargeStatus,
        })
      )
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
