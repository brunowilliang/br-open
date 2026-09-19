import type { ApiOutputs } from "@convex/shared/api";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];

export type TournamentMatchWithSides = TournamentMatch & {
  entryA: TournamentEntryWithPlayers | null;
  entryB: TournamentEntryWithPlayers | null;
};

/** Coordenada de um lado da chave: o lado tocado e a partida que o hospeda. */
export type BracketSwapTarget = {
  match: TournamentMatchWithSides;
  side: "a" | "b";
};

/** Join client-side: match entryAId/entryBId → entries enriquecidas (fonte única). */
export function buildMatchSides(input: {
  entriesById: Record<string, TournamentEntryWithPlayers>;
  matches: TournamentMatch[];
}): TournamentMatchWithSides[] {
  return input.matches.map((match) => ({
    ...match,
    entryA: match.entryAId ? (input.entriesById[match.entryAId] ?? null) : null,
    entryB: match.entryBId ? (input.entriesById[match.entryBId] ?? null) : null,
  }));
}

/**
 * Vaga DERIVADA do sorteio: linha que nasce com um lado só e o vencedor já
 * resolvido — o bye da 1ª rodada (e a linha que segue bye depois de um
 * ajuste de posição). O marcador é o `status` (`walkover`), NUNCA
 * `walkover: true`: o W.O. JOGADO de verdade (o organizador declara vencedor
 * sem placar) é gravado como `finished` com `walkover: true` e mantém os
 * rótulos normais do card (`publishResult`, convex/functions/tournament/
 * matches.ts). No desenho, o bye é um card VAZIO: sem fase, sem chip, sem
 * lado fantasma, sem seta e sem identidade, só o container do card.
 */
export function isByeMatch(match: { status: string }): boolean {
  return match.status === "walkover";
}

/**
 * A partida FILHA que alimenta um lado, como o gating do ajuste precisa dela:
 * o status separa feed morto (`vacant`) de feed vivo, e o vencedor da filha
 * diz se o lado é uma vitória PROPAGADA dela.
 */
export type BracketFeed = {
  status: string;
  winnerEntryId: null | string;
};

/**
 * A vaga está TRAVADA? O lado é a vitória PROPAGADA da partida filha (o
 * vencedor dela é quem ocupa o lado) e essa decisão é um RESULTADO PUBLICADO:
 * o movimento desfaria o feed de uma partida já jogada, e o servidor recusa
 * ("Essa vaga vem de um confronto já decidido e não pode ser ajustada.").
 * Espelha o `swapSideIsDerived` do domínio (regra do Forja, 16/09) — o
 * vencedor de um BYE do sorteio (`walkover`, sem resultado publicado) NÃO
 * trava a vaga: o ajuste re-deriva o bye e leva o vencedor junto. O marcador
 * de "resultado publicado" na linha do cliente é `status === "finished"` (o
 * `publishedAt` do backend não viaja no wire; publicar um resultado grava
 * `finished` + placar).
 */
export function swapSideIsLocked(input: {
  feed: BracketFeed | null;
  sideEntryId: null | string;
}): boolean {
  return Boolean(
    input.sideEntryId &&
      input.feed?.status === "finished" &&
      input.feed.winnerEntryId === input.sideEntryId
  );
}

/**
 * A LINHA ainda pode participar de um ajuste de posição: sem placar (nenhum
 * resultado publicado) e viva. O `winnerEntryId` da linha NÃO trava nada: o
 * vencedor de um bye do sorteio é decisão do DRAW, não resultado, e o ajuste
 * o re-deriva levando o vencedor junto — quem trava é a vaga com vitória
 * propagada de resultado publicado (`swapSideIsLocked`), por LADO. Linha
 * vacant não tem lado para mover.
 */
export function canSwapMatch(match: {
  score: unknown;
  status: string;
}): boolean {
  return (
    match.score === null &&
    match.status !== "finished" &&
    match.status !== "vacant"
  );
}

/**
 * O lado pode RECEBER uma inscrição vinda de um ajuste? Lado OCUPADO é
 * transposição pura (não depende de feed). Lado VAZIO só aceita quando o
 * feed é MORTO: 1ª rodada (sem partida filha) ou lado cuja filha é uma linha
 * PODADA (`vacant`). Lado vazio que ainda espera o vencedor do confronto de
 * baixo é recusado pelo servidor — "Essa vaga ainda vai receber o vencedor
 * do confronto de baixo, só uma linha podada aceita uma inscrição" — porque
 * a propagação do filho sobrescreveria a inscrição movida e ela sumiria da
 * chave. Partida com resultado publicado não recebe nada (IBX-0053); a vaga
 * com vitória propagada de resultado publicado é travada por
 * `swapSideIsLocked`, no mesmo eixo da origem.
 */
export function canReceiveSwapSide(input: {
  /** Partida filha que alimenta o lado; null = sem feed (1ª rodada). */
  feed: BracketFeed | null;
  match: { score: unknown; status: string };
  sideEmpty: boolean;
}): boolean {
  const hasPublishedResult =
    input.match.score !== null || input.match.status === "finished";

  if (hasPublishedResult) {
    return false;
  }

  return input.sideEmpty
    ? input.feed === null || input.feed.status === "vacant"
    : true;
}

