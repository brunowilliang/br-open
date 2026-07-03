import { eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import {
  wooviAccountStatusSchema,
  type WooviAccountStatus,
} from "../../domains/payment/contract";
import { organizationWooviAccount } from "../../domains/payment/tables";
import { authAction, authQuery, privateMutation } from "../../lib/crpc";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireActiveManager } from "../viewer/context";

const startOnboardingInput = z.object({
  pixKey: z.string().min(1, "Informe a chave PIX."),
});

/**
 * Onboards the active organization as a Woovi subaccount (split recipient).
 *
 * authAction because it calls the Woovi SDK (Node runtime) to provision the
 * subaccount. The DB writes are delegated to private mutations via
 * `ctx.runMutation` / `ctx.runAction` (the kitcn caller has TS inference
 * issues for `.actions` on ActionCtx). taxId is NOT collected (validated in
 * the 2026-07-02 PoC).
 */
export const start = authAction
  .input(startOnboardingInput)
  .output(
    z.object({
      name: z.string(),
      status: wooviAccountStatusSchema,
      wooviPixKey: z.string(),
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

    // Provision the Woovi subaccount via the Node action (woovi-node.ts has
    // "use node"). Use ctx.runAction so this file never imports the use-node
    // module directly (which would break Convex bundling).
    let subaccount: { name: string; pixKey: string };
    try {
      subaccount = await ctx.runAction(
        internal.payment.wooviNode.createSubaccountAction,
        { name: org.name, pixKey: input.pixKey }
      );
    } catch (error) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao conectar conta Woovi: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      });
    }

    return ctx.runMutation(internal.payment.onboarding.upsertAccount, {
      name: subaccount.name,
      organizationId,
      wooviPixKey: subaccount.pixKey,
    });
  });

/**
 * Returns the organization's current Woovi subaccount status (or null if not
 * onboarded yet). Used by the organizer "Pagamentos" card and by the league
 * settings screen to gate the charging toggle.
 */
export const getStatus = authQuery
  .output(
    z
      .object({
        name: z.string().nullable(),
        status: wooviAccountStatusSchema.nullable(),
        wooviPixKey: z.string().nullable(),
      })
      .nullable()
  )
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);
    const account = await ctx.orm.query.organizationWooviAccount.findFirst({
      where: { organizationId },
    });

    if (!account) {
      return null;
    }

    return {
      name: account.name,
      status: account.status as WooviAccountStatus,
      wooviPixKey: maskPixKey(account.wooviPixKey),
    };
  });

/**
 * Upserts the organization's Woovi subaccount row (status "active") after a
 * successful subaccount provisioning. Private mutation called from the
 * onboarding `start` authAction via `ctx.runMutation`.
 */
export const upsertAccount = privateMutation
  .input(
    z.object({
      name: z.string(),
      organizationId: z.string(),
      wooviPixKey: z.string(),
    })
  )
  .output(
    z.object({
      name: z.string(),
      status: wooviAccountStatusSchema,
      wooviPixKey: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const existing = await ctx.orm.query.organizationWooviAccount.findFirst({
      where: {
        organizationId: input.organizationId as Id<"organization">,
      },
    });

    if (existing) {
      await ctx.orm
        .update(organizationWooviAccount)
        .set({
          name: input.name,
          onboardedAt: now,
          status: "active",
          updatedAt: now,
          wooviPixKey: input.wooviPixKey,
        })
        .where(eq(organizationWooviAccount.id, existing.id));
      return {
        name: input.name,
        status: "active" as WooviAccountStatus,
        wooviPixKey: input.wooviPixKey,
      };
    }

    await ctx.orm.insert(organizationWooviAccount).values({
      createdAt: now,
      name: input.name,
      onboardedAt: now,
      organizationId: input.organizationId as Id<"organization">,
      status: "active",
      updatedAt: now,
      wooviPixKey: input.wooviPixKey,
    });

    return {
      name: input.name,
      status: "active" as WooviAccountStatus,
      wooviPixKey: input.wooviPixKey,
    };
  });

function maskPixKey(key: string): string {
  if (key.length <= 4) {
    return key;
  }
  return `${key.slice(0, 2)}${"*".repeat(Math.min(key.length - 4, 8))}${key.slice(-2)}`;
}
