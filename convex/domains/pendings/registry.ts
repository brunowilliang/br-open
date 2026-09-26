import { isActiveActorManager, type ViewerActor } from "../auth/actor-context";
import { buildPlayerProfileDisplayName } from "../player/identity";
import {
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  type TournamentEntryPendingView,
  type TournamentOrganizerPendingView,
} from "../tournament/pendings-rules";
import type { QueryCtx } from "../../functions/generated/server";
import type { Id } from "../../functions/_generated/dataModel";
import type { AuthenticatedCtx } from "../../lib/crpc";
import type {
  PendingsListResult,
  PendingItem,
  PendingKind,
  PendingSaturation,
  PendingScope,
  PendingSurface,
} from "./contract";
import { PENDING_KIND_SCOPES } from "./contract";
import {
  buildPendingsResult,
  type PendingsActorRef,
  type PendingDismissalReceipt,
} from "./pendings-rules";

// ---------------------------------------------------------------------------
// Registro das pendencias
// ---------------------------------------------------------------------------
// `pendings.list` resolve o ATOR no servidor e chama os derivadores do escopo
// pedido. Cada derivador LE o minimo via `ctx.orm` e delega a copy para as
// regras puras de `domains/<dono>/pendings-rules.ts`; o resultado passa sempre
// pelo mesmo fecho (`buildPendingsResult`: ordena, corta no cap, conta). Nenhum
// scan ilimitado: todo cap e declarado abaixo.

const PLAYER_ENTRY_SCAN_LIMIT = 100;
const ORG_TOURNAMENT_SCAN_LIMIT = 50;
/** Torneios cujas inscricoes sao varridas, dos mais recentes para os mais antigos. */
const ORG_TOURNAMENT_ENTRY_LIMIT = 20;
const ORG_CATEGORY_SCAN_LIMIT = 10;
const ORG_ENTRY_SCAN_LIMIT = 300;
/** Recibos de dispensa lidos por ator/superficie (cap do ator, nao da casa). */
const PENDING_DISMISSAL_SCAN_LIMIT = 200;

export type PendingsReadCtx = AuthenticatedCtx<QueryCtx>;

export type PendingsActor =
  | { kind: "organization"; organizationId: Id<"organization"> }
  | { kind: "player"; playerProfileId: Id<"playerProfile"> };

export type PendingsDerivation = {
  items: PendingItem[];
  saturations: PendingSaturation[];
};

export type PendingsDeriver = {
  derive: (
    ctx: PendingsReadCtx,
    actor: PendingsActor,
    nowMs: number
  ) => Promise<PendingsDerivation>;
  /** Kinds que ESTE derivador pode emitir (completude auditada por teste). */
  kinds: readonly PendingKind[];
};

/**
 * `null` = sem pendencia: conta sem perfil de jogador nao tem escopo, e o escopo
 * da ORGANIZACAO e do MANAGER — member puro NAO recebe pendencia de organizacao.
 */
export function resolvePendingsActor(
  viewerActor: Pick<ViewerActor, "id" | "kind" | "role">
): PendingsActor | null {
  if (viewerActor.kind === "player") {
    return {
      kind: "player",
      playerProfileId: viewerActor.id as Id<"playerProfile">,
    };
  }

  return isActiveActorManager(viewerActor)
    ? {
        kind: "organization",
        organizationId: viewerActor.id as Id<"organization">,
      }
    : null;
}

/**
 * O recibo pertence ao ATOR (dono da pendencia), nao a sessao que dispensou: os
 * dois gestores da mesma organizacao veem o mesmo item escondido.
 */
export function toPendingActorRef(actor: PendingsActor): PendingsActorRef {
  return actor.kind === "player"
    ? { id: actor.playerProfileId as string, kind: "player" }
    : { id: actor.organizationId as string, kind: "organization" };
}

const PLAYER_ENTRY_KINDS: readonly PendingKind[] = [
  "player_tournament_entries_awaiting_payment",
  "player_tournament_entry_awaiting_approval",
  "player_tournament_partner_invite_received",
  "player_tournament_partner_invite_sent",
];
const ORG_ENTRY_KINDS: readonly PendingKind[] = [
  "organization_tournament_entries_awaiting_approval",
  "organization_tournament_entries_awaiting_payment",
];

