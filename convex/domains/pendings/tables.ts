import {
  convexTable,
  integer,
  text,
  textEnum,
  timestamp,
  uniqueIndex,
} from "kitcn/orm";

import {
  PENDING_SCOPE_OPTIONS,
  PENDING_SEVERITY_OPTIONS,
  PENDING_SURFACE_OPTIONS,
} from "./contract";

/**
 * Recibo da dispensa: snapshot do item (severidade, contagem, prazo e a
 * assinatura do payload, quando existe) no momento em que o usuario o escondeu
 * NAQUELA superficie — quando o item piora ou o payload muda, o recibo morre e o
 * item volta (regra em pendings-rules.ts).
 */
export const pendingDismissal = convexTable(
  "pendingDismissal",
  {
    /** Ator DONO da pendencia (playerProfile ou organization), nunca a sessao. */
    actorId: text().notNull(),
    actorKind: textEnum(PENDING_SCOPE_OPTIONS).notNull(),
    count: integer(),
    deadlineAt: integer(),
    dismissedAt: timestamp().notNull(),
    /** Id deterministico do item (`<kind>:<sourceId>`), como na leitura. */
    itemId: text().notNull(),
    severity: textEnum(PENDING_SEVERITY_OPTIONS).notNull(),
    /** `null` nos kinds sem payload mutavel: so a severidade/contagem/prazo valem. */
    signature: text(),
    surface: textEnum(PENDING_SURFACE_OPTIONS).notNull(),
  },
  (pendingDismissal) => [
    // Identidade do recibo: serve tanto o upsert da dispensa quanto a leitura
    // (ator + superficie, com o item fechando a chave).
    uniqueIndex("actor_surface_item").on(
      pendingDismissal.actorKind,
      pendingDismissal.actorId,
      pendingDismissal.surface,
      pendingDismissal.itemId
    ),
  ]
);
