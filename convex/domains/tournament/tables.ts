import {
  boolean,
  convexTable,
  id,
  index,
  integer,
  json,
  text,
  timestamp,
  uniqueIndex,
} from "kitcn/orm";

import * as authTables from "../auth/tables";
import * as playerTables from "../player/tables";

export const tournament = convexTable(
  "tournament",
  {
    // Nasce LIGADO (DEFAULT_ALLOW_MULTIPLE_ENTRIES_PER_TYPE): desligado, o
    // servidor barra nova inscricao do jogador que ja tem uma viva no tipo.
    allowMultipleEntriesPerType: boolean().notNull(),
    approvalMode: text(),
    avatarStorageId: text(),
    city: text().notNull(),
    courts: json<Record<string, unknown>[]>(),
    coverStorageId: text(),
    createdAt: timestamp().notNull(),
    description: text(),
    // Último dia do torneio: com fim, marcar jogo fora do intervalo é recusado
    // (a comparação é por dia). Sem fim, o torneio segue sem teto.
    endDate: timestamp(),
    locationNotes: text(),
    // Format of the matches (same shape as the `domains/match` config).
    matchConfig: json<Record<string, unknown>>().notNull(),
    maxEntriesHint: integer(),
    name: text().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    // BR-Open platform fee override for this tournament (0-100), the same
    // override DECISAO-004 defines for every paid surface. Null falls back to
    // DEFAULT_PLATFORM_FEE_PERCENT; set via Convex dashboard.
    platformFeePercent: integer(),
    // Inscriptions open until this instant (draw closes them earlier).
    registrationDeadlineAt: timestamp().notNull(),
    startDate: timestamp().notNull(),
    state: text().notNull(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
    visibility: text().notNull(),
    // Dia do último aviso "a janela venceu e tem jogo sem horário": o cron avisa
    // uma vez por dia enquanto o torneio não terminar.
    windowNoticeSentAt: timestamp(),
  },
  (tournament) => [
    index("organizationId").on(tournament.organizationId),
    index("status").on(tournament.status),
  ]
);

export const tournamentCategory = convexTable(
  "tournamentCategory",
  {
    createdAt: timestamp().notNull(),
    entryFeeCents: integer().notNull(),
    gender: text().notNull(),
    maxEntries: integer(),
    modality: text().notNull(),
    // Nome LIVRE do organizador; e o rotulo da categoria no app inteiro.
    name: text().notNull(),
    // `name` normalizado (trim + caixa baixa pt-BR) para a unicidade abaixo.
    nameKey: text().notNull(),
    tournamentId: id("tournament")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    updatedAt: timestamp().notNull(),
  },
  (tournamentCategory) => [
    index("tournamentId").on(tournamentCategory.tournamentId),
    // Mesmo nome (normalizado) no MESMO tipo nao repete dentro do torneio;
    // tipos diferentes e nomes diferentes coexistem a vontade.
    uniqueIndex("tournamentId_modality_gender_nameKey").on(
      tournamentCategory.tournamentId,
      tournamentCategory.modality,
      tournamentCategory.gender,
      tournamentCategory.nameKey
    ),
  ]
);

export const tournamentEntry = convexTable(
  "tournamentEntry",
  {
    // Reserva de vaga espelhada: preenchida enquanto a inscrição está viva
    // (ver ENTRY_LIVE_STATUSES) e limpa com unsetToken quando ela termina —
    // os índices únicos abaixo são nestas colunas, então cancelar libera a
    // vaga. `playerAId` é NOT NULL de propósito: o histórico fica.
    activeAId: id("playerProfile"),
    activeBId: id("playerProfile"),
    categoryId: id("tournamentCategory")
      .notNull()
      .references(() => tournamentCategory.id, { onDelete: "cascade" }),
    createdAt: timestamp().notNull(),
    // Who created (and pays for) the entry.
    createdByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    // Rodada em que a inscrição entra na chave (null ou 1 = início). Entrada
    // direta depois disso é privilégio de cabeça de chave, validado no
    // sorteio.
    entryRound: integer(),
    // Aviso UNICO ao dono quando o prazo fecha com o convite sem resposta: o
    // cron roda de hora em hora e o campo segura a repeticao.
    partnerAwaitingReplyNotifiedAt: timestamp(),
    partnerUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    playerAId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    // Doubles only — required there, null for singles.
    playerBId: id("playerProfile").references(
      () => playerTables.playerProfile.id,
      { onDelete: "cascade" }
    ),
    // Head of seed marked by the organizer before the draw (1..s).
    seedRank: integer(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (tournamentEntry) => [
    index("categoryId_status").on(
      tournamentEntry.categoryId,
      tournamentEntry.status
    ),
    // Uma inscrição viva reserva cada jogador no máximo uma vez por
    // categoria — garantido no banco pelas colunas espelhadas (a terminal sai
    // do índice, então cancelar libera a vaga). Lado ausente (playerB de
    // simples) não entra no índice.
    uniqueIndex("categoryId_activeAId").on(
      tournamentEntry.categoryId,
      tournamentEntry.activeAId
    ),
    uniqueIndex("categoryId_activeBId").on(
      tournamentEntry.categoryId,
      tournamentEntry.activeBId
    ),
    index("createdByUserId").on(tournamentEntry.createdByUserId),
  ]
);

export const tournamentMatch = convexTable(
  "tournamentMatch",
  {
    categoryId: id("tournamentCategory")
      .notNull()
      .references(() => tournamentCategory.id, { onDelete: "cascade" }),
    courtId: text(),
    createdAt: timestamp().notNull(),
    endMinute: integer(),
    entryAId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
    entryBId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
    // Optional scheduling (date + time window + court).
    matchDate: text(),
    // When set, the result was PUBLISHED by the organizer and the slot is
    // locked for swaps. Draw-time byes set winnerEntryId WITHOUT publishedAt
    // (re-derivable on swap).
    publishedAt: timestamp(),
    round: integer().notNull(),
    // Optimistic concurrency for swap/advance writes.
    rowVersion: integer().notNull(),
    scheduledById: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    score: json<Record<string, unknown>>(),
    slotInRound: integer().notNull(),
    startMinute: integer(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
    walkover: boolean().notNull(),
    winnerEntryId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
  },
  (tournamentMatch) => [
    // Bracket reads: all matches of a category ordered by round/slot.
    uniqueIndex("categoryId_round_slotInRound").on(
      tournamentMatch.categoryId,
      tournamentMatch.round,
      tournamentMatch.slotInRound
    ),
    index("entryAId").on(tournamentMatch.entryAId),
    index("entryBId").on(tournamentMatch.entryBId),
    index("winnerEntryId").on(tournamentMatch.winnerEntryId),
    index("matchDate").on(tournamentMatch.matchDate),
  ]
);

// Auditoria das edições de resultado publicado: uma linha por edição, com o
// snapshot completo antes/depois (placar, vencedor, W.O.), para a chave
// continuar reconstruível.
export const tournamentMatchEdit = convexTable(
  "tournamentMatchEdit",
  {
    after: json<Record<string, unknown>>().notNull(),
    before: json<Record<string, unknown>>().notNull(),
    createdAt: timestamp().notNull(),
    editedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    matchId: id("tournamentMatch")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
  },
  (tournamentMatchEdit) => [index("matchId").on(tournamentMatchEdit.matchId)]
);

// Acerto do confronto: UMA linha por confronto + canal (`schedule`/`score`) com a
// proposta VIGENTE. A linha de estado existe para a leitura e a derivação de
// pendências não refazerem o log; o histórico completo fica em
// `tournamentMatchAgreementEvent`.
export const tournamentMatchAgreement = convexTable(
  "tournamentMatchAgreement",
  {
    agreedAt: timestamp(),
    categoryId: id("tournamentCategory")
      .notNull()
      .references(() => tournamentCategory.id, { onDelete: "cascade" }),
    channel: text().notNull(),
    createdAt: timestamp().notNull(),
    // Lados desnormalizados: a pendência do jogador e o agregado do organizador
    // chegam por índice, sem varrer o quadro.
    entryAId: id("tournamentEntry")
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    entryBId: id("tournamentEntry")
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    matchId: id("tournamentMatch")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    proposal: json<Record<string, unknown>>(),
    proposedAt: timestamp(),
    proposedBySide: text(),
    proposedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    rowVersion: integer().notNull(),
    state: text().notNull(),
    tournamentId: id("tournament")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    updatedAt: timestamp().notNull(),
  },
  (tournamentMatchAgreement) => [
    uniqueIndex("matchId_channel").on(
      tournamentMatchAgreement.matchId,
      tournamentMatchAgreement.channel
    ),
    // Indice da CASCATA: sem ele a ORM recusa apagar a categoria/torneio com
    // acerto gravado (a FK exige indice na coluna filha).
    index("categoryId").on(tournamentMatchAgreement.categoryId),
    index("entryAId_state").on(
      tournamentMatchAgreement.entryAId,
      tournamentMatchAgreement.state
    ),
    index("entryBId_state").on(
      tournamentMatchAgreement.entryBId,
      tournamentMatchAgreement.state
    ),
    index("tournamentId_state").on(
      tournamentMatchAgreement.tournamentId,
      tournamentMatchAgreement.state
    ),
  ]
);

// Histórico append-only do acerto, no molde de `tournamentMatchEdit`: uma linha
// por evento, com o snapshot antes/depois do estado do canal.
export const tournamentMatchAgreementEvent = convexTable(
  "tournamentMatchAgreementEvent",
  {
    actorSide: text().notNull(),
    actorUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    after: json<Record<string, unknown>>().notNull(),
    before: json<Record<string, unknown>>().notNull(),
    channel: text().notNull(),
    createdAt: timestamp().notNull(),
    kind: text().notNull(),
    matchId: id("tournamentMatch")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    tournamentId: id("tournament")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
  },
  (tournamentMatchAgreementEvent) => [
    index("matchId").on(tournamentMatchAgreementEvent.matchId),
    // Indice da CASCATA (mesmo motivo do `categoryId` do acordo).
    index("tournamentId").on(tournamentMatchAgreementEvent.tournamentId),
  ]
);

// Indisponibilidade da agenda (chuva, luz, quadra fechada): fecha o dia
// inteiro, um pedaço dele ou uma quadra específica. `courtId`, `reason` e
// `startMinute`/`endMinute` são OPCIONAIS de propósito: chave ausente = dia
// inteiro / todas as quadras / sem motivo.
export const tournamentUnavailability = convexTable(
  "tournamentUnavailability",
  {
    courtId: text(),
    createdAt: timestamp().notNull(),
    createdByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    date: text().notNull(),
    endMinute: integer(),
    reason: text(),
    startMinute: integer(),
    tournamentId: id("tournament")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
  },
  (tournamentUnavailability) => [
    // Leitura por (torneio, dia) na porta de agendamento e no gerenciador.
    index("tournamentId_date").on(
      tournamentUnavailability.tournamentId,
      tournamentUnavailability.date
    ),
  ]
);
