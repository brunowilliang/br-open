import type { APIQRCodePIX } from "@abacatepay/types/v2";
import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { isLeaguePaid } from "../../domains/league/membership-rules";
import { leagueMembership } from "../../domains/league/tables";
import {
  createChargeOutputSchema,
  type PaymentChargeStatus,
} from "../../domains/payment/contract";
import {
  createTransparentPixCharge,
  simulateTransparentPixCharge,
} from "../../domains/payment/abacatepay-client";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  normalizeProviderStatus,
} from "../../domains/payment/rules";
import { paymentCharge } from "../../domains/payment/tables";
import { authAction, authQuery, privateMutation } from "../../lib/crpc";
import { getEnv } from "../../lib/get-env";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { scheduleLeagueNotification } from "../notification/events";

// ---------------------------------------------------------------------------
// Charge creation (authAction — needs fetch)
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

    // Validate the membership is awaiting_payment.
    const chargeData = await ctx.runMutation(
      internal.payment.charge.validateMembershipForCharge,
      { leagueId, membershipId, userId: ctx.userId }
    );

    // Call Abacate Pay API. The client reads ABACATEPAY_API_KEY lazily and
    // throws AbacatePayError if it is missing.
    let chargeResult: APIQRCodePIX;
    try {
      chargeResult = await createTransparentPixCharge({
        amount: chargeData.amountCents,
        expiresIn: CHARGE_EXPIRES_IN_SECONDS,
        description: `Inscrição na liga — ${chargeData.leagueName}`,
        metadata: { leagueId, membershipId },
      });
    } catch (error) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao criar cobrança: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      });
    }

    // Persist the charge row.
    const savedCharge = await ctx.runMutation(
      internal.payment.charge.saveCharge,
      {
        amountCents: chargeData.amountCents,
        brCode: chargeResult.brCode,
        brCodeBase64: chargeResult.brCodeBase64,
        externalId: membershipId,
        leagueId,
        membershipId,
        organizationId: chargeData.organizationId,
        playerProfileId: chargeData.playerProfileId,
        platformFee: chargeResult.platformFee ?? null,
        providerChargeId: chargeResult.id,
        status: normalizeProviderStatus(chargeResult.status),
      }
    );

    return {
      brCode: chargeResult.brCode,
      brCodeBase64: chargeResult.brCodeBase64,
      chargeId: savedCharge.id as Id<"paymentCharge">,
      expiresAt: chargeResult.expiresAt,
      status: normalizeProviderStatus(chargeResult.status),
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

    // Return only the active PENDING charge — the current PIX to be paid.
    // The source of truth for "payment confirmed" is the membership status
    // (`active`), read from league discovery. Returning a PAID/EXPIRED charge
    // here would leak a previous cycle's charge into a new join request after
    // the player is removed/rejected, causing the checkout to show a stale
    // "paid" state.
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      orderBy: { createdAt: "desc" },
      where: { membershipId, status: "PENDING" },
    });

    if (!charge) {
      return null;
    }

    return {
      brCode: charge.brCode ?? "",
      brCodeBase64: charge.brCodeBase64 ?? "",
      chargeId: charge.id as Id<"paymentCharge">,
      expiresAt: charge.expiresAt?.toISOString() ?? null,
      status: (charge.status as PaymentChargeStatus) ?? "PENDING",
    };
  });

// ---------------------------------------------------------------------------
// Private mutations (called from actions + webhook)
// ---------------------------------------------------------------------------

const saveChargeInput = z.object({
  amountCents: z.number(),
  brCode: z.string(),
  brCodeBase64: z.string(),
  externalId: z.string(),
  leagueId: z.string(),
  membershipId: z.string(),
  organizationId: z.string(),
  playerProfileId: z.string(),
  platformFee: z.number().int().nullable(),
  providerChargeId: z.string().nullable(),
  status: z.string(),
});

