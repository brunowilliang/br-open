import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import {
  paymentAccountSchema,
  paymentAccountStatusSchema,
  type PaymentAccount,
} from "../../domains/payment/contract";
import { organization } from "../../domains/auth/tables";
import { maskPixKey } from "../../domains/payment/pix-key";
import { authAction, authQuery, privateMutation } from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireActiveManager } from "../viewer/context";

const startOnboardingInput = z.object({
  // Display name do titular — mostrado no destino do saque. Opcional para
  // seguir aceitando `start({ pixKey })`; ausente é persistido como null.
  accountName: z.string().trim().min(1).max(80).optional(),
  pixKey: z.string().min(1, "Informe a chave PIX."),
});

/**
 * Onboards the active organization as a payment-provider subaccount (split
 * recipient).
 *
 * authAction because it calls the provider SDK (Node runtime) to provision the
 * subaccount. The DB writes are delegated to private mutations via
 * `ctx.runMutation` / `ctx.runAction` (the kitcn caller has TS inference
 * issues for `.actions` on ActionCtx). taxId is NOT collected (validated in
 * the 2026-07-02 PoC).
 */
export const start = authAction
  .input(startOnboardingInput)
  .output(
    z.object({
      accountName: z.string().nullable(),
      name: z.string(),
      pixKey: z.string(),
      status: paymentAccountStatusSchema,
    })
  )
  .action(async ({ ctx, input }) => {
    // Resolve the active manager's org via a private mutation (authAction has
    // no ctx.orm, so we cross the boundary with ctx.runMutation).
    const { organizationId } = await ctx.runMutation(
      internal.payment.charge.resolveActiveManagerOrg,
      { userId: ctx.userId }
    );

    // Pull the org name (subaccount requires it).
    const org = await ctx.runMutation(
      internal.payment.charge.resolveOrganizationForOnboarding,
      { organizationId }
    );
    if (!org.name) {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Complete o perfil da organizacao (nome) antes de conectar a conta de pagamento.",
      });
    }

    // Provision the provider subaccount via the Node action (provider-node.ts
    // has "use node"). Use ctx.runAction so this file never imports the
    // use-node module directly (which would break Convex bundling).
    let subaccount: { name: string; pixKey: string };
    try {
      subaccount = await ctx.runAction(
        internal.payment.providerNode.createSubaccountAction,
        { name: org.name, pixKey: input.pixKey }
      );
    } catch (error) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao conectar conta de pagamento: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      });
    }

    await ctx.runMutation(internal.payment.onboarding.upsertAccount, {
      accountName: input.accountName ?? null,
      name: subaccount.name,
      organizationId,
      pixKey: subaccount.pixKey,
    });

    return {
      accountName: input.accountName ?? null,
      name: subaccount.name,
      pixKey: subaccount.pixKey,
      status: "active",
    };
  });

/**
 * Returns the organization's current payment account status (or null fields if
 * not onboarded yet). Used by the organizer "Pagamentos" card to gate the
 * charging toggle. Reads the embedded JSON snapshot from
 * `organization.paymentAccount`.
 */
export const getStatus = authQuery
  .output(
    z.object({
      accountName: z.string().nullable(),
      name: z.string().nullable(),
      pixKey: z.string().nullable(),
      status: paymentAccountStatusSchema.nullable(),
    })
  )
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);
    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });
    const raw = org?.paymentAccount;
    if (!raw) {
      return { accountName: null, name: null, pixKey: null, status: null };
    }
    const parsed = paymentAccountSchema.safeParse(raw);
    if (!parsed.success) {
      return { accountName: null, name: null, pixKey: null, status: null };
    }
    return {
      accountName: parsed.data.accountName,
      name: parsed.data.name,
      pixKey: maskPixKey(parsed.data.pixKey),
      status: parsed.data.status,
    };
  });

/**
 * Persists the organization's payment account snapshot (status "active") into
 * the embedded `paymentAccount` JSON column on `organization` after a
 * successful subaccount provisioning. Single UPDATE replaces the old
 * find-then-upsert against the extinct `organizationWooviAccount` table.
 * Private mutation called from the onboarding `start` authAction via
 * `ctx.runMutation`.
 */
export const upsertAccount = privateMutation
  .input(
    z.object({
      accountName: z.string().nullable().optional(),
      name: z.string(),
      organizationId: z.string(),
      pixKey: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const account: PaymentAccount = {
      accountName: input.accountName ?? null,
      name: input.name,
      onboardedAt: now.toISOString(),
      pixKey: input.pixKey,
      status: "active",
    };
    await ctx.orm
      .update(organization)
      .set({
        paymentAccount: account as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .where(eq(organization.id, input.organizationId as Id<"organization">));
  });
