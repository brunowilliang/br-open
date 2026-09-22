import {
  PENDING_DOMAIN_OPTIONS,
  PENDING_KIND_SCOPES,
  PENDING_SEVERITY_OPTIONS,
  type PendingsCounts,
  type PendingsListResult,
  type PendingItem,
  type PendingKind,
  type PendingSaturation,
  type PendingScope,
  type PendingSeverity,
  type PendingSurface,
} from "./contract";

// ---------------------------------------------------------------------------
// Regras puras compartilhadas do sistema de pendencias (IBX-0076)
// ---------------------------------------------------------------------------
//
// Sem ctx, sem tabela, sem Convex: tudo aqui e funcao de dado -> dado, testavel
// isolado (mesmo molde de `domains/league/challenge-status.ts`). As regras POR
// DOMINIO (copy + destaque de cada kind) vivem em
// `domains/<dono>/pendings-rules.ts`; este modulo guarda o que e comum a todos:
// identidade, ordem, cap, contagens e a gramatica das partes/linhas.

/**
 * Cap do array devolvido por `pendings.list`. Os itens vem ORDENADOS antes do
 * corte (a pendencia mais urgente nunca e a que sobra), as contagens saem do
 * array JA cortado e `truncated` avisa que houve corte — badge e lista nunca
 * divergem.
 */
export const PENDING_ITEM_CAP = 20;

/** Ordem de severidade: quem deve a acao mais urgente primeiro. */
const SEVERITY_RANK: Record<PendingSeverity, number> = {
  danger: 0,
  info: 2,
  warning: 1,
};

/**
 * Trecho destacado da descricao (o negrito e decisao do SERVIDOR, r4/r6 da
 * galeria). Partes sem destaque sao o literal `{ text }` — sem wrapper.
 */
export function pendingHighlight(text: string) {
  return { isHighlighted: true as const, text };
}

/**
 * Concordancia de numero do app: `countNoun(1, "resultado", "resultados")` =
 * "1 resultado". Usada nas copias que ja pluralizam na tela hoje.
 */
