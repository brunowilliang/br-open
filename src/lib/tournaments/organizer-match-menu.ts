import {
  Calendar03Icon,
  Cancel01Icon,
  Edit02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import type { MatchCardMenuItem } from "@/components/ui/match-card";
import type { HugeIconGlyph } from "@/components/ui/huge-icons";

/** Verbo do menu do organizador: o card não decide nada, ele só desenha. */
export type OrganizerMatchMenuKind =
  | "cancel_matches"
  | "conclude_tournament"
  | "edit_result"
  | "publish_result"
  | "schedule_match";

export type OrganizerMatchMenuEntry = {
  icon: HugeIconGlyph;
  isDanger?: boolean;
  kind: OrganizerMatchMenuKind;
  label: string;
};

export type OrganizerMatchMenuInput = {
  /** A vaga acima da 1ª rodada que o organizador pode reservar (estrutura da
   * chave): sem os dois lados, é o que arma o agendamento. */
  canReserveSlot: boolean;
  /** A pendência de concluir o torneio está viva (torneio) e este é o card da
   * FINAL. */
  isConclusionPending: boolean;
  isFinal: boolean;
  /** Torneio encerrado ou cancelado: o servidor recusa toda ação de partida. */
  isTournamentClosed: boolean;
  matchDate: null | string;
  matchStatus: string;
  /** Inscrição nos dois lados do confronto. */
  sidesDefined: boolean;
};

/** Fonte ÚNICA do menu do ORGANIZADOR, na ordem do menu: principal primeiro,
 * destrutivo por último. Vale para todo card que o organizador vê. */
export function buildOrganizerMatchMenu(
  input: OrganizerMatchMenuInput
): OrganizerMatchMenuEntry[] {
  if (input.isTournamentClosed) {
    return [];
  }

  const isDecided =
    input.matchStatus === "finished" || input.matchStatus === "champion";
  const entries: OrganizerMatchMenuEntry[] = [];

  if (input.isFinal && input.isConclusionPending) {
    entries.push({
      icon: Tick02Icon,
      kind: "conclude_tournament",
      label: "Concluir torneio",
    });
  }

  if (!isDecided && (input.sidesDefined || input.canReserveSlot)) {
    entries.push({
      icon: Calendar03Icon,
      kind: "schedule_match",
      label: input.matchDate
        ? "Reagendar"
        : input.sidesDefined
          ? "Agendar"
          : "Reservar horário",
    });
  }

  if (!(isDecided || input.matchStatus === "vacant")) {
    if (input.sidesDefined) {
      entries.push({
        icon: Edit02Icon,
        kind: "publish_result",
        label: "Resultado",
      });
    }

    if (input.matchDate) {
      entries.push({
        icon: Cancel01Icon,
        isDanger: true,
        kind: "cancel_matches",
        label: "Cancelar jogo",
      });
    }
  }

  if (isDecided) {
    entries.push({
      icon: Edit02Icon,
      kind: "edit_result",
      label: "Editar resultado",
    });
  }

  return entries;
}

/** Liga o menu do papel ao canal do organizador: o card recebe o item pronto. */
export function bindOrganizerMatchMenu(input: {
  entries: readonly OrganizerMatchMenuEntry[];
  onAction: (kind: OrganizerMatchMenuKind) => void;
}): MatchCardMenuItem[] {
  return input.entries.map((entry) => ({
    icon: entry.icon,
    isDanger: entry.isDanger,
    label: entry.label,
    onPress: () => {
      input.onAction(entry.kind);
    },
  }));
}

/** Chave de uma vaga na chave (`categoria:rodada:slot`). */
export function buildMatchSlotKey(input: {
  categoryId: string;
  round: number;
  slotInRound: number;
}): string {
  return `${input.categoryId}:${input.round}:${input.slotInRound}`;
}

/**
 * Vaga acima da 1ª rodada com as DUAS filhas na chave: é ela que o organizador
 * reserva antes dos vencedores aparecerem (mesma regra do servidor). A 1ª
 * rodada espera a inscrição e continua exigindo os dois lados.
 */
export function canReserveUnreadySlot(input: {
  categoryId: string;
  matchRound: number;
  slotKeys: ReadonlySet<string>;
  slotInRound: number;
}): boolean {
  if (input.matchRound <= 1) {
    return false;
  }

  const feederRound = input.matchRound - 1;
  const feederKey = (slot: number) =>
    buildMatchSlotKey({
      categoryId: input.categoryId,
      round: feederRound,
      slotInRound: slot,
    });

  return (
    input.slotKeys.has(feederKey(input.slotInRound * 2)) &&
    input.slotKeys.has(feederKey(input.slotInRound * 2 + 1))
  );
}
