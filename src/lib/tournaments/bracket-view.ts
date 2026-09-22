import type { ApiOutputs } from "@convex/shared/api";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];

export type TournamentMatchWithSides = TournamentMatch & {
  entryA: TournamentEntryWithPlayers | null;
  entryB: TournamentEntryWithPlayers | null;
};

export type BracketSwapTarget = {
  match: TournamentMatchWithSides;
  side: "a" | "b";
};

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

// O marcador do bye é o `status` (`walkover`), NUNCA `walkover: true`: o W.O.
// JOGADO de verdade é `finished` + `walkover: true` e mantém os rótulos do card.
export function isByeMatch(match: { status: string }): boolean {
  return match.status === "walkover";
}

/** Partida filha de um lado: `vacant` é feed morto, e o vencedor dela diz se o lado é vitória PROPAGADA. */
export type BracketFeed = {
  status: string;
  winnerEntryId: null | string;
};

// Trava a vaga cujo lado é a vitória PROPAGADA da filha com resultado já
// publicado — e no cliente "publicado" só existe como `status === "finished"`
// (o `publishedAt` do backend não viaja no wire). O bye do sorteio não trava.
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

// O `winnerEntryId` da linha NÃO trava nada (vencer um bye é decisão do DRAW e
// o ajuste re-deriva levando o vencedor junto): quem trava é a vaga, por LADO.
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

// Lado vazio só aceita feed MORTO — sem filha ou filha podada: esperando o
// vencedor do confronto de baixo, a propagação do filho sobrescreveria a
// inscrição movida e ela sumiria da chave. Resultado publicado não recebe nada.
export function canReceiveSwapSide(input: {
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

// Cross-categoria nunca; na mesma categoria só com a chave ainda não iniciada
// (`drawn`) — iniciar CONGELA a posição e nenhuma coordenada é alcançável.
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

// Gating por coordenada (rodada, slot, LADO), nunca por card; fora de `drawn`
// nenhuma seta existe. Sem seleção armada os lados são ORIGEM e só lado
// PREENCHIDO vale (o card com "A definir" mostra a seta só no lado que existe).
// Armado, vêm os DESTINOS — e o card da própria origem segue tocável para
// limpar a seleção.
export function resolveSwapPickSides(input: {
  current: BracketSwapTarget | null;
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

export type BracketSwapSelectionOutcome =
  | { kind: "arm"; target: BracketSwapTarget }
  | { kind: "clear" }
  | { kind: "restart"; target: BracketSwapTarget }
  | { from: BracketSwapTarget; kind: "swap"; to: BracketSwapTarget };

// Arma a origem (só com a chave `drawn` e nenhuma seleção anterior), limpa no
// toque da MESMA coordenada e reinicia a seleção no alvo fora da janela.
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

export type TournamentScheduleFields = {
  courtId: null | string;
  matchDate: null | string;
  startMinute: null | number;
};

// O re-sorteio apaga as partidas e reconstrói a chave, então os agendamentos
// morrem junto: a UI usa isto para avisar o organizador ANTES de disparar o draw.
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
