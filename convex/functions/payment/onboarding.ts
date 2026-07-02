import { eq } from "kitcn/orm";
import { z } from "zod";
import { pixKeyTypeSchema } from "../../domains/payment/contract";
import { organization } from "../../domains/auth/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";

const startOnboardingInput = z.object({
  pixKey: z.string().min(1),
  pixKeyType: pixKeyTypeSchema,
});

/**
 * Saves or updates the organization's PIX key directly on the organization
 * table. No external payment provider is called — this is purely local storage.
 */
export const start = authMutation
  .input(startOnboardingInput)
  .output(
    z.object({
      pixKey: z.string(),
      pixKeyType: pixKeyTypeSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);

    const now = new Date();
    await ctx.orm
      .update(organization)
      .set({
        pixKey: input.pixKey,
        pixKeyType: input.pixKeyType,
        updatedAt: now,
      })
      .where(eq(organization.id, organizationId));

    return {
      pixKey: input.pixKey,
      pixKeyType: input.pixKeyType,
    };
  });

/**
 * Returns the organization's current PIX key configuration (or null if not
 * registered yet). Used by the organizer "Pagamentos" card on the org profile.
 */
export const getCurrent = authQuery
  .output(
    z.object({
      pixKey: z.string().nullable(),
      pixKeyType: pixKeyTypeSchema.nullable(),
    })
  )
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);
    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });

    return {
      pixKey: org?.pixKey ?? null,
      pixKeyType:
        (org?.pixKeyType as (typeof pixKeyTypeSchema)["_output"] | undefined) ??
        null,
    };
  });
