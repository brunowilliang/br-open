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
// Regras puras compartilhadas do sistema de pendencias
// ---------------------------------------------------------------------------
// Sem ctx, sem tabela, sem Convex: tudo aqui e funcao de dado -> dado, testavel
// isolado. As regras POR DOMINIO (copy + destaque de cada kind) vivem em
// `domains/<dono>/pendings-rules.ts`; aqui fica o que e comum a todos:
// identidade, ordem, cap, contagens e a gramatica das partes/linhas.

/**
 * Os itens vem ORDENADOS antes do corte, as contagens saem do array JA cortado e
 * `truncated` avisa o corte: badge e lista nunca divergem.
 */
export const PENDING_ITEM_CAP = 20;

/** Ordem de severidade: quem deve a acao mais urgente primeiro. */
const SEVERITY_RANK: Record<PendingSeverity, number> = {
  danger: 0,
  info: 2,
  warning: 1,
};

export function pendingHighlight(text: string) {
  return { isHighlighted: true as const, text };
}

export function countNoun(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildPendingItemId(kind: string, sourceId: string) {
  return `${kind}:${sourceId}`;
}

export function openRouteAction() {
  return { params: null, type: "open_route" as const };
}

/**
 * Ordem determinista: severidade (danger > warning > info), `deadlineAt`
 * ascendente (sem prazo vai por ultimo), `moneyCents` descendente e `id`
 * ascendente como desempate final estavel entre execucoes.
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
 * Recibo como ele vive na tabela `pendingDismissal`: o snapshot (severidade,
 * contagem e prazo) e o que decide se o item segue escondido.
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
 * Classificacao UNICA dos recibos do ator naquela superficie, servindo as duas
 * pontas: `hiddenIds` e o que a LEITURA esconde (recibo vivo = item intacto nos
 * tres campos do snapshot; roda antes do corte) e `dead` e o que ela ja ignora —
 * item fora da derivacao ou snapshot que nao casa — e a poda pode apagar. A casa
 * nunca esconde e recibo de outro ator/superficie nao entra em nenhum dos dois.
 */
function classifyPendingDismissals(input: {
  actor: PendingsActorRef;
  items: readonly PendingItem[];
  receipts: readonly PendingDismissalReceipt[];
  surface: PendingSurface;
}): { dead: PendingDismissalReceipt[]; hiddenIds: Set<string> } {
  const dead: PendingDismissalReceipt[] = [];
  const hiddenIds = new Set<string>();

  if (input.surface === "house") {
    return { dead, hiddenIds };
  }

  const itemById = new Map(input.items.map((item) => [item.id, item]));

  for (const receipt of input.receipts) {
    if (
      receipt.actorKind !== input.actor.kind ||
      receipt.actorId !== input.actor.id ||
      receipt.surface !== input.surface
    ) {
      continue;
    }

    const item = itemById.get(receipt.itemId);
    const isAlive =
      item !== undefined &&
      receipt.severity === item.severity &&
      (receipt.count ?? 1) === (item.count ?? 1) &&
      receipt.deadlineAt === item.deadlineAt;

    if (isAlive) {
      hiddenIds.add(receipt.itemId);
    } else {
      dead.push(receipt);
    }
  }

  return { dead, hiddenIds };
}

function filterDismissedPendingItems(input: {
  actor: PendingsActorRef;
  items: PendingItem[];
  receipts: readonly PendingDismissalReceipt[];
  surface: PendingSurface;
}) {
  if (input.surface === "house" || input.receipts.length === 0) {
    return input.items;
  }

  const { hiddenIds } = classifyPendingDismissals(input);

  return hiddenIds.size === 0
    ? input.items
    : input.items.filter((item) => !hiddenIds.has(item.id));
}

export function selectDeadPendingDismissals(input: {
  actor: PendingsActorRef;
  items: readonly PendingItem[];
  receipts: readonly PendingDismissalReceipt[];
  surface: PendingSurface;
}): PendingDismissalReceipt[] {
  return classifyPendingDismissals(input).dead;
}

/**
 * O UNICO caminho do resultado de `pendings.list`. A dispensa entra ANTES do
 * corte/contagem: item escondido nao ocupa vaga da lista.
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