/**
 * A segunda coordenada pode ser escolhida a partir da seleção armada:
 * cross-categoria nunca; o ajuste (mesma rodada ou outra) SÓ com a chave
 * sorteada e ainda não iniciada (drawn) — iniciar CONGELA a chave
 * (IBX-0068): em ongoing nenhuma coordenada é alcançável.
 */
export function canPickSwapSecond(input: {
  current: { categoryId: string; round: number };
  next: { categoryId: string; round: number };
  tournamentStatus: string;
}): boolean {
  if (input.current.categoryId !== input.next.categoryId) {
    return false;
  }

  return input.tournamentStatus === "drawn";
}

/**
 * Quais LADOS deste card aceitam a seleção corrente — o gating é por
 * coordenada (rodada, slot, LADO), não por card. A janela INTEIRA é
 * `drawn` (IBX-0068): fora dela nenhuma seta existe, nem origem nem
 * destino. Dentro dela, sem seleção armada os lados
 * são ORIGEM: só lado PREENCHIDO pode ser movido (o servidor recusa lado
 * vazio: "Escolha uma posição preenchida para trocar") e vaga com vitória
 * propagada de resultado publicado não é oferecida (`swapSideIsLocked`), então
 * um card com um lado "A definir" mostra a seta apenas no lado que existe. Com
 * uma coordenada armada vêm os DESTINOS, lado a lado: lado vazio só quando o
 * feed é morto (ver `canReceiveSwapSide`), o mesmo recorte de vaga travada, e
 * o card da própria origem segue tocável para o toque na mesma coordenada
 * limpar a seleção.
 */
export function resolveSwapPickSides(input: {
  current: BracketSwapTarget | null;
  /** Partida filha de cada lado; null = sem feed (1ª rodada). */
  feedA: BracketFeed | null;
  feedB: BracketFeed | null;
  match: TournamentMatchWithSides;
  tournamentStatus: string;
}): { a: boolean; b: boolean } {
  if (input.tournamentStatus !== "drawn") {
    return { a: false, b: false };
  }

  const { current, match } = input;

  if (!current) {
    const sourceEnabled = canSwapMatch(match);

    return {
      a:
        sourceEnabled &&
        match.entryAId !== null &&
        !swapSideIsLocked({ feed: input.feedA, sideEntryId: match.entryAId }),
      b:
        sourceEnabled &&
        match.entryBId !== null &&
        !swapSideIsLocked({ feed: input.feedB, sideEntryId: match.entryBId }),
    };
  }

  if (current.match.id === match.id) {
    return { a: true, b: true };
  }

  if (
    !canPickSwapSecond({
      current: current.match,
      next: match,
      tournamentStatus: input.tournamentStatus,
    })
  ) {
    return { a: false, b: false };
  }

  return {
    a:
      canReceiveSwapSide({
        feed: input.feedA,
        match,
        sideEmpty: match.entryAId === null,
      }) &&
      !swapSideIsLocked({ feed: input.feedA, sideEntryId: match.entryAId }),
    b:
      canReceiveSwapSide({
        feed: input.feedB,
        match,
        sideEmpty: match.entryBId === null,
      }) &&
      !swapSideIsLocked({ feed: input.feedB, sideEntryId: match.entryBId }),
  };
}

/** Desfecho do toque num lado com a seleção corrente. */
export type BracketSwapSelectionOutcome =
  | { kind: "arm"; target: BracketSwapTarget }
  | { kind: "clear" }
  | { kind: "restart"; target: BracketSwapTarget }
  | { from: BracketSwapTarget; kind: "swap"; to: BracketSwapTarget };

/**
 * Resolve o toque num lado: arma a origem (SÓ com a chave drawn, IBX-0068),
 * limpa ao tocar a MESMA
 * coordenada, executa o ajuste quando a segunda coordenada é alcançável
 * (somente com a chave drawn, IBX-0068) e reinicia a seleção no alvo fora
 * da janela.
 */
export function resolveSwapSelection(input: {
  current: BracketSwapTarget | null;
  next: BracketSwapTarget;
  tournamentStatus: string;
}): BracketSwapSelectionOutcome {
  const { current, next } = input;

  if (!current) {
    if (input.tournamentStatus !== "drawn") {
      return { kind: "clear" };
    }

    return { kind: "arm", target: next };
  }

  if (current.match.id === next.match.id && current.side === next.side) {
    return { kind: "clear" };
  }

  return canPickSwapSecond({
    current: current.match,
    next: next.match,
    tournamentStatus: input.tournamentStatus,
  })
    ? { from: current, kind: "swap", to: next }
    : { kind: "restart", target: next };
}

/** Os três campos que definem um confronto agendado (agenda do torneio). */
export type TournamentScheduleFields = {
  courtId: null | string;
  matchDate: null | string;
  startMinute: null | number;
};

/**
 * Existe algum confronto agendado (data, horário e quadra) nas partidas
 * carregadas do torneio — qualquer categoria. O re-sorteio apaga as
 * partidas e reconstrói a chave, então os agendamentos morrem junto: a UI
 * usa isto para avisar o organizador ANTES de disparar o draw.
 */
export function hasScheduledMatch(
  matches: TournamentScheduleFields[]
): boolean {
  return matches.some(
    (match) =>
      match.matchDate !== null &&
      match.startMinute !== null &&
      match.courtId !== null
  );
}
