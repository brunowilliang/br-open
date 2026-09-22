import {
  listPendingsSchema,
  pendingsListResultSchema,
  type PendingSurface,
} from "../../domains/pendings/contract";
import { buildPendingsResult } from "../../domains/pendings/pendings-rules";
import {
  collectPendings,
  findPendingDismissals,
  resolvePendingsActor,
} from "../../domains/pendings/registry";
import { authQuery } from "../../lib/crpc";
import { findViewerActiveActor } from "../viewer/context";

/**
 * Sem `surface` a leitura vale a CASA: a unica superficie que nunca esconde.
 * Quem esquece o parametro perde a dispensa, nunca uma pendencia.
 */
const DEFAULT_PENDING_SURFACE: PendingSurface = "house";

/**
 * `pendings.list` — a UNICA porta das pendencias/alertas do app.
 *
 * O ator ativo e resolvido no SERVIDOR (nunca vem por input) e o escopo pedido so
 * responde se for o escopo DESSE ator: organizacao nunca recebe pendencia de
 * jogador e vice-versa, e quem nao tem ator com direito ao escopo recebe
 * `items: []`, nunca erro. O escopo da ORGANIZACAO exige manager ativo, o mesmo
 * gate de `requireActiveManager`; a guarda de kind x escopo mora nos derivadores
 * (`registry.ts`). A fonte de verdade do item (copy, destaque, acao, ordem, rota)
 * e este servidor — a tela so renderiza — e o fecho esconde o que foi dispensado
 * NAQUELA superficie, ordena por severidade > prazo > valor > id e corta no cap.
 */
export const list = authQuery
  .input(listPendingsSchema)
  .output(pendingsListResultSchema)
  .query(async ({ ctx, input }) => {
    const surface = input.surface ?? DEFAULT_PENDING_SURFACE;
    const activeActor = await findViewerActiveActor(ctx, ctx.userId);
    const actor = activeActor ? resolvePendingsActor(activeActor) : null;

    if (!actor) {
      return buildPendingsResult({ items: [], scope: input.scope });
    }

    return collectPendings({
      actor,
      ctx,
      dismissals: {
        receipts: await findPendingDismissals({ actor, ctx, surface }),
        surface,
      },
      nowMs: Date.now(),
      scope: input.scope,
    });
  });
