import {
  listPendingsSchema,
  pendingsListResultSchema,
} from "../../domains/pendings/contract";
import {
  collectPendings,
  resolvePendingsActor,
} from "../../domains/pendings/registry";
import { buildPendingsResult } from "../../domains/pendings/pendings-rules";
import { authQuery } from "../../lib/crpc";
import { findViewerActiveActor } from "../viewer/context";

/**
 * `pendings.list` — a UNICA porta das pendencias/alertas do app (IBX-0076).
 *
 * O ator ativo e resolvido no SERVIDOR (nunca vem por input) e o escopo pedido
 * so responde se for o escopo DESSE ator: organizacao nunca recebe pendencia de
 * jogador e vice-versa, e quem nao tem ator com direito ao escopo recebe
 * `items: []` — nunca erro. `resolvePendingsActor` aplica os dois gates:
 * conta sem perfil de jogador nao tem escopo; e o escopo da ORGANIZACAO exige
 * manager ativo (owner/admin), o MESMO gate das leituras equivalentes
 * (`requireActiveManager`, a aba Solicitacoes) — member puro nao recebe
 * contagem/ids que as telas escondem dele. A guarda de kind x escopo mora nos
 * derivadores (`registry.ts`).
 *
 * Fonte de verdade do item (copy, destaque, acao, ordem, rota) e este servidor;
 * a tela so renderiza. O resultado sempre passa pelo mesmo fecho: ordenado por
 * severidade > prazo > valor > id, cortado no cap e contado do array devolvido.
 */
export const list = authQuery
  .input(listPendingsSchema)
  .output(pendingsListResultSchema)
  .query(async ({ ctx, input }) => {
    const activeActor = await findViewerActiveActor(ctx, ctx.userId);
    const actor = activeActor ? resolvePendingsActor(activeActor) : null;

    if (!actor) {
      return buildPendingsResult({ items: [], scope: input.scope });
    }

    return collectPendings({
      actor,
      ctx,
      nowMs: Date.now(),
      scope: input.scope,
    });
  });
