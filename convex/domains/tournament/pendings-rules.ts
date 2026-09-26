import type { PendingItem } from "../pendings/contract";
import {
  buildPendingItemId,
  countNoun,
  openRouteAction,
  pendingHighlight,
} from "../pendings/pendings-rules";

// ---------------------------------------------------------------------------
// Pendencias do dominio de TORNEIO
// ---------------------------------------------------------------------------
//
// Regras PURAS (dado -> item, sem ctx) — copy literal, nao reescrever os textos.
// O titulo dos agregados pluraliza como a TELA ja pluraliza hoje
// (`pages/tournaments/player-overview.tsx:108-117` e organizer-overview.tsx).
//
// Quem responde ao convite e o `playerBId` (lado convidado, o mesmo gate do
// `respondPartnerInvite`); quem paga a inscricao e o lado A (o criador, o
// mesmo gate do `canPay` da casa do jogador).

/** Uma inscricao do viewer ja resolvida com os rotulos que a copy usa. */
export type TournamentEntryPendingView = {
  categoryDisplayName: string;
  entryFeeCents: number;
  entryId: string;
  invitedName: string;
  /** Lado A: criou a inscricao (paga e convida). */
  isCreator: boolean;
  /** Lado B: foi convidado (responde ao convite). */
  isInvited: boolean;
  inviterName: string;
  registrationDeadlineAtMs: null | number;
  status: string;
  tournamentId: string;
  tournamentName: string;
};

