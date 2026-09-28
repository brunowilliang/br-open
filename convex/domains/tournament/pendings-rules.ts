import type { PendingItem } from "../pendings/contract";
import {
  buildPendingItemId,
  countNoun,
  openRouteAction,
  pendingHighlight,
  pendingItemSignature,
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

/**
 * Lado adversario SEM quem propos: a dupla inteira ("A e B") ou vazio quando
 * so sobra o autor (a frase cai para "para o confronto em <torneio>").
 */
export function formatOpponentSideLabel(
  names: readonly (null | string | undefined)[],
  exclude?: null | string
): string {
  const excluded = exclude?.trim() ?? "";
  const clean = names
    .map((name) => name?.trim() ?? "")
    .filter((name) => name.length > 0 && name !== excluded);

  if (clean.length <= 1) {
    return clean[0] ?? "";
  }

  return `${clean[0]} e ${clean[1]}`;
}

/** Acerto RECEBIDO: o outro lado propôs e espera resposta. */
export type TournamentMatchAgreementPendingView = {
  channel: "schedule" | "score";
  matchId: string;
  /** Nomes do LADO adversario sem o autor da proposta; vazio = só ele. */
  opponentName: string;
  /** O que EXATAMENTE está na mesa: "28/09 às 08:00, na Quadra Central" ou "6-3, 6-2". */
  proposalLabel: string;
  /** Quando a proposta vigente chegou (ms): a assinatura do item sai daqui. */
  proposedAt: number;
  /** Nome de quem propôs (sempre o outro lado). */
  proposerName: string;
  /** `true` = já havia acerto fechado: é pedido de mudança, não proposta. */
  reopened: boolean;
  tournamentId: string;
  tournamentName: string;
};

/**
 * Pendência do jogador com acerto recebido: horário, placar e pedido de mudança.
 * O CTA leva ao confronto, onde aceitar ou propor outro acontece; o item é ESTADO
 * (sai quando o outro lado responde ou o organizador age).
 */
export function buildPlayerMatchAgreementPendings(input: {
  matches: readonly TournamentMatchAgreementPendingView[];
}): PendingItem[] {
  return input.matches.map((match) => {
    const isSchedule = match.channel === "schedule";
    const kind = isSchedule
      ? match.reopened
        ? ("player_tournament_match_reschedule_requested" as const)
        : ("player_tournament_match_schedule_proposed" as const)
      : ("player_tournament_match_score_proposed" as const);
    // Sem nomes sobrando (confronto simples), a frase não repete quem propôs.
    const opponentClause = match.opponentName
      ? ` com ${match.opponentName}`
      : "";

    return {
      // Um toque ACEITA a proposta vigente; o secundário abre o Combinar jogo.
      action: isSchedule
        ? { params: { matchId: match.matchId }, type: "accept_match_schedule" }
        : { params: { matchId: match.matchId }, type: "confirm_match_score" },
      actionLabel: isSchedule ? "Aceitar" : "Confirmar",
      count: null,
      deadlineAt: null,
      description: [
        {
          parts: [
            pendingHighlight(match.proposerName),
            {
              text: isSchedule
                ? match.reopened
                  ? ` sugeriu ${match.proposalLabel} para o confronto${opponentClause} em ${match.tournamentName}.`
                  : ` propôs ${match.proposalLabel} para o confronto${opponentClause} em ${match.tournamentName}.`
                : ` propôs ${match.proposalLabel} para o confronto${opponentClause} em ${match.tournamentName}.`,
            },
          ],
        },
      ],
      domain: "tournament",
      id: buildPendingItemId(kind, match.matchId),
      kind,
      moneyCents: null,
      params: { matchId: match.matchId, tournamentId: match.tournamentId },
      route: "/tournaments/[tournamentId]",
      // Secundário: abre o Combinar jogo (o primário aceita o que está na mesa).
      secondaryAction: openRouteAction(),
      secondaryActionLabel: "Combinar",
      severity: "warning",
      // Proposta nova reescreve o item: a assinatura mata o recibo de dispensa.
      signature: pendingItemSignature([`${match.channel}:${match.proposedAt}`]),
      source: { id: match.matchId, type: "tournament_match" },
      title: isSchedule
        ? match.reopened
          ? "Pedido para mudar o horário"
          : "Horário proposto pelo outro lado"
        : "Placar proposto pelo outro lado",
    };
  });
}

/** Torneio do organizador com acerto ABERTO esperando resposta dos jogadores. */
export type TournamentOrganizerAgreementPendingView = {
  /** Propostas vigentes sem resposta (uma por canal de cada confronto). */
  proposals: readonly {
    channel: "schedule" | "score";
    matchId: string;
    proposedAt: number;
  }[];
  /** Confrontos (nunca canais) com proposta vigente sem resposta. */
  stalledMatchCount: number;
  tournamentId: string;
  tournamentName: string;
};

/**
 * Agregado do ORGANIZADOR: uma pendência por torneio, contando os confrontos com
 * acerto aberto. O organizador sempre pode agendar ou lançar por cima, então o
 * item é o convite para agir — e sai quando o acerto fecha ou ele atropela.
 */
export function buildOrganizerAgreementPendings(input: {
  tournaments: readonly TournamentOrganizerAgreementPendingView[];
}): PendingItem[] {
  return input.tournaments
    .filter((tournament) => tournament.stalledMatchCount > 0)
    .map((tournament) => ({
      action: openRouteAction(),
      actionLabel: "Ver",
      count: tournament.stalledMatchCount,
      deadlineAt: null,
      description:
        "Você pode agendar ou lançar o resultado direto no confronto, sem esperar o Combinar jogo.",
      domain: "tournament" as const,
      id: buildPendingItemId(
        "organization_tournament_matches_awaiting_agreement",
        tournament.tournamentId
      ),
      kind: "organization_tournament_matches_awaiting_agreement" as const,
      moneyCents: null,
      params: { tournamentId: tournament.tournamentId },
      route: "/tournaments/[tournamentId]",
      secondaryAction: null,
      secondaryActionLabel: null,
      severity: "warning" as const,
      // Qualquer proposta nova do agregado muda a assinatura e mata o recibo.
      signature: pendingItemSignature(
        tournament.proposals.map(
          (proposal) =>
            `${proposal.channel}:${proposal.matchId}:${proposal.proposedAt}`
        )
      ),
      source: { id: tournament.tournamentId, type: "tournament" as const },
      title: countNoun(
        tournament.stalledMatchCount,
        "confronto sem resposta",
        "confrontos sem resposta"
      ),
    }));
}