export const saveCharge = privateMutation
  .input(saveChargeInput)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();

    const existing = await ctx.orm.query.paymentCharge.findFirst({
      where: { membershipId: input.membershipId as Id<"leagueMembership"> },
    });

    if (existing) {
      await ctx.orm
        .update(paymentCharge)
        .set({
          amountCents: input.amountCents,
          brCode: input.brCode,
          brCodeBase64: input.brCodeBase64,
          expiresAt: new Date(Date.now() + CHARGE_EXPIRES_IN_SECONDS * 1000),
          paidAt: null,
          platformFee: input.platformFee,
          providerChargeId: input.providerChargeId,
          status: input.status,
          updatedAt: now,
        })
        .where(eq(paymentCharge.id, existing.id));
      return existing;
    }

    const row = (
      await ctx.orm
        .insert(paymentCharge)
        .values({
          amountCents: input.amountCents,
          brCode: input.brCode,
          brCodeBase64: input.brCodeBase64,
          createdAt: now,
          externalId: input.externalId,
          expiresAt: new Date(Date.now() + CHARGE_EXPIRES_IN_SECONDS * 1000),
          leagueId: input.leagueId as Id<"league">,
          membershipId: input.membershipId as Id<"leagueMembership">,
          organizationId: input.organizationId as Id<"organization">,
          paidAt: null,
          playerProfileId: input.playerProfileId as Id<"playerProfile">,
          platformFee: input.platformFee,
          providerChargeId: input.providerChargeId,
          status: input.status,
          updatedAt: now,
        })
        .returning()
    )[0];

    return row;
  });

export const markChargePaid = privateMutation
  .input(
    z.object({
      // The AbacatePay charge id (pix_char_*). The webhook for
      // transparent.completed sends `data.transparent.id` = this value, which
      // we stored when creating the charge. We match by it instead of
      // externalId because the v2 API returns externalId = null for charges
      // created without an explicit customer (our case).
      providerChargeId: z.string(),
      platformFee: z.number().int().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { providerChargeId: input.providerChargeId },
    });

    if (!charge) {
      return null;
    }

    // Only PENDING charges can transition to PAID — late webhooks for an
    // already-EXPIRED/REFUNDED charge must be ignored.
    if (!canChargeBePaid(charge)) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(paymentCharge)
      .set({
        paidAt: now,
        platformFee: input.platformFee,
        status: "PAID",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    return charge.membershipId as Id<"leagueMembership">;
  });

/**
 * Marks a charge as REFUNDED when AbacatePay fires `transparent.refunded`.
 * Does NOT touch the membership status — refund handling (suspend player,
 * notify) is a separate concern. The mutation only ensures the local charge
 * row stops claiming to be PAID.
 *
 * @see https://docs.abacatepay.com/pages/webhooks
 */
export const markChargeRefunded = privateMutation
  .input(
    z.object({
      providerChargeId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { providerChargeId: input.providerChargeId },
    });

    if (!charge) {
      return null;
    }

    // Refunds only apply to PAID (or defensively EXPIRED) charges — a
    // refund webhook for a still-PENDING charge is meaningless.
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

/**
 * Activates a membership after payment is confirmed.
 * Transitions the membership from `awaiting_payment` to `active`.
 */
export const activateMembership = privateMutation
  .input(
    z.object({
      membershipId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const membershipId = input.membershipId as Id<"leagueMembership">;
    const membership = await ctx.orm.query.leagueMembership.findFirst({
      where: { id: membershipId },
    });

    if (!(membership && canMembershipBeCharged(membership))) {
      return null;
    }

    const now = new Date();
    await ctx.orm
      .update(leagueMembership)
      .set({
        reviewedAt: now,
        status: "active",
        updatedAt: now,
      })
      .where(eq(leagueMembership.id, membershipId));

    // Notify the player that payment was confirmed.
    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: membership.leagueId as Id<"league"> },
    });
    if (currentLeague) {
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
    }

    return membershipId;
  });

// ---------------------------------------------------------------------------
// Expire a pending charge when the user cancels the join request.
// Avoids orphan PENDING rows — the checkout would otherwise keep showing an
// old PIX that can never activate the membership.
// ---------------------------------------------------------------------------

