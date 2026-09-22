import { CRPCError } from "kitcn/server";

import { dismissPendingItemSchema } from "../../domains/pendings/contract";
import {
  buildPendingDismissalSnapshot,
  resolvePendingItemScope,
} from "../../domains/pendings/pendings-rules";
import {
  collectPendings,
  resolvePendingsActor,
  toPendingActorRef,
} from "../../domains/pendings/registry";
import { pendingDismissal } from "../../domains/pendings/tables";
import { authMutation } from "../../lib/crpc";
import { findViewerActiveActor } from "../viewer/context";

/**
 * `pendings.dismiss`: esconde UM item na superficie pedida. O snapshot e
 * re-derivado AQUI, nunca vem do cliente — senao ele congelaria um estado que a
 * tela nem viu; o upsert regrava o recibo morto do mesmo item.
 */
export const dismiss = authMutation
  .input(dismissPendingItemSchema)
  .mutation(async ({ ctx, input }) => {
    const activeActor = await findViewerActiveActor(ctx, ctx.userId);
    const actor = activeActor ? resolvePendingsActor(activeActor) : null;
    const scope = resolvePendingItemScope(input.itemId);

    if (!(actor && scope)) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Pendencia nao encontrada.",
      });
    }

    const current = await collectPendings({
      actor,
      ctx,
      nowMs: Date.now(),
      scope,
    });
    const item = current.items.find(
      (candidate) => candidate.id === input.itemId
    );

    if (!item) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Pendencia nao encontrada.",
      });
    }

    const owner = toPendingActorRef(actor);
    const snapshot = buildPendingDismissalSnapshot(item);
    const dismissedAt = new Date();

    await ctx.orm
      .insert(pendingDismissal)
      .values({
        ...snapshot,
        actorId: owner.id,
        actorKind: owner.kind,
        dismissedAt,
        itemId: item.id,
        surface: input.surface,
      })
      .onConflictDoUpdate({
        set: { ...snapshot, dismissedAt },
        target: [
          pendingDismissal.actorKind,
          pendingDismissal.actorId,
          pendingDismissal.surface,
          pendingDismissal.itemId,
        ],
      });
  });
