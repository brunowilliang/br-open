import { and, eq, inArray } from "kitcn/orm";
import { CRPCError } from "kitcn/server";

import { dismissPendingItemSchema } from "../../domains/pendings/contract";
import {
  buildPendingDismissalSnapshot,
  isPendingItemDismissible,
  resolvePendingItemScope,
  selectDeadPendingDismissals,
} from "../../domains/pendings/pendings-rules";
import {
  derivePendings,
  findPendingDismissals,
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

    // O item e ESTADO: sem dispensa, ele so sai quando o problema acaba.
    if (!isPendingItemDismissible(input.itemId)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa pendência não pode ser dispensada.",
      });
    }

    const derivation = await derivePendings({
      actor,
      ctx,
      nowMs: Date.now(),
      scope,
    });
    const item = derivation.items.find(
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

    const receipts = await findPendingDismissals({
      actor,
      ctx,
      surface: input.surface,
    });
    const dead = selectDeadPendingDismissals({
      actor: owner,
      items: derivation.items,
      receipts,
      surface: input.surface,
    });

    if (dead.length === 0) {
      return;
    }

    await ctx.orm.delete(pendingDismissal).where(
      and(
        eq(pendingDismissal.actorKind, owner.kind),
        eq(pendingDismissal.actorId, owner.id),
        eq(pendingDismissal.surface, input.surface),
        inArray(
          pendingDismissal.itemId,
          dead.map((receipt) => receipt.itemId)
        )
      )!
    );
  });