/** Todas as inscricoes DELE (dos dois lados) do torneio, em um item por caso. */
export function buildPlayerEntryPendings(input: {
  entries: TournamentEntryPendingView[];
}): PendingItem[] {
  const items: PendingItem[] = [];
  const awaitingPaymentByTournament = new Map<
    string,
    TournamentEntryPendingView[]
  >();

  for (const entry of input.entries) {
    if (entry.status === "awaiting_payment" && entry.isCreator) {
      const bucket = awaitingPaymentByTournament.get(entry.tournamentId) ?? [];
      bucket.push(entry);
      awaitingPaymentByTournament.set(entry.tournamentId, bucket);
      continue;
    }
    if (entry.status !== "pending_partner") {
      if (entry.status === "pending_approval") {
        items.push({
          action: null,
          actionLabel: null,
          count: null,
          deadlineAt: entry.registrationDeadlineAtMs,
          description:
            "O organizador precisa liberar sua inscrição para você entrar na chave.",
          domain: "tournament",
          id: buildPendingItemId(
            "player_tournament_entry_awaiting_approval",
            entry.entryId
          ),
          kind: "player_tournament_entry_awaiting_approval",
          moneyCents: entry.entryFeeCents,
          // CONTEXTO (nao destino): o recorte da casa do torneio le o
          // params.tournamentId, e a acao do item nem existe.
          params: { tournamentId: entry.tournamentId },
          route: "/tournaments/[tournamentId]",
          secondaryAction: null,
          secondaryActionLabel: null,
          severity: "info",
          source: { id: entry.entryId, type: "tournament_entry" },
          title: "Inscrição aguardando aprovação",
        });
      }
      continue;
    }

    if (entry.isInvited) {
      // A copy do convite nomeia quem convidou no destaque: sem o nome nao ha
      // como escrever a pendencia (mesma degradacao do card sem nome na tela).
      if (!entry.inviterName) {
        continue;
      }

      items.push({
        action: {
          params: { entryId: entry.entryId },
          type: "accept_partner_invite",
        },
        actionLabel: "Aceitar",
        count: null,
        deadlineAt: entry.registrationDeadlineAtMs,
        description: [
          {
            parts: [
              pendingHighlight(entry.inviterName),
              {
                text: ` convidou você para jogar ${entry.categoryDisplayName} na ${entry.tournamentName}.`,
              },
            ],
          },
        ],
        domain: "tournament",
        id: buildPendingItemId(
          "player_tournament_partner_invite_received",
          entry.entryId
        ),
        kind: "player_tournament_partner_invite_received",
        moneyCents: entry.entryFeeCents,
        // CONTEXTO da entidade (o recorte da casa do torneio le o
        // params.tournamentId). O ALVO da mutacao segue em action.params.
        params: { tournamentId: entry.tournamentId },
        route: "/tournaments/[tournamentId]",
        secondaryAction: {
          params: { entryId: entry.entryId },
          type: "decline_partner_invite",
        },
        secondaryActionLabel: "Recusar",
        severity: "info",
        source: { id: entry.entryId, type: "tournament_entry" },
        title: "Convite de dupla aguardando sua resposta",
      });
      continue;
    }

    if (entry.isCreator) {
      // Mesma regra do convite recebido: a copy do enviado nomeia o convidado.
      if (!entry.invitedName) {
        continue;
      }

      items.push({
        action: null,
        actionLabel: null,
        count: null,
        deadlineAt: entry.registrationDeadlineAtMs,
        description: [
          {
            parts: [
              { text: "Aguardando " },
              pendingHighlight(entry.invitedName),
              {
                text: ` aceitar o convite para ${entry.categoryDisplayName} na ${entry.tournamentName}.`,
              },
            ],
          },
        ],
        domain: "tournament",
        id: buildPendingItemId(
          "player_tournament_partner_invite_sent",
          entry.entryId
        ),
        kind: "player_tournament_partner_invite_sent",
        moneyCents: entry.entryFeeCents,
        // CONTEXTO: mesmo sem CTA, o item pertence a casa daquele torneio.
        params: { tournamentId: entry.tournamentId },
        route: "/tournaments/[tournamentId]",
        secondaryAction: null,
        secondaryActionLabel: null,
        severity: "info",
        source: { id: entry.entryId, type: "tournament_entry" },
        title: "Convite de dupla enviado",
      });
    }
  }

  for (const [tournamentId, entries] of awaitingPaymentByTournament) {
    const deadlines = entries
      .map((entry) => entry.registrationDeadlineAtMs)
      .filter((deadline): deadline is number => deadline !== null);

    // Uma inscricao so: a acao e EXATAMENTE a do botao da tela (pagar a
    // inscricao). Mais de uma: nao existe pagamento unico de N inscricoes (a
    // taxa e por categoria), entao o CTA abre a casa do torneio, onde cada
    // inscricao tem o seu Pagar.
    const [onlyEntry] = entries;
    const isSingle = entries.length === 1 && onlyEntry !== undefined;

    items.push({
      action: isSingle
        ? {
            params: { entryId: onlyEntry.entryId },
            type: "pay_tournament_entry",
          }
        : openRouteAction(),
      actionLabel: "Pagar",
      count: entries.length,
      deadlineAt: deadlines.length > 0 ? Math.min(...deadlines) : null,
      description: "Confirme o pagamento para garantir sua vaga na chave.",
      domain: "tournament",
      id: buildPendingItemId(
        "player_tournament_entries_awaiting_payment",
        tournamentId
      ),
      kind: "player_tournament_entries_awaiting_payment",
      moneyCents: entries.reduce(
        (total, entry) => total + entry.entryFeeCents,
        0
      ),
      params: isSingle ? null : { tournamentId },
      route: isSingle ? null : "/tournaments/[tournamentId]",
      secondaryAction: null,
      secondaryActionLabel: null,
      severity: "warning",
      source: { id: tournamentId, type: "tournament" },
      title: countNoun(
        entries.length,
        "inscrição aguardando pagamento",
        "inscrições aguardando pagamento"
      ),
    });
  }

  return items;
}

/** Um torneio da organizacao com as contagens que os alertas dela mostram. */
export type TournamentOrganizerPendingView = {
  awaitingApprovalCount: number;
  awaitingPaymentCount: number;
  /** Soma das taxas ainda nao pagas desse torneio (o dinheiro parado). */
  awaitingPaymentFeeCents: number;
  registrationDeadlineAtMs: null | number;
  tournamentId: string;
  tournamentName: string;
};