export const expireChargeForMembership = privateMutation
  .input(
    z.object({
      membershipId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const charge = await ctx.orm.query.paymentCharge.findFirst({
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
      .update(paymentCharge)
      .set({
        status: "EXPIRED",
        updatedAt: now,
      })
      .where(eq(paymentCharge.id, charge.id));

    return charge.id;
  });

// ---------------------------------------------------------------------------
// Internal: validate membership is ready for charge creation
// ---------------------------------------------------------------------------

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
        message: "Solicitação não encontrada.",
      });
    }

    if (!canMembershipBeCharged(membership)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esta solicitação não está aguardando pagamento.",
      });
    }

    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: leagueId },
    });

    if (!currentLeague) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Liga não encontrada.",
      });
    }

    if (!isLeaguePaid(currentLeague)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esta liga não é paga.",
      });
    }

    return {
      amountCents: currentLeague.monthlyPriceCents ?? 0,
      leagueName: currentLeague.name,
      organizationId: currentLeague.organizationId as string,
      playerProfileId: membership.playerProfileId as string,
    };
  });

// ---------------------------------------------------------------------------
// Internal: lookup the PENDING charge for the simulate action.
// Returns only the fields the action needs (providerChargeId + externalId).
// Throws NOT_FOUND if there is no PENDING charge, and INTERNAL_SERVER_ERROR
// if the charge is missing its AbacatePay id.
// ---------------------------------------------------------------------------

export const getPendingChargeForSimulation = privateMutation
  .input(z.object({ membershipId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const membershipId = input.membershipId as Id<"leagueMembership">;
    const charge = await ctx.orm.query.paymentCharge.findFirst({
      where: { membershipId, status: "PENDING" },
    });

    if (!charge) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Cobrança pendente não encontrada para essa inscrição.",
      });
    }

    if (!charge.providerChargeId) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Cobrança sem providerChargeId — não é possível simular no AbacatePay.",
      });
    }

    return {
      externalId: charge.externalId,
      providerChargeId: charge.providerChargeId,
    };
  });

// ---------------------------------------------------------------------------
// DEV ONLY: simulate a PIX payment confirmation.
// Hard-gated on DEPLOY_ENV !== "production" so it can never run in prod.
// Calls AbacatePay's /transparents/simulate-payment endpoint so both systems
// agree the charge is PAID (no more local-PAID / provider-Expirado divergence),
// then runs the same activation path as the production webhook.
// ---------------------------------------------------------------------------

export const simulatePayment = authAction
  .input(z.object({ membershipId: z.string().min(1) }))
  .output(z.object({ success: z.boolean() }))
  .action(async ({ ctx, input }) => {
    if (getEnv().DEPLOY_ENV === "production") {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Simulação de pagamento indisponível em produção.",
      });
    }

    const membershipId = input.membershipId as Id<"leagueMembership">;

    // Actions cannot use ctx.orm, so delegate the lookup to an internal
    // mutation (same pattern as validateMembershipForCharge / saveCharge).
    const charge = await ctx.runMutation(
      internal.payment.charge.getPendingChargeForSimulation,
      { membershipId }
    );

    // Tell AbacatePay to mark the charge as paid on their side too. This
    // keeps the two systems consistent: previously we marked PAID locally
    // while AbacatePay kept the charge PENDING until it expired, producing
    // the "PAID here / Expirado there" divergence.
    try {
      const result = await simulateTransparentPixCharge(
        charge.providerChargeId
      );
      const fee =
        typeof result.platformFee === "number" ? result.platformFee : null;

      // Mark the local charge row as PAID. The provider charge id is the
      // same one we just simulated; markChargePaid matches by it.
      await ctx.runMutation(internal.payment.charge.markChargePaid, {
        providerChargeId: charge.providerChargeId,
        platformFee: fee,
      });
    } catch (error) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao simular pagamento: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      });
    }

    // Activate the membership (same path as the webhook).
    await ctx.runMutation(internal.payment.charge.activateMembership, {
      membershipId,
    });

    return { success: true };
  });