/**
 * `markIfFull` marca os kinds da leitura que encheu o cap: a leitura cheia NAO
 * prova que ha mais, mas e o unico aviso honesto de que o dado pode ter sobrado.
 */
export function createSaturationCollector() {
  const saturations: PendingSaturation[] = [];

  return {
    markIfFull(kinds: readonly PendingKind[], rows: unknown[], limit: number) {
      if (rows.length >= limit) {
        for (const kind of kinds) {
          saturations.push({ kind, limit });
        }
      }
    },
    saturations,
  };
}

/** Torneios em que uma inscricao ainda pode virar ativa (registro/andamento). */
const ORG_ENTRY_TOURNAMENT_STATUSES = ["published", "drawn", "ongoing"];

/**
 * Escopo do jogador: as PROPRIAS inscricoes de torneio (convite recebido e
 * enviado, aguardando aprovacao e aguardando pagamento). Sem indice de
 * `tournamentEntry` por jogador (follow-up declarado), a leitura e o scan
 * limitado do mesmo padrao ja shipado (`discovery.listParticipating`).
 */
async function collectPlayerEntryPendings(
  ctx: PendingsReadCtx,
  actor: PendingsActor
): Promise<PendingsDerivation> {
  const saturation = createSaturationCollector();

  if (actor.kind !== "player") {
    return { items: [], saturations: [] };
  }

  const [asPlayerA, asPlayerB] = await Promise.all([
    ctx.orm.query.tournamentEntry.findMany({
      limit: PLAYER_ENTRY_SCAN_LIMIT,
      orderBy: { createdAt: "desc" },
      where: { playerAId: actor.playerProfileId },
    }),
    ctx.orm.query.tournamentEntry.findMany({
      limit: PLAYER_ENTRY_SCAN_LIMIT,
      orderBy: { createdAt: "desc" },
      where: { playerBId: actor.playerProfileId },
    }),
  ]);
  saturation.markIfFull(
    PLAYER_ENTRY_KINDS,
    [...asPlayerA, ...asPlayerB],
    PLAYER_ENTRY_SCAN_LIMIT
  );

  const entries = [
    ...new Map(
      [...asPlayerA, ...asPlayerB].map((entry) => [entry.id as string, entry])
    ).values(),
  ].filter(
    (entry) =>
      entry.status === "awaiting_payment" ||
      entry.status === "pending_approval" ||
      entry.status === "pending_partner"
  );

  if (entries.length === 0) {
    return { items: [], saturations: saturation.saturations };
  }

  const categoryIds = [
    ...new Set(entries.map((entry) => entry.categoryId as string)),
  ] as Id<"tournamentCategory">[];
  // Lote dimensionado pela propria lista de ids (nunca corta o que ja foi lido).
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: categoryIds.length,
    where: { id: { in: categoryIds } },
  });
  const categoryById = new Map(
    categories.map((category) => [category.id as string, category])
  );

  const tournamentIds = [
    ...new Set(categories.map((category) => category.tournamentId as string)),
  ] as Id<"tournament">[];
  const tournaments = await ctx.orm.query.tournament.findMany({
    limit: tournamentIds.length,
    where: { id: { in: tournamentIds } },
  });
  const tournamentById = new Map(
    tournaments.map((row) => [row.id as string, row])
  );

  const profileIds = [
    ...new Set(
      entries.flatMap((entry) =>
        [entry.playerAId, entry.playerBId].filter(
          (id): id is Id<"playerProfile"> => id !== null
        )
      )
    ),
  ];
  const profiles = await ctx.orm.query.playerProfile.findMany({
    limit: profileIds.length,
    where: { id: { in: profileIds } },
  });
  const profileUserIds = [
    ...new Set(profiles.map((profile) => profile.userId as string)),
  ] as Id<"user">[];
  const users =
    profileUserIds.length > 0
      ? await ctx.orm.query.user.findMany({
          limit: profileUserIds.length,
          where: { id: { in: profileUserIds } },
        })
      : [];
  const userById = new Map(users.map((row) => [row.id as string, row]));

  // A copy NOMEIA o perfil pela cadeia de `buildPlayerProfileDisplayName`: sem
  // `fullName` ainda rende apelido, nome da conta ou `Jogador#NNNN` — o convite
  // nunca morre por dado incompleto.
  const nameByProfileId = new Map(
    profiles.map((profile) => [
      profile.id as string,
      buildPlayerProfileDisplayName({
        fullName: profile.fullName,
        name: userById.get(profile.userId as string)?.name,
        nickname: profile.nickname,
        userId: profile.userId as string,
      }),
    ])
  );

  const views: TournamentEntryPendingView[] = [];

  for (const entry of entries) {
    const category = categoryById.get(entry.categoryId as string);
    const currentTournament = category
      ? tournamentById.get(category.tournamentId as string)
      : undefined;

    if (!(category && currentTournament)) {
      continue;
    }

    const inviterName = nameByProfileId.get(entry.playerAId as string) ?? "";
    const invitedName = entry.playerBId
      ? (nameByProfileId.get(entry.playerBId as string) ?? "")
      : "";
    const isCreator = entry.playerAId === actor.playerProfileId;
    const isInvited = entry.playerBId === actor.playerProfileId;

    views.push({
      categoryDisplayName: category.displayName,
      entryFeeCents: category.entryFeeCents,
      entryId: entry.id as string,
      invitedName,
      inviterName,
      isCreator,
      isInvited,
      registrationDeadlineAtMs:
        currentTournament.registrationDeadlineAt.getTime(),
      status: entry.status,
      tournamentId: currentTournament.id as string,
      tournamentName: currentTournament.name,
    });
  }

  return {
    items: buildPlayerEntryPendings({ entries: views }),
    saturations: saturation.saturations,
  };
}