/** Pendencias do ORGANIZADOR por torneio: aprovacao e pagamento. */
export function buildOrganizerEntryPendings(input: {
  tournaments: TournamentOrganizerPendingView[];
}): PendingItem[] {
  const items: PendingItem[] = [];

  for (const tournament of input.tournaments) {
    const entriesRoute = "/tournaments/[tournamentId]/entries";
    const params = {
      initialTab: "pending",
      tournamentId: tournament.tournamentId,
    };

    if (tournament.awaitingApprovalCount > 0) {
      items.push({
        action: openRouteAction(),
        actionLabel: "Ver",
        count: tournament.awaitingApprovalCount,
        deadlineAt: tournament.registrationDeadlineAtMs,
        description: "Revise para liberar ou recusar quem entra na chave.",
        domain: "tournament",
        id: buildPendingItemId(
          "organization_tournament_entries_awaiting_approval",
          tournament.tournamentId
        ),
        kind: "organization_tournament_entries_awaiting_approval",
        moneyCents: null,
        params,
        route: entriesRoute,
        secondaryAction: null,
        secondaryActionLabel: null,
        severity: "info",
        source: { id: tournament.tournamentId, type: "tournament" },
        title: countNoun(
          tournament.awaitingApprovalCount,
          "inscrição aguardando aprovação",
          "inscrições aguardando aprovação"
        ),
      });
    }

    if (tournament.awaitingPaymentCount > 0) {
      items.push({
        action: openRouteAction(),
        actionLabel: "Ver",
        count: tournament.awaitingPaymentCount,
        deadlineAt: tournament.registrationDeadlineAtMs,
        description: "A vaga entra na chave depois do pagamento confirmado.",
        domain: "tournament",
        id: buildPendingItemId(
          "organization_tournament_entries_awaiting_payment",
          tournament.tournamentId
        ),
        kind: "organization_tournament_entries_awaiting_payment",
        moneyCents: tournament.awaitingPaymentFeeCents,
        params,
        route: entriesRoute,
        secondaryAction: null,
        secondaryActionLabel: null,
        severity: "warning",
        source: { id: tournament.tournamentId, type: "tournament" },
        title: countNoun(
          tournament.awaitingPaymentCount,
          "inscrição aguardando pagamento",
          "inscrições aguardando pagamento"
        ),
      });
    }
  }

  return items;
}

/** Torneio que a organizacao precisa ENCERRAR: toda categoria ja tem campeao. */
export type TournamentOrganizerConclusionPendingView = {
  /** Vem da regra pura `canConcludeTournament` (o item e estado, nao lembrete). */
  canConclude: boolean;
  tournamentId: string;
  tournamentName: string;
};

/**
 * Pendencia do ORGANIZADOR de encerrar o torneio: a competicao acabou e o
 * `finished` e ato dele, entao o item existe enquanto ele nao concluir. O alvo da
 * acao e o torneio; o item nao navega (o CTA e a propria conclusao).
 */
export function buildOrganizerConclusionPendings(input: {
  tournaments: readonly TournamentOrganizerConclusionPendingView[];
}): PendingItem[] {
  return input.tournaments
    .filter((tournament) => tournament.canConclude)
    .map((tournament) => ({
      action: {
        params: { tournamentId: tournament.tournamentId },
        type: "conclude_tournament" as const,
      },
      actionLabel: "Concluir",
      count: null,
      deadlineAt: null,
      description: `${tournament.tournamentName} já tem campeão em todas as categorias. Conclua para definir o resultado final.`,
      domain: "tournament" as const,
      id: buildPendingItemId(
        "organization_tournament_awaiting_conclusion",
        tournament.tournamentId
      ),
      kind: "organization_tournament_awaiting_conclusion" as const,
      moneyCents: null,
      params: null,
      route: null,
      secondaryAction: null,
      secondaryActionLabel: null,
      severity: "warning" as const,
      source: { id: tournament.tournamentId, type: "tournament" as const },
      title: "Concluir torneio",
    }));
}
