import type { TournamentStatus } from "./contract";
import {
  isScheduledTournamentMatch,
  type TournamentScheduledMatch,
} from "./scheduling-rules";

/**
 * Status em que o organizador ainda edita pelo `tournament.update`: rascunho,
 * publicado, sorteado e em andamento são fases de ajuste; só o encerrado
 * congela.
 */
const EDITABLE_TOURNAMENT_STATUSES: Partial<Record<TournamentStatus, true>> = {
  draft: true,
  drawn: true,
  ongoing: true,
  published: true,
};

export function validateTournamentEditStatus(
  status: TournamentStatus
): string | null {
  return EDITABLE_TOURNAMENT_STATUSES[status]
    ? null
    : "Torneios encerrados não podem ser editados.";
}

/**
 * Segurança de quadra nas edições da chave sorteada (espelha a sincronia de
 * categoria): quadra que SAIU da lista não pode quebrar reserva existente. Se
 * uma partida AGENDADA (data + hora + quadra presentes) ainda aponta para ela,
 * devolve o id; partida sem reserva nunca prende quadra.
 */
export function findRemovedScheduledCourt(input: {
  removedCourtIds: ReadonlySet<string>;
  scheduledMatches: TournamentScheduledMatch[];
}): string | null {
  for (const match of input.scheduledMatches) {
    if (!isScheduledTournamentMatch(match)) {
      continue;
    }
    if (!input.removedCourtIds.has(match.courtId)) {
      continue;
    }
    return match.courtId;
  }
  return null;
}