/**
 * Inscricoes aguardando aprovacao e aguardando pagamento por torneio. So
 * torneios em que a inscricao ainda pode virar ativa entram (publicado, sorteado
 * ou em andamento): encerrado ou cancelado nao tem mais acao possivel.
 */
async function collectOrgEntryPendings(
  ctx: PendingsReadCtx,
  actor: PendingsActor
): Promise<PendingsDerivation> {
  const saturation = createSaturationCollector();

  if (actor.kind !== "organization") {
    return { items: [], saturations: [] };
  }

  const tournaments = await ctx.orm.query.tournament.findMany({
    limit: ORG_TOURNAMENT_SCAN_LIMIT,
    orderBy: { updatedAt: "desc" },
    where: { organizationId: actor.organizationId },
  });
  saturation.markIfFull(
    ORG_ENTRY_KINDS,
    tournaments,
    ORG_TOURNAMENT_SCAN_LIMIT
  );
  const relevant = tournaments
    .filter((row) => ORG_ENTRY_TOURNAMENT_STATUSES.includes(row.status))
    .slice(0, ORG_TOURNAMENT_ENTRY_LIMIT);
  // O corte dos torneios varridos tambem e sinalizado: pendencia de torneio
  // antigo (fora dos N mais recentes) nao aparece.
  if (relevant.length >= ORG_TOURNAMENT_ENTRY_LIMIT) {
    saturation.markIfFull(
      ORG_ENTRY_KINDS,
      relevant,
      ORG_TOURNAMENT_ENTRY_LIMIT
    );
  }

  const views: TournamentOrganizerPendingView[] = [];

  for (const currentTournament of relevant) {
    const tournamentId = currentTournament.id as Id<"tournament">;
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: ORG_CATEGORY_SCAN_LIMIT,
      orderBy: { createdAt: "desc" },
      where: { tournamentId },
    });
    saturation.markIfFull(ORG_ENTRY_KINDS, categories, ORG_CATEGORY_SCAN_LIMIT);

    let awaitingApprovalCount = 0;
    let awaitingPaymentCount = 0;
    let awaitingPaymentFeeCents = 0;

    for (const category of categories) {
      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: ORG_ENTRY_SCAN_LIMIT,
        orderBy: { createdAt: "desc" },
        where: {
          categoryId: category.id as Id<"tournamentCategory">,
          status: { in: ["awaiting_payment", "pending_approval"] },
        },
      });
      // Contagens do titulo: cap cheio = a categoria pode ter mais inscricoes.
      saturation.markIfFull(ORG_ENTRY_KINDS, entries, ORG_ENTRY_SCAN_LIMIT);

      for (const entry of entries) {
        if (entry.status === "pending_approval") {
          awaitingApprovalCount += 1;
        } else {
          awaitingPaymentCount += 1;
          awaitingPaymentFeeCents += category.entryFeeCents;
        }
      }
    }

    if (awaitingApprovalCount + awaitingPaymentCount > 0) {
      views.push({
        awaitingApprovalCount,
        awaitingPaymentCount,
        awaitingPaymentFeeCents,
        registrationDeadlineAtMs:
          currentTournament.registrationDeadlineAt.getTime(),
        tournamentId: tournamentId as string,
        tournamentName: currentTournament.name,
      });
    }
  }

  return {
    items: buildOrganizerEntryPendings({ tournaments: views }),
    saturations: saturation.saturations,
  };
}