export function countNoun(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Identidade deterministica do item: `<kind>:<sourceId>`. */
export function buildPendingItemId(kind: string, sourceId: string) {
  return `${kind}:${sourceId}`;
}

/**
 * Acao de NAVEGACAO PURA: o destino e o `route` + `params` do item, entao a
 * acao nao carrega params proprios. Usada por todo CTA que so abre uma tela.
 */
export function openRouteAction() {
  return { params: null, type: "open_route" as const };
}

/**
 * Ordem determinista do array: severidade (danger > warning > info), depois
 * `deadlineAt` ascendente (quem nao tem prazo vai por ultimo), depois
 * `moneyCents` descendente (valor que decide), depois `id` ascendente — o
 * desempate final garante ordem estavel entre execucoes.
 */
export function sortPendingItems(items: PendingItem[]) {
  return [...items].sort((left, right) => {
    const bySeverity =
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byDeadline = compareDeadline(left.deadlineAt, right.deadlineAt);
    if (byDeadline !== 0) {
      return byDeadline;
    }

    const byMoney = (right.moneyCents ?? -1) - (left.moneyCents ?? -1);
    if (byMoney !== 0) {
      return byMoney;
    }

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function compareDeadline(left: number | null, right: number | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

export function buildPendingsCounts(items: PendingItem[]): PendingsCounts {
  const byDomain = Object.fromEntries(
    PENDING_DOMAIN_OPTIONS.map((domain) => [domain, 0])
  ) as Record<(typeof PENDING_DOMAIN_OPTIONS)[number], number>;
  const bySeverity = Object.fromEntries(
    PENDING_SEVERITY_OPTIONS.map((severity) => [severity, 0])
  ) as Record<PendingSeverity, number>;

  for (const item of items) {
    byDomain[item.domain] += 1;
    bySeverity[item.severity] += 1;
  }

  return { byDomain, bySeverity, total: items.length };
}

/** Dono do recibo de dispensa: o MESMO ator ativo que pede a leitura. */
export type PendingsActorRef = { id: string; kind: PendingScope };

/**
 * Recibo de dispensa como ele vive na tabela `pendingDismissal`: o snapshot
 * (severidade, contagem e prazo) e o que decide se o item segue escondido.
 */
export type PendingDismissalReceipt = {
  actorId: string;
  actorKind: PendingScope;
  count: number | null;
  deadlineAt: number | null;
  itemId: string;
  severity: PendingSeverity;
  surface: PendingSurface;
};

/** Snapshot que o recibo congela: o item como o usuario o viu ao dispensar. */
export function buildPendingDismissalSnapshot(item: PendingItem) {
  return {
    count: item.count,
    deadlineAt: item.deadlineAt,
    severity: item.severity,
  };
}

/**
 * Escopo dono do item a partir do id deterministico (`<kind>:<sourceId>`).
 * `null` quando o id nao carrega kind registrado: nao ha pendencia a dispensar.
 */
export function resolvePendingItemScope(itemId: string): PendingScope | null {
  const separator = itemId.indexOf(":");
  const kind = separator > 0 ? itemId.slice(0, separator) : "";

  return Object.hasOwn(PENDING_KIND_SCOPES, kind)
    ? PENDING_KIND_SCOPES[kind as PendingKind]
    : null;
}

/**
 * Esconde o que foi dispensado NAQUELA superficie: recibo de outro ator nao
 * vale e a casa nunca esconde. Recibo MORTO (o item piorou desde a dispensa)
 * fica de fora e o item VOLTA para a tela.
 */
function filterDismissedPendingItems(input: {
  actor: PendingsActorRef;
  items: PendingItem[];
  receipts: readonly PendingDismissalReceipt[];
  surface: PendingSurface;
}) {
  if (input.surface === "house" || input.receipts.length === 0) {
    return input.items;
  }

  const receiptByItemId = new Map<string, PendingDismissalReceipt>();

  for (const receipt of input.receipts) {
    if (
      receipt.actorKind !== input.actor.kind ||
      receipt.actorId !== input.actor.id ||
      receipt.surface !== input.surface
    ) {
      continue;
    }

    receiptByItemId.set(receipt.itemId, receipt);
  }

  if (receiptByItemId.size === 0) {
    return input.items;
  }

  return input.items.filter((item) => {
    const receipt = receiptByItemId.get(item.id);

    if (!receipt) {
      return true;
    }

    // Caso unico conta 1 (`count` nulo); qualquer diferenca no triplete mata o
    // recibo — o recibo so segura o item INTACTO.
    return (
      receipt.severity !== item.severity ||
      (receipt.count ?? 1) !== (item.count ?? 1) ||
      receipt.deadlineAt !== item.deadlineAt
    );
  });
}

/**
 * Fecho da query: esconde o dispensado, ordena, corta no cap, conta o que sobrou
 * e carrega a saturacao das LEITURAS — o UNICO caminho do resultado de
 * `pendings.list`. A dispensa entra ANTES do corte/contagem (nao ocupa vaga).
 */
export function buildPendingsResult(input: {
  dismissals?: {
    actor: PendingsActorRef;
    receipts: readonly PendingDismissalReceipt[];
    surface: PendingSurface;
  };
  items: PendingItem[];
  saturation?: PendingSaturation[];
  scope: PendingScope;
}): PendingsListResult {
  const visible = input.dismissals
    ? filterDismissedPendingItems({ ...input.dismissals, items: input.items })
    : input.items;
  const sorted = sortPendingItems(visible);
  const items = sorted.slice(0, PENDING_ITEM_CAP);

  return {
    counts: buildPendingsCounts(items),
    items,
    saturation: dedupeSaturation(input.saturation ?? []),
    scope: input.scope,
    truncated: sorted.length > items.length,
  };
}

/** Um kind saturado aparece UMA vez, com o menor cap que o cortou. */
function dedupeSaturation(saturation: PendingSaturation[]) {
  const byKind = new Map<string, PendingSaturation>();

  for (const entry of saturation) {
    const current = byKind.get(entry.kind);

    if (!current || entry.limit < current.limit) {
      byKind.set(entry.kind, entry);
    }
  }

  return [...byKind.values()].sort((left, right) =>
    left.kind < right.kind ? -1 : 1
  );
}