/**
 * `kinds` e explicito (nao derivado do contrato): completude e ausencia de
 * duplicata sao auditadas por teste.
 */
const PLAYER_PENDING_DERIVERS: readonly PendingsDeriver[] = [
  {
    derive: collectPlayerEntryPendings,
    kinds: [
      "player_tournament_entries_awaiting_payment",
      "player_tournament_entry_awaiting_approval",
      "player_tournament_partner_invite_received",
      "player_tournament_partner_invite_sent",
    ],
  },
];

/** Derivadores do escopo da ORGANIZACAO. */
const ORGANIZATION_PENDING_DERIVERS: readonly PendingsDeriver[] = [
  {
    derive: collectOrgEntryPendings,
    kinds: [
      "organization_tournament_entries_awaiting_approval",
      "organization_tournament_entries_awaiting_payment",
    ],
  },
];

export const PENDING_DERIVERS: Record<
  PendingScope,
  readonly PendingsDeriver[]
> = {
  organization: ORGANIZATION_PENDING_DERIVERS,
  player: PLAYER_PENDING_DERIVERS,
};

/**
 * A casa NUNCA esconde (o gesto so existe na home), entao nem le a tabela de
 * recibos; a leitura e pelo indice do ator e limitada.
 */
export async function findPendingDismissals(input: {
  actor: PendingsActor;
  ctx: PendingsReadCtx;
  surface: PendingSurface;
}): Promise<PendingDismissalReceipt[]> {
  if (input.surface === "house") {
    return [];
  }

  const actor = toPendingActorRef(input.actor);

  return await input.ctx.orm.query.pendingDismissal.findMany({
    limit: PENDING_DISMISSAL_SCAN_LIMIT,
    orderBy: { itemId: "asc" },
    where: {
      actorId: actor.id,
      actorKind: actor.kind,
      surface: input.surface,
    },
  });
}

/**
 * Derivacao CRUA do escopo pedido: confere que cada item saiu no escopo em que o
 * kind foi registrado (fio errado vira erro, nunca pendencia no escopo errado) e
 * devolve o array SEM filtro de dispensa e SEM corte — a base da leitura e da
 * poda do write-path olham o MESMO universo.
 */
export async function derivePendings(input: {
  actor: PendingsActor;
  ctx: PendingsReadCtx;
  nowMs: number;
  scope: PendingScope;
}): Promise<PendingsDerivation> {
  const derivations = await Promise.all(
    PENDING_DERIVERS[input.scope].map((deriver) =>
      deriver.derive(input.ctx, input.actor, input.nowMs)
    )
  );
  const items = derivations.flatMap((derivation) => derivation.items);

  for (const item of items) {
    if (PENDING_KIND_SCOPES[item.kind] !== input.scope) {
      throw new Error(
        `Pendencia ${item.kind} emitida no escopo ${input.scope}, mas registrada em ${PENDING_KIND_SCOPES[item.kind]}.`
      );
    }
  }

  return {
    items,
    saturations: derivations.flatMap((derivation) => derivation.saturations),
  };
}

export async function collectPendings(input: {
  actor: PendingsActor;
  ctx: PendingsReadCtx;
  dismissals?: {
    receipts: readonly PendingDismissalReceipt[];
    surface: PendingSurface;
  };
  nowMs: number;
  scope: PendingScope;
}): Promise<PendingsListResult> {
  const derivation = await derivePendings(input);

  return buildPendingsResult({
    dismissals: input.dismissals
      ? { ...input.dismissals, actor: toPendingActorRef(input.actor) }
      : undefined,
    items: derivation.items,
    saturation: derivation.saturations,
    scope: input.scope,
  });
}
